#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import cv2
from pyzbar.pyzbar import decode
import requests
import numpy as np
import json
import random
import sys
import time
import os
import pack_in
# ========== 配置 ==========
SERVER_URL   = "http://121.40.169.218/receive_shipment.php"
QUERY_URL    = "http://121.40.169.218/get_slots.php"   # 返回格子状态的接口
TOTAL_SLOTS  = 6          # 格子总数
CAMERA_INDEX = 20
EXIT_AFTER_SCAN = False   # 改为 False 则扫描后继续扫描（会短暂延迟避免重复）
SCAN_INTERVAL = 1.5        # 扫描成功后等待的秒数（仅在 EXIT_AFTER_SCAN=False 时有效）
# =========================

# 获取脚本所在目录的绝对路径
script_dir = os.path.dirname(os.path.abspath(__file__))
calib_path = os.path.join(script_dir, 'calibration_data.npz')

# 加载相机标定参数
try:
    calib_data = np.load(calib_path)
    mtx = calib_data['mtx']
    dist = calib_data['dist']
    print("Calibration data loaded from", calib_path)
except FileNotFoundError:
    print(f"ERROR: calibration_data.npz not found at {calib_path}. Run calibration first.")
    sys.exit(1)

def parse_qr_data(qr_text):
    try:
        data = json.loads(qr_text)
        tracking_number = data.get('tracking_number')
        phone_suffix = data.get('phone_suffix')
        goods = data.get('goods')
        return tracking_number, phone_suffix, goods
    except json.JSONDecodeError:
        print("Failed to parse JSON. QR content must be valid JSON.")
        return None, None, None

def classify_item_by_keywords(item_name):
    if not item_name:
        return '保密发货'
    keywords = {
        '日常生活用品': ['日用品', '文具', '洗漱', '纸巾', '厨具', '清洁', '洗护', '毛巾', '牙膏'],
        '衣服': ['衣服', '服装', '上衣', '裤子', '裙子', '外套', '鞋', '运动鞋', 'T恤', '卫衣'],
        '食物': ['食品', '零食', '饮料', '水果', '蔬菜', '生鲜', '食材', '牛奶', '面包', '方便面',
                 '三只松鼠', '百草味', '良品铺子', '卤藕', '坚果', '饼干', '巧克力',
                 '牛肉干', '肉干', '肉脯', '鱿鱼', '鱼片', '鱼干', '虾片', '海苔',
                 '辣条', '薯片', '薯条', '糖', '蜜饯', '果脯', '鸡爪', '鸭脖',
                 '花生', '瓜子', '葵花籽', '果冻', '软糖', '棒棒糖', '麻辣'],
        '数码电子': ['手机', '平板', '耳机', '充电', '数据线', '快充', '充电宝', '鼠标', '键盘',
                    '显示器', '内存', '硬盘', '路由器', '摄像头', '手环', '智能手环', '手表',
                    '智能手表', '音箱', '蓝牙', '电池', '适配器', '转接', '扩展坞'],
    }
    for cat, kw_list in keywords.items():
        for kw in kw_list:
            if kw in item_name:
                print(f"Keyword '{kw}' detected, category: {cat}")
                return cat
    print("No keyword matched, default to 保密发货")
    return '保密发货'

def get_available_location():
    """
    查询服务器获取空闲格子编号。
    服务器返回 JSON 数组：[{"id":1,"state":0}, ...]
    state=1 表示已取走（空闲可用），state=0 表示有物品（占用）。
    任何情况下无法确认空位则返回 None，禁止入库。
    """
    try:
        resp = requests.get(QUERY_URL, timeout=5)
        if resp.status_code == 200:
            slots = resp.json()
            available = [s["id"] for s in slots if s.get("state") == 1]
            if available:
                chosen = random.choice(available)
                print(f"[INFO] Available slots: {available} → assigned {chosen}")
                return chosen
            else:
                print("[FAIL] All slots occupied, cannot store.")
                return None
        else:
            print(f"[FAIL] Slot query failed (HTTP {resp.status_code}), storage blocked.")
            return None
    except Exception as e:
        print(f"[FAIL] Slot query exception: {e}, storage blocked.")
        return None


ALREADY_EXISTS = "ALREADY_EXISTS"   # send_to_server 的特殊返回值

def send_to_server(tracking_number, phone_suffix, raw_text, category, location):
    data = {
        "tracking_number": tracking_number,
        "phone_suffix": phone_suffix,
        "raw_text": raw_text,
        "category": category,
        "location": location
    }
    try:
        response = requests.post(SERVER_URL, json=data, timeout=5)
        if response.status_code == 200:
            print(f"[OK] Upload success: {response.text}")
            return True
        elif response.status_code == 409:
            print(f"[SKIP] Already in database: {response.text}")
            return ALREADY_EXISTS
        else:
            print(f"[FAIL] HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print(f"[FAIL] Exception: {e}")
        return False

def main():
    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        print(f"Error: cannot open camera {CAMERA_INDEX}")
        sys.exit(1)

    # 获取图像尺寸并预计算畸变校正映射表
    ret, frame = cap.read()
    if not ret:
        print("Cannot read initial frame")
        cap.release()
        sys.exit(1)
    h, w = frame.shape[:2]
    newcameramtx, roi = cv2.getOptimalNewCameraMatrix(mtx, dist, (w, h), 1, (w, h))
    mapx, mapy = cv2.initUndistortRectifyMap(mtx, dist, None, newcameramtx, (w, h), 5)

    print("\n=== Auto QR Scanner (Continuous) ===")
    print("Place QR code in front of camera.")
    print("Program will automatically scan and upload.")
    if EXIT_AFTER_SCAN:
        print("Will exit after successful scan.")
    else:
        print(f"Will remain scanning, wait {SCAN_INTERVAL}s after each success.")
    print("Press 'q' in preview window to quit.\n")

    last_scan_time = 0      # 上次成功扫描的时间（用于非退出模式防重复）
    scanned_set = set()     # 本次运行内已处理的单号（数据库是跨重启去重的真实来源）
    pack_in.send_cmd_arm("RIGHT") #开启传送带
    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        # 畸变校正
        undistorted = cv2.remap(frame, mapx, mapy, cv2.INTER_LINEAR)
        x, y, w_roi, h_roi = roi
        undistorted = undistorted[y:y+h_roi, x:x+w_roi]

        cv2.imshow("QR Auto Scanner - Press 'q' to quit", undistorted)
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break

        # 自动解码（每帧都尝试）
        # 先用原图尝试，失败则用自适应二值化增强对比度后再试
        barcodes = decode(undistorted)
        if not barcodes:
            gray = cv2.cvtColor(undistorted, cv2.COLOR_BGR2GRAY)
            enhanced = cv2.adaptiveThreshold(
                gray, 255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY, 51, 10
            )
            barcodes = decode(enhanced)
        if not barcodes:
            continue

        # 避免在非退出模式下短时间内重复扫描（同一或不同的二维码）
        current_time = time.time()
        if not EXIT_AFTER_SCAN and (current_time - last_scan_time) < SCAN_INTERVAL:
            continue
        last_scan_time = current_time

        # 处理第一个检测到的二维码（通常只有一个）
        for obj in barcodes:
            qr_text = obj.data.decode('utf-8')
            print(f"\n[Scanned] Raw QR data: {qr_text}")

            tracking_number, phone_suffix, goods = parse_qr_data(qr_text)
            if not tracking_number:
                print("Failed to extract tracking_number.")
                continue
            if not phone_suffix:
                print("Failed to extract phone_suffix.")
                continue
            if not goods:
                print("Failed to extract goods name.")
                goods = ""

            print(f"Tracking number: {tracking_number}")
            print(f"Phone suffix: {phone_suffix}")
            print(f"Goods: {goods}")

            if tracking_number in scanned_set:
                print(f"[SKIP] {tracking_number} already uploaded this session, ignoring.")
                continue

            category = classify_item_by_keywords(goods)
            location = get_available_location()
            if location is None:
                print("[FAIL] All slots occupied, skipping this scan.")
                continue
            print(f"Assigned location: {location}")

            result = send_to_server(tracking_number, phone_suffix, goods, category, location)
            if result == ALREADY_EXISTS:
                scanned_set.add(tracking_number)   # 本次内不再重试
            elif result:
                scanned_set.add(tracking_number)

            if EXIT_AFTER_SCAN:
                print("Exiting after successful scan.")
                cap.release()
                cv2.destroyAllWindows()
                sys.exit(0)
            else:
                print(f"Waiting {SCAN_INTERVAL}s before next scan...\n")
                # 等待一段时间再继续，避免同一帧重复触发
                time.sleep(SCAN_INTERVAL)
                break   # 跳出 for 循环，继续 while 循环

    cap.release()
    cv2.destroyAllWindows()
    print("Exit.")

if __name__ == "__main__":
    try:
      main()
    finally:
      pack_in.send_cmd_arm("STOP") #开启传送带