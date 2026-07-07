#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import serial
import time
import cv2
import numpy as np
import mysql.connector
from mysql.connector import Error
import os
import sys
import subprocess

import motor_ctrl
import tracker
import vision
import pack_out_ai
ANOMALY_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ai-tools", "hardware_tools.py")
# ── 调试开关 ──
SHOW_TRACKING = False          # True: 抓取时显示跟踪画面；False: 无画面
SHOW_WINDOW = False# True: 显示摄像头画面和检测叠加层，False: 无画面
DB_CONFIG = {
    'host': os.getenv('DB_HOST', '121.40.169.218'),
    'user': os.getenv('DB_USER', 'redwaltz'),
    'password': os.getenv('DB_PASSWORD', '123456'),
    'database': os.getenv('DB_NAME', 'qiansai'),
    'charset': 'utf8mb4'
}

# ===================== 进度日志（断点续传） =====================
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pack_in_progress.txt")

def load_processed_ids():
    """从日志文件读取所有已处理的 shipment id，返回集合。无记录返回空集。"""
    ids = set()
    try:
        with open(LOG_FILE, 'r') as f:
            for line in f:
                line = line.strip()
                if line:
                    ids.add(int(line))
    except (FileNotFoundError, ValueError):
        pass
    return ids

def save_processed_id(sid):
    """将已处理的 shipment id 追加写入日志，并 fsync 保证落盘。"""
    need_nl = False
    try:
        with open(LOG_FILE, 'rb') as f:
            f.seek(0, 2)          # 移到文件末尾
            if f.tell() > 0:      # 文件非空
                f.seek(-1, 2)     # 读取最后一个字节
                need_nl = (f.read(1) != b'\n')
    except (FileNotFoundError, OSError):
        pass

    with open(LOG_FILE, 'a') as f:
        if need_nl:
            f.write('\n')         # 补齐缺失的换行
        f.write(f"{sid}\n")
        f.flush()
        os.fsync(f.fileno())

# ===================== 【完全不动你的函数】 =====================
def get_next_location(processed_ids):
    """
    从 qiansai.shipments 读取 id 不在 processed_ids 集合中的第一条记录。
    返回 (shipment_id, location)，无数据时返回 (None, None)。
    """
    connection = None
    cursor = None
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()

        query = "SELECT id, location FROM shipments ORDER BY id ASC"
        cursor.execute(query)
        rows = cursor.fetchall()
        for row in rows:
            if row[0] not in processed_ids:
                return row[0], row[1]
        return None, None

    except Error as e:
        print(f"数据库错误: {e}", file=sys.stderr)
        return None, None
    except Exception as e:
        print(f"发生异常: {e}", file=sys.stderr)
        return None, None
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()

# ===================== 串口与摄像头初始化 =====================
# 双摄像头：CAM_ID_LEFT(22) 固定在机械臂1，CAM_ID_RIGHT(24) 固定在机械臂2
CAM_ID_LEFT  = 22
CAM_ID_RIGHT = 24
motor_ctrl.init(port="/dev/ttyUSB0")
uart_arm = serial.Serial(port="/dev/ttyACM0", baudrate=115200, parity=serial.PARITY_NONE, stopbits=serial.STOPBITS_ONE, bytesize=serial.EIGHTBITS, timeout=0.1)
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "best_qdq.onnx")
vision.load_model(MODEL_PATH)
print("ONNX 模型已加载")

cam_left  = vision.CameraGrabber(CAM_ID_LEFT)
cam_right = vision.CameraGrabber(CAM_ID_RIGHT)
# 两个摄像头共享 USB 带宽，同一时刻只能有一个在抓取。
# 初始只启动当前区域对应的摄像头，切换区域时通过 _cam_for_region 动态切换。
# 当前 first_target 由主循环计算，这里先不启动，等 main() 中根据 region 决定。
# （模块级初始化只打开设备不启动线程，在 main() 中按需启动）


# 上电强制清空所有缓冲区
time.sleep(0.1)
uart_arm.reset_input_buffer()
uart_arm.reset_output_buffer()
uart_arm.flush()
time.sleep(0.1)

def send_cmd_arm(cmd_str):
    raw = (cmd_str + "\n").encode()
    uart_arm.write(raw)
    uart_arm.flush()
    time.sleep(0.1)

def move_pos(addr, pos_num, speed=5000, acc=250):
    POS_RIGHT  = 0
    POS_R_MID  = 144000
    POS_L_MID  = 312000
    POS_LEFT   = 448000

    if pos_num == 1:
        motor_ctrl.move_motor(addr, 0, speed, acc, POS_RIGHT, abs_mode=True)
    elif pos_num == 2:
        motor_ctrl.move_motor(addr, 1, speed, acc, POS_R_MID, abs_mode=True)
    elif pos_num == 3:
        motor_ctrl.move_motor(addr, 1, speed, acc, POS_L_MID, abs_mode=True)
    elif pos_num == 4:
        motor_ctrl.move_motor(addr, 1, speed, acc, POS_LEFT, abs_mode=True)

def move_to_region(region_num, speed=5000, acc=250):
    if not (1 <= region_num <= 8):
        raise ValueError(f"无效区域编号: {region_num}")
    addr = 0x01 if region_num % 2 == 1 else 0x02
    pos_num = (region_num + 1) // 2
    move_pos(addr, pos_num, speed, acc)
    time.sleep(1)

def grab_and_move(drop_region, cam, grab_time=2.5, drop_time=2.5):
    if drop_region in (1,3,5,7):
        arm_prefix = "1"
        prepare_region = 5
        addr = 0x01
    elif drop_region in (2,4,6,8):
        arm_prefix = "2"
        prepare_region = 6
        addr = 0x02
    else:
        raise ValueError("区域必须是1~8")

    drop_cmd  = f"{arm_prefix}DROPOUT"

    # 视觉 PID 闭环：动态对齐物块并抓取
    tracker.SHOW_WINDOW = SHOW_TRACKING
    success = tracker.track_and_grab(addr, cam, send_cmd_arm, arm_prefix)
    tracker.SHOW_WINDOW = True
    # 安全销毁窗口
    try:
        if cv2.getWindowProperty("Tracker", cv2.WND_PROP_VISIBLE) >= 0:
            cv2.destroyWindow("Tracker")
    except:
        pass
    if not success:
        print("视觉跟踪超时，回到准备位")
        move_to_region(prepare_region)
        subprocess.Popen(
            [sys.executable, ANOMALY_SCRIPT, "create_anomaly",
             "--type", "inbound", "--location", str(drop_region)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        return
    time.sleep(grab_time)

    move_to_region(drop_region)
    send_cmd_arm(drop_cmd)
    time.sleep(drop_time)
    move_to_region(prepare_region)
    send_cmd_arm("RESET")

def all_init():
    motor_ctrl.release_stall(0x00)
    send_cmd_arm("RESET")
    time.sleep(0.1)
    # 两个电机回到准备位：区域5（臂1）、区域6（臂2）
    move_pos(0x00,3)

    print("系统已启动 → 传送带运行中 → 等待物料...")
    send_cmd_arm("RIGHT")

def all_close():
    # 两个电机回到起始位：区域1（臂1）、区域2（臂2）
    move_pos(0x00,1)
    send_cmd_arm("STOP")
    time.sleep(0.1)
    send_cmd_arm("RESET")
    time.sleep(0.1)
    motor_ctrl.close()
    uart_arm.close()
    cam_left.stop()
    cam_right.stop()
    cv2.destroyAllWindows()

_current_cam = None  # 当前活跃的摄像头引用

def _cam_for_region(region_num):
    """根据目标区域返回对应摄像头和机械臂标识，同时自动切换活跃摄像头"""
    global _current_cam
    if region_num in (1, 3, 5, 7):
        need_cam = cam_left
        arm_name = "臂1(左)"
    else:
        need_cam = cam_right
        arm_name = "臂2(右)"

    if _current_cam is not need_cam:
        # 切换摄像头：暂停旧的，启动新的
        if _current_cam is not None:
            _current_cam.pause()
        need_cam.resume()
        _current_cam = need_cam

    return need_cam, arm_name

def main():
    """
    入库主循环（逐条取数 + 断点续传）：
    - 日志文件记录所有已处理的 shipment id
    - 每次查询数据库，跳过已处理 id，取第一条未处理的
    - 处理后立即写入日志，程序重启自动跳过已处理 id 继续
    """
    WINDOW_NAME = "PackIn Camera"

    if SHOW_WINDOW:
        cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(WINDOW_NAME, 640, 480)

    uart_arm.reset_input_buffer()

    # 恢复上次进度
    processed_ids = load_processed_ids()
    processed_count = len(processed_ids)
    print(f"已加载进度记录，已处理 {processed_count} 个包裹")

    # 等待第一条数据就绪
    while True:
        sid, target = get_next_location(processed_ids)
        if sid is not None:
            break
        time.sleep(0.5)

    _cam_for_region(target)
    print("等待物料检测并入库...")

    while True:
        # 查询下一条未处理的记录
        sid, target = get_next_location(processed_ids)
        if sid is None:
            time.sleep(0.5)
            continue

        cam_sel, arm_name = _cam_for_region(target)

        # 轮询该目标对应的摄像头检测包裹
        frame = cam_sel.read()
        if frame is None:
            if SHOW_WINDOW:
                placeholder = 128 * np.ones((480, 640, 3), dtype=np.uint8)
                cv2.putText(placeholder, f"No Signal | Target: {target} | {arm_name}",
                            (40, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                cv2.imshow(WINDOW_NAME, placeholder)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            time.sleep(0.01)
            continue
        offset = vision.detect_offset(frame)
        if (offset is None) or (abs(int(offset)) > 150):
            if SHOW_WINDOW:
                annotated = vision.draw_overlay(frame.copy(), 0.0, offset)
                cv2.putText(annotated, f"Target: {target} | {arm_name}",
                            (10, annotated.shape[0] - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 2)
                cv2.imshow(WINDOW_NAME, annotated)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            time.sleep(0.02)
            continue

        # 包裹检测到 → 再次确认数据未被外部修改
        sid2, target2 = get_next_location(processed_ids)
        if sid2 is None or sid2 != sid:
            print(f"数据变更，重新查询...")
            continue

        target = target2
        cam_sel, arm_name = _cam_for_region(target)

        processed_count += 1
        print(f"\n第 {processed_count} 个包裹 → 入库位置: {target}，使用 {arm_name}")
        print("物料已到达！")
        if SHOW_WINDOW:
            cv2.destroyWindow(WINDOW_NAME)

        # 先记日志再抓取：防止 grab 成功后程序中断导致 id 丢失
        save_processed_id(sid)
        processed_ids.add(sid)

        grab_and_move(target, cam_sel)
        if SHOW_WINDOW:
            cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
            cv2.resizeWindow(WINDOW_NAME, 640, 480)
        print(f"位置 {target} 入库完成！")
        print("=====================================")
if __name__ == "__main__":
    all_init()
    try:
        main()
    except KeyboardInterrupt:
        print("\n用户手动停止程序")
    finally:
        all_close()