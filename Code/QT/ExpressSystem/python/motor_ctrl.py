#!/usr/bin/env python3
import serial
import time

PULSES_PER_REV = 51200   # 256细分 × 200步/圈
ENCODER_PER_REV = 65536  # 编码器分辨率（计数/圈）
MM_PER_REV = 352.0       # 丝杆导程 mm/圈

_uart = None

def init(port="/dev/ttyUSB0", baudrate=115200):
    global _uart
    _uart = serial.Serial(
        port=port, baudrate=baudrate,
        parity=serial.PARITY_NONE,
        stopbits=serial.STOPBITS_ONE,
        bytesize=serial.EIGHTBITS,
        timeout=0.1
    )
    time.sleep(0.1)

def close():
    if _uart and _uart.is_open:
        _uart.close()

def release_stall(addr):
    _uart.write(bytearray([addr, 0x0E, 0x52, 0x6B]))
    time.sleep(0.01)
    _uart.reset_input_buffer()

def move_motor(addr, direction, speed, acc, pulse, abs_mode=False, sync_mode=False, release=True):
    if release:
        release_stall(addr)
    cmd = bytearray([
        addr, 0xFD, direction,
        (speed >> 8) & 0xFF, speed & 0xFF,
        acc,
        (pulse >> 24) & 0xFF, (pulse >> 16) & 0xFF,
        (pulse >> 8) & 0xFF, pulse & 0xFF,
        0x01 if abs_mode else 0x00,
        0x01 if sync_mode else 0x00,
        0x6B
    ])
    _uart.write(cmd)
    _uart.flush()
    time.sleep(0.01)
    _uart.reset_input_buffer()            # 丢弃驱动器响应，不阻塞

def move_to_pulse(addr, target_pulse, speed=5000, acc=250):
    enc = read_position(addr)
    current_pulse = encoder_to_pulse(enc) if enc is not None else 0
    direction = 0x01 if target_pulse >= current_pulse else 0x00
    move_motor(addr, direction, speed, acc, target_pulse, abs_mode=True)

def read_position(addr):
    """
    读取电机实时位置，返回有符号编码器计数（累计值）。
    失败返回 None。
    帧格式：[addr, 0x36, sign, b3, b2, b1, b0, 0x6B]
    """
    _uart.reset_input_buffer()
    _uart.write(bytearray([addr, 0x36, 0x6B]))
    time.sleep(0.005)                   # 115200bps → 3字节 ≈ 0.3ms，5ms充裕
    resp = _uart.read(8)
    if len(resp) < 8 or resp[0] != addr or resp[1] != 0x36 or resp[7] != 0x6B:
        return None
    value = (resp[3] << 24) | (resp[4] << 16) | (resp[5] << 8) | resp[6]
    return -value if resp[2] == 0x01 else value

def encoder_to_mm(enc):
    return enc * MM_PER_REV / ENCODER_PER_REV

def encoder_to_pulse(enc):
    return int(abs(enc) * PULSES_PER_REV / ENCODER_PER_REV)

def pulse_to_mm(pulse):
    return pulse * MM_PER_REV / PULSES_PER_REV

def move_velocity(addr, direction, speed, acc):
    """速度模式（0xF6）：持续以 RPM 速度运转，speed=0 即停止。
    direction: 0x00=CW顺时针, 0x01=CCW逆时针
    speed: 转速 RPM
    acc: 加速度档位 0~255（0=直接以设定速度运行）
    帧格式: addr 0xF6 dir spd_hi spd_lo acc 0x00 0x6B  (8字节)
    返回: addr 0xF6 0x02 0x6B (成功) / 0xE2 (堵转/未使能)
    """
    cmd = bytearray([
        addr, 0xF6, direction,
        (speed >> 8) & 0xFF, speed & 0xFF,
        acc,
        0x00,  # 多机同步标志，不启用
        0x6B
    ])
    _uart.write(cmd)
    _uart.flush()
    time.sleep(0.005)
