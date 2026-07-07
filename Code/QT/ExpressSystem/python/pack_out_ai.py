#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import serial
import time
import os
import sys
uart = serial.Serial(port="/dev/ttyUSB0", baudrate=115200, parity=serial.PARITY_NONE, stopbits=serial.STOPBITS_ONE, bytesize=serial.EIGHTBITS, timeout=0.1)
uart_arm = serial.Serial(port="/dev/ttyACM0", baudrate=115200, parity=serial.PARITY_NONE, stopbits=serial.STOPBITS_ONE, bytesize=serial.EIGHTBITS, timeout=0.1)
uart_arm.reset_input_buffer()
uart_arm.reset_input_buffer()
uart_arm.reset_output_buffer()

def send_cmd_arm(cmd_str):
    """【最重要】统一发指令函数：带结束符、延时、清空"""
    uart_arm.write( (cmd_str + "\n").encode() )  # 加换行符！单片机必须靠这个分隔指令
    time.sleep(0.08)  # 必须延时！给C8T6处理时间

def move_motor(addr, direction, speed, acc, pulse, abs_mode=False, sync_mode=False):
    cmd = [
        addr, 0xFD, direction,
        (speed >> 8) & 0xFF, speed & 0xFF,
        acc,
        (pulse >> 24) & 0xFF, (pulse >> 16) & 0xFF,
        (pulse >> 8) & 0xFF, pulse & 0xFF,
        0x01 if abs_mode else 0x00,
        0x01 if sync_mode else 0x00,
        0x6B
    ]
    uart.write(bytearray([addr, 0x0E, 0x52, 0x6B]))
    time.sleep(0.1)
    uart.write(bytearray(cmd))
    time.sleep(0.1)
    uart.flush()

def move_pos(addr, pos_num, speed=5000, acc=250):
    POS_RIGHT  = 0
    POS_R_MID  = 144000
    POS_L_MID  = 312000
    POS_LEFT   = 448000
    if pos_num == 1:
        move_motor(addr, 0, speed, acc, POS_RIGHT, abs_mode=True)
    elif pos_num == 2:
        move_motor(addr, 1, speed, acc, POS_R_MID, abs_mode=True)
    elif pos_num == 3:
        move_motor(addr, 1, speed, acc, POS_L_MID, abs_mode=True)
    elif pos_num == 4:
        move_motor(addr, 1, speed, acc, POS_LEFT, abs_mode=True)

def move_to_region(region_num, speed=5000, acc=250):
    if not (1 <= region_num <= 8):
        raise ValueError(f"无效区域编号: {region_num}")
    addr = 0x01 if region_num % 2 == 1 else 0x02
    pos_num = (region_num + 1) // 2
    move_pos(addr, pos_num, speed, acc)
    time.sleep(1)
def grab_and_move(grab_region, grab_time=3, drop_time=3):
    """
    规则：
    抓取区 1/3/5 奇数 → 自动放到 区域7
    抓取区 2/4/6 偶数 → 自动放到 区域8
    """
    # 判断机械臂前缀 + 准备区域
    if grab_region in (1, 3, 5, 7):
        arm_prefix = "1"
        prepare_region = 5
        drop_region = 7   # 奇数统一放7
    elif grab_region in (2, 4, 6, 8):
        arm_prefix = "2"
        prepare_region = 6
        drop_region = 8   # 偶数统一放8
    else:
        raise ValueError("区域必须是1~8")
    catch_cmd = f"{arm_prefix}CATCHOUT"
    drop_cmd  = f"{arm_prefix}DROPOUT"
    print(f"抓取区域{grab_region} → 自动放置到区域{drop_region}")
    # 1. 先到准备区域
    move_to_region(grab_region)
    # 2. 抓取
    send_cmd_arm(catch_cmd)
    time.sleep(grab_time)
    # 3. 移动到自动匹配的放料区 7/8
    move_to_region(drop_region)
    # 4. 放下
    send_cmd_arm(drop_cmd)
    time.sleep(drop_time)
    # 5. 回到准备位
    move_to_region(prepare_region)
def all_init():
    uart.write(bytearray([0x00, 0x0E, 0x52, 0x6B]))
    send_cmd_arm("RESET")
    time.sleep(0.2)
    move_pos(0x00, 3)
    # send_cmd_arm("RIGHT")
    print("系统已启动")
def all_close():
    # move_pos(0x00, 1)
    # send_cmd_arm("STOP")
    # time.sleep(0.1)
    send_cmd_arm("RESET")
    time.sleep(0.1)
    uart.close()
    uart_arm.close()
def main():
    grab_and_move(3)

if __name__ == "__main__":
    all_init()
    try:
        main()
    except KeyboardInterrupt:
        print("\n停止")
    finally:
        all_close()