#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hardware_tools.py — AI 硬件工具库 CLI 调度层

用法：
  python3 hardware_tools.py query_packages  --phone LAST4
  python3 hardware_tools.py get_busyness
  python3 hardware_tools.py create_anomaly  --phone LAST4 [--tracking TRACK_NO] [--desc TEXT]
  python3 hardware_tools.py prepare_pickup  --phone LAST4

所有命令输出 JSON 到 stdout；错误信息写 stderr 并以非零退出码退出。
"""

import argparse
import json
import os
import subprocess
import sys

import mysql.connector
import serial

# ── DB ──────────────────────────────────────────────────────────────────────
DB = dict(
    host="121.40.169.218",
    port=3306,
    database="qiansai",
    user="redwaltz",
    password="123456",
    charset="utf8mb4",
)

MOTOR_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "motor.py")
SERIAL_PORT  = "/dev/ttyS0"
STATION_NAME = "K1智能快递站"


def connect():
    return mysql.connector.connect(**DB)


def ok(data):
    print(json.dumps(data, ensure_ascii=False))
    sys.exit(0)


def fmt_dt(dt):
    return dt.strftime('%Y/%m/%d %H:%M:%S') if dt else ''


def err(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


# ── 子命令实现 ───────────────────────────────────────────────────────────────

def cmd_query_packages(phone: str):
    """按手机尾号查询在库包裹（status=0）。"""
    try:
        conn = connect()
    except Exception as e:
        err(f"数据库连接失败: {e}")

    cur = conn.cursor(dictionary=True)
    cur.execute(
        """
        SELECT id, tracking_number, raw_text, category,
               RIGHT(phone_suffix, 4) AS phone_last4,
               location, status, created_at
        FROM shipments
        WHERE RIGHT(phone_suffix, 4) = %s AND status = 0
        ORDER BY id DESC
        """,
        (phone,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    for row in rows:
        row['created_at'] = fmt_dt(row['created_at'])
    ok(rows)


def cmd_get_busyness():
    """统计当前在库包裹数量，返回忙闲等级。"""
    try:
        conn = connect()
    except Exception as e:
        err(f"数据库连接失败: {e}")

    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM shipments WHERE status = 0")
    (count,) = cur.fetchone()
    cur.close()
    conn.close()

    if count <= 3:
        level, msg = "低", f"驿站较空闲，当前在库 {count} 件"
    elif count <= 8:
        level, msg = "中", f"驿站一般繁忙，当前在库 {count} 件"
    else:
        level, msg = "高", f"驿站较繁忙，当前在库 {count} 件，建议错峰取件"

    ok({"count": count, "level": level, "message": msg})


def cmd_create_anomaly(anomaly_type: str, phone: str, tracking: str, desc: str, location_hint: int):
    """记录异常工单。inbound=入库异常（PID超时自动触发），outbound=出库异常（用户反映未收到）。"""
    if anomaly_type == "outbound" and not phone:
        err("出库异常必须提供 --phone")

    try:
        conn = connect()
    except Exception as e:
        err(f"数据库连接失败: {e}")

    cur = conn.cursor(dictionary=True)
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS anomaly_reports (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            `type`          ENUM('inbound','outbound') NOT NULL DEFAULT 'outbound',
            phone_suffix    VARCHAR(20),
            tracking_number VARCHAR(100),
            raw_text        VARCHAR(200),
            category        VARCHAR(50),
            location        INT,
            station_name    VARCHAR(100) DEFAULT 'K1智能快递站',
            description     TEXT,
            status          ENUM('pending','resolved') DEFAULT 'pending',
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )
    # 迁移：表已存在但缺 type 列时补加（忽略"列已存在"错误）
    try:
        cur.execute(
            "ALTER TABLE anomaly_reports "
            "ADD COLUMN `type` ENUM('inbound','outbound') NOT NULL DEFAULT 'outbound' AFTER id"
        )
    except Exception:
        pass

    raw_text = category = ""
    location = location_hint or None

    if anomaly_type == "outbound" and phone:
        # 出库异常：按手机尾号查包裹快照
        cur.execute(
            """
            SELECT tracking_number, raw_text, category, location FROM shipments
            WHERE RIGHT(phone_suffix, 4) = %s
            ORDER BY id DESC LIMIT 1
            """,
            (phone,),
        )
        row = cur.fetchone()
        if row:
            tracking = tracking or row["tracking_number"]
            raw_text  = row["raw_text"]  or ""
            category  = row["category"]  or ""
            location  = location or row["location"]

    elif anomaly_type == "inbound" and location_hint:
        # 入库异常：按目标格口反查包裹快照
        cur.execute(
            """
            SELECT tracking_number, raw_text, category, phone_suffix FROM shipments
            WHERE location = %s
            ORDER BY id DESC LIMIT 1
            """,
            (location_hint,),
        )
        row = cur.fetchone()
        if row:
            tracking = tracking or row["tracking_number"]
            raw_text  = row["raw_text"]  or ""
            category  = row["category"]  or ""
            phone     = phone or (row["phone_suffix"][-4:] if row["phone_suffix"] else "")

    default_desc = "PID追踪超时，包裹未成功入库" if anomaly_type == "inbound" else "出库异常，用户反映未收到包裹"
    cur.execute(
        """
        INSERT INTO anomaly_reports
            (`type`, phone_suffix, tracking_number, raw_text, category, location, station_name, description)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (anomaly_type, phone or "", tracking or "", raw_text, category, location,
         STATION_NAME, desc or default_desc),
    )
    conn.commit()
    ticket_id = cur.lastrowid

    cur.execute(
        "SELECT id, `type`, phone_suffix, tracking_number, raw_text, category, location, "
        "station_name, description, status, created_at "
        "FROM anomaly_reports WHERE id = %s",
        (ticket_id,),
    )
    ticket = cur.fetchone()
    cur.close()
    conn.close()
    ticket['created_at'] = fmt_dt(ticket['created_at'])
    ok(ticket)


def cmd_prepare_pickup(phone: str, eta: int = 0):
    """为指定用户预备包裹：出库 + HC-42 大屏通知。定时逻辑由 chat_server.py 的 Timer 处理，此处始终立即执行。"""

    try:
        conn = connect()
    except Exception as e:
        err(f"数据库连接失败: {e}")

    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT id, location FROM shipments WHERE RIGHT(phone_suffix,4)=%s AND status=0 ORDER BY id",
        (phone,),
    )
    packages = cur.fetchall()
    cur.close()
    conn.close()

    if not packages:
        ok({"packages_prepared": 0, "results": [], "message": "未找到在库包裹"})

    results = []
    done_ids = []
    for pkg in packages:
        locker = pkg["location"]
        try:
            proc = subprocess.run(
                [sys.executable, MOTOR_SCRIPT, str(locker)],
                timeout=90,
                capture_output=True,
                text=True,
            )
            success = proc.returncode == 0
        except subprocess.TimeoutExpired:
            success = False
        results.append({"package_id": pkg["id"], "locker": locker, "success": success})
        if success:
            done_ids.append(pkg["id"])

    # 出库成功的包裹更新 status=1（已取走）
    if done_ids:
        try:
            conn2 = connect()
            cur2 = conn2.cursor()
            fmt = ",".join(["%s"] * len(done_ids))
            cur2.execute(f"UPDATE shipments SET status=1 WHERE id IN ({fmt})", done_ids)
            conn2.commit()
            cur2.close()
            conn2.close()
        except Exception as e:
            print(f"[hardware_tools] 更新包裹状态失败: {e}", file=sys.stderr)

    # HC-42 大屏通知（瞬时，parcel_display.py 3 秒后覆盖）
    try:
        with serial.Serial(SERIAL_PORT, 115200, timeout=1) as ser:
            n = len(packages)
            msg = f't10.txt="尾号{phone}的{n}件包裹已就绪，请前往出口取件"'
            ser.write(msg.encode("gbk") + b"\xff\xff\xff")
    except Exception:
        pass

    ok({
        "packages_prepared": len(packages),
        "results": results,
        "message": f"已处理 {len(packages)} 件包裹",
    })


# ── 入口 ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="AI 硬件工具库")
    sub = parser.add_subparsers(dest="cmd")

    p1 = sub.add_parser("query_packages")
    p1.add_argument("--phone", required=True, metavar="LAST4")

    sub.add_parser("get_busyness")

    p3 = sub.add_parser("create_anomaly")
    p3.add_argument("--type",     default="outbound", choices=["inbound", "outbound"], dest="anomaly_type")
    p3.add_argument("--phone",    default="",    metavar="LAST4")
    p3.add_argument("--tracking", default="",    metavar="TRACK_NO")
    p3.add_argument("--desc",     default="",    metavar="TEXT")
    p3.add_argument("--location", type=int, default=0, metavar="LOCKER")

    p4 = sub.add_parser("prepare_pickup")
    p4.add_argument("--phone", required=True, metavar="LAST4")
    p4.add_argument("--eta",   type=int, default=0, metavar="MINUTES")

    args = parser.parse_args()

    if args.cmd == "query_packages":
        cmd_query_packages(args.phone)
    elif args.cmd == "get_busyness":
        cmd_get_busyness()
    elif args.cmd == "create_anomaly":
        cmd_create_anomaly(args.anomaly_type, args.phone, args.tracking, args.desc, args.location)
    elif args.cmd == "prepare_pickup":
        cmd_prepare_pickup(args.phone, args.eta)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
