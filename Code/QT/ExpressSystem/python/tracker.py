#!/usr/bin/env python3
"""
视觉 PID 跟踪模块。

===== PID 调参方法（使用 pid_debug.py）=====

1. 连接摄像头，确保物块在画面中可见：
      python3 pid_debug.py --cam 0

2. 在 "Controls" 窗口拖动 HSV trackbar，观察 "HSV Mask" 窗口：
      目标：只有咖啡色物块区域为白色，其余为黑色
      注意看右下角 "AREA:xxxx" 是否跟物块面积匹配

3. 调好后按 S 键，终端会打印 LOWER / UPPER / MIN_AREA 值，
   复制到 vision.py 对应的变量中。

4. 按 T 键启动 PID 跟踪，物块放在画面非中心位置：
      对照 PID Plot 窗口的曲线：
        RED（误差） —— 是否快速收敛到 0
        YEL（PID输出） —— 是否震荡/平滑
      拖动 "Kp/Ki/Kd" trackbar 实时看响应变化

5. 调好后按 S 键打印 Kp/Ki/Kd，复制到下方 PID(...) 构造参数中。

6. 如果物块在画面左侧（offset 正值）但电机往右跑，
   给下方 delta_pulse = _px_to_pulse(pid_out) 加上负号。
"""
import time
import cv2
import motor_ctrl
import vision

# 调参区
PIXEL_ALIGN_THRESHOLD = 20   # 偏差小于此值视为对齐，可抓取
PIXELS_PER_MM = 4             # 摄像头标定：每 mm 对应多少像素
SHOW_WINDOW = False           # 有显示器时设 True
TRACKING_SPEED = 200          # RPM 上限
TRACKING_SPEED_MIN = 30       # RPM 下限，防止抖动
TRACKING_ACC = 220              # 0=直接以设定速度运行，不做曲线，防超冲
TRACK_PULSE_MIN = 0      # 跟踪范围下限（POS_R_MID，防止冲到最右）
TRACK_PULSE_MAX = 410000      # 跟踪范围上限（POS_LEFT）
GRAB_LOST_FRAMES = 5           # 连续 N 帧检测不到物块，认为已被抓起
GRAB_MAX_HOLD = 0.5            # 保持阶段最长等待时间，防止物块始终不消失

class PID:
    def __init__(self, kp, ki, kd, limit):
        self.kp, self.ki, self.kd, self.limit = kp, ki, kd, limit
        self._integral = 0.0
        self._prev_error = 0.0
        self._prev_t = None

    def reset(self):
        self._integral = 0.0
        self._prev_error = 0.0
        self._prev_t = None

    def compute(self, error):
        now = time.time()
        dt = (now - self._prev_t) if self._prev_t else 0.033
        self._prev_t = now
        self._integral += error * dt
        self._integral = max(-self.limit, min(self.limit, self._integral))  # 防积分饱和
        d = (error - self._prev_error) / max(dt, 1e-6)
        self._prev_error = error
        out = self.kp * error + self.ki * self._integral + self.kd * d
        return max(-self.limit, min(self.limit, out))

_pid = PID(kp=10, ki=0, kd=0.35, limit=300)


def _px_to_pulse(px):
    mm = px / PIXELS_PER_MM
    return int(mm * motor_ctrl.PULSES_PER_REV / motor_ctrl.MM_PER_REV)


def track_and_grab(addr, cam, send_cmd_arm, arm_prefix, timeout=10.0):
    """
    视觉 PID 闭环：驱动电机使物块进入画面中心，对齐后发送抓取指令，
    并在抓取动作完成前继续保持跟踪（滑台跟随物块移动）。
    返回 True=成功 / False=超时未对齐。
    """
    _pid.reset()
    deadline = time.time() + timeout
    t_start = None           # 首个有效 offset 的时刻
    iter_count = 0           # PID 迭代次数
    max_offset = 0           # 跟踪过程中最大偏差
    latencies = []           # 推理耗时记录

    grab_sent = False               # 是否已发送抓取指令
    grab_lost_count = 0            # 连续检测不到物块的帧数
    grab_hold_start = 0            # 保持阶段开始时刻

    while time.time() < deadline:
        frame = cam.read()
        if frame is None:
            continue

        t0 = time.time()
        offset_px = vision.detect_offset(frame)
        t1 = time.time()
        latencies.append(t1 - t0)
        enc = motor_ctrl.read_position(addr)
        arm_mm = motor_ctrl.encoder_to_mm(enc) if enc is not None else float("nan")

        # 估算物块绝对坐标 = 臂位置 - 像素偏差换算（左正右负）
        block_mm = None
        if offset_px is not None and enc is not None:
            block_mm = arm_mm - offset_px / PIXELS_PER_MM

        if SHOW_WINDOW:
            annotated = vision.draw_overlay(frame.copy(), arm_mm, offset_px, block_mm)
            cv2.imshow("Tracker", annotated)
            cv2.waitKey(1)

        # ── 保持阶段：物块连续消失 → 已被抓起 ──
        if grab_sent:
            if offset_px is None:
                grab_lost_count += 1
                if grab_lost_count >= GRAB_LOST_FRAMES:
                    return True
            else:
                grab_lost_count = 0   # 还能看到，重置计数
            # 最长保底，防止物块始终不消失
            if time.time() - grab_hold_start > GRAB_MAX_HOLD:
                return True

        if offset_px is None:
            continue

        # 首个有效检测，记录起始时刻
        if t_start is None:
            t_start = time.time()

        max_offset = max(max_offset, abs(offset_px))

        # ── 对齐判断（仅一次）──
        if not grab_sent and abs(offset_px) <= PIXEL_ALIGN_THRESHOLD:
            send_cmd_arm(f"{arm_prefix}CATCHIN")
            grab_sent = True
            grab_lost_count = 0
            grab_hold_start = time.time()
#            print("\r  [HOLD] 抓取指令已发送，等待物块消失...   ",
#                  end="", flush=True)

        # ── PID 输出 → 电机控制（对齐前 + 保持阶段共用）──
        if enc is None:
            continue
        current_pulse = motor_ctrl.encoder_to_pulse(enc)
        # 读值超出追踪范围 50000 脉冲（≈345mm）视为串口异常，跳过（不更新 PID 积分）
        if not (TRACK_PULSE_MIN - 50000 <= current_pulse <= TRACK_PULSE_MAX + 50000):
            print(f"\r  [SKIP] 编码器读值异常 cur={current_pulse}，跳过本帧   ", end="", flush=True)
            continue
        pid_out = _pid.compute(offset_px)
        iter_count += 1
        delta_pulse = -_px_to_pulse(pid_out)
        raw_target = current_pulse + delta_pulse
        target_pulse = max(TRACK_PULSE_MIN, min(TRACK_PULSE_MAX, raw_target))

        # 已到边界且物块仍在界外，原地等待，不发反向指令
        if target_pulse != raw_target:
            side = "MIN" if raw_target < TRACK_PULSE_MIN else "MAX"
#            print(f"\r  [LIMIT-{side}] off={offset_px:+4d}px  cur={current_pulse}   ",
#                  end="", flush=True)
            continue

        step = abs(target_pulse - current_pulse)
        if step == 0:
            continue

        direction = 0x01 if target_pulse > current_pulse else 0x00
        dist_mm = delta_pulse * motor_ctrl.MM_PER_REV / motor_ctrl.PULSES_PER_REV
        speed = max(TRACKING_SPEED_MIN,
                    min(TRACKING_SPEED, int(step * 60 / (motor_ctrl.PULSES_PER_REV * 0.05))))
        motor_ctrl.move_motor(addr, 0x01,
                              speed, TRACKING_ACC,
                              target_pulse, abs_mode=True, release=False)
    return False
