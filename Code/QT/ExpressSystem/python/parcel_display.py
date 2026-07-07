#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
读取数据库中的包裹信息，通过 HC-42 蓝牙模块发送到淘晶驰串口屏显示。
显示规则：按 id 降序取前3条（status=0 的未处理包裹），
          a0/a1/a2 分别显示 id，
          b0/b1/b2 分别显示 location，
          t0/t1/t2 分别显示 raw_text（商品信息）。
"""

import serial
import sys
import time
import mysql.connector   # 需要安装：pip3 install mysql-connector-python

# ========== 配置区 ==========
# 串口配置
SERIAL_PORT = "/dev/ttyS0"
BAUDRATE = 115200
END_BYTES = b'\xff\xff\xff'

# 数据库配置
DB_CONFIG = {
    'host': '121.40.169.218',
    'user': 'redwaltz',
    'password': '123456',
    'database': 'qiansai'
}

# 表名单独定义
TABLE_NAME = 'shipments'

# 刷新间隔（秒）
REFRESH_INTERVAL = 3

# 屏幕最大显示行数
MAX_ROWS = 3

# ========== 辅助函数 ==========
def send_command(ser, cmd_str):
    """发送屏幕指令（自动添加结束符）"""
    data = cmd_str.encode('gbk') + END_BYTES
    ser.write(data)
    print(f"[发送] {cmd_str}")

def fetch_latest_parcels():
    """从数据库获取最新的3条 status=0 的记录，按 id 降序"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)   # 只传连接参数
        cursor = conn.cursor(dictionary=True)
        query = f"""
            SELECT id, raw_text, location
            FROM {TABLE_NAME}
            WHERE status = 0
            ORDER BY id DESC
            LIMIT {MAX_ROWS}
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"[数据库错误] {e}")
        return []

def update_screen(ser, parcels):
    """
    根据查询结果更新屏幕控件。
    parcels 是一个列表，每个元素是 dict，包含 id, raw_text, location。
    第0条（id最大）对应第1行（a0,b0,t0），第1条对应第2行，依此类推。
    """
    # 先清空未使用的行（如果本次查到的记录少于3条）
    for i in range(MAX_ROWS):
        if i < len(parcels):
            p = parcels[i]
            # 设置 id (数字控件)
            send_command(ser, f"a{i}.val={p['id']}")
            # 设置 location (数字控件)
            send_command(ser, f"b{i}.val={p['location']}")
            # 设置商品信息 (文本控件，注意转义双引号)
            text = p['raw_text'].replace('"', '\\"')   # 转义内部双引号
            send_command(ser, f"t{i}.txt=\"{text}\"")
        else:
            # 无数据时清空显示（可选）
            send_command(ser, f"a{i}.val=0")
            send_command(ser, f"b{i}.val=0")
            send_command(ser, f"t{i}.txt=\"\"")
        time.sleep(0.05)   # 避免瞬间发送过多指令

def main():
    # 1. 初始化串口
    try:
        ser = serial.Serial(
            port=SERIAL_PORT,
            baudrate=BAUDRATE,
            timeout=1
        )
        print(f"[OK] 串口 {SERIAL_PORT} 打开成功 (波特率 {BAUDRATE})")
    except Exception as e:
        print(f"[ERROR] 无法打开串口 {SERIAL_PORT}: {e}")
        sys.exit(1)

    # 2. 等待 HC-42 稳定
    time.sleep(0.5)

    print(f"开始实时监控数据库表 {TABLE_NAME}，每 {REFRESH_INTERVAL} 秒刷新一次...")
    try:
        while True:
            parcels = fetch_latest_parcels()
            if parcels:
                print(f"[信息] 获取到 {len(parcels)} 条记录，ID: {[p['id'] for p in parcels]}")
                update_screen(ser, parcels)
            else:
                # 无待处理包裹，清空屏幕显示
                print("[信息] 无待处理包裹，清空屏幕")
                update_screen(ser, [])
            time.sleep(REFRESH_INTERVAL)
    except KeyboardInterrupt:
        print("\n[提示] 用户中断，正在退出...")
    finally:
        ser.close()
        print("[OK] 串口已关闭")

if __name__ == "__main__":
    main()
