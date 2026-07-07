#!/usr/bin/env python3
"""
db_query.py — 快递柜数据库查询工具

用法：
  python3 db_query.py                    # 显示所有包裹
  python3 db_query.py --phone 6316       # 按手机尾号查待取包裹
  python3 db_query.py --all              # 显示所有包裹（含已取）
  python3 db_query.py --json             # 以 JSON 格式输出
  python3 db_query.py --phone 6316 --json
"""

import sys
import json
import argparse
import mysql.connector

DB = dict(
    host="121.40.169.218",
    port=3306,
    database="qiansai",
    user="redwaltz",
    password="123456",
    charset="utf8mb4",
)


def connect():
    return mysql.connector.connect(**DB)


def fetch_all(conn, include_picked=False):
    sql = """
        SELECT id, tracking_number, raw_text, category,
               RIGHT(phone_suffix, 4) AS phone_last4,
               location, status,
               DATE_FORMAT(created_at, '%Y/%m/%d %H:%i:%s') AS created_at
        FROM shipments
    """
    if not include_picked:
        sql += " WHERE status = 0"
    sql += " ORDER BY id DESC"
    cur = conn.cursor(dictionary=True)
    cur.execute(sql)
    rows = cur.fetchall()
    cur.close()
    return rows


def fetch_by_phone(conn, phone_last4):
    sql = """
        SELECT id, tracking_number, raw_text, category,
               RIGHT(phone_suffix, 4) AS phone_last4,
               location, status,
               DATE_FORMAT(created_at, '%Y/%m/%d %H:%i:%s') AS created_at
        FROM shipments
        WHERE RIGHT(phone_suffix, 4) = %s AND status = 0
        ORDER BY id
    """
    cur = conn.cursor(dictionary=True)
    cur.execute(sql, (phone_last4,))
    rows = cur.fetchall()
    cur.close()
    return rows


def print_table(rows):
    if not rows:
        print("（无记录）")
        return
    headers = ["ID", "快递单号", "商品", "格口", "手机尾号", "状态", "入库时间"]
    status_map = {0: "待取", 1: "已取"}
    data = [
        [
            str(r["id"]),
            r["tracking_number"],
            r["raw_text"][:16] + ("…" if len(r["raw_text"]) > 16 else ""),
            str(r["location"]),
            r["phone_last4"],
            status_map.get(r["status"], str(r["status"])),
            r["created_at"],
        ]
        for r in rows
    ]
    widths = [max(len(h), max(len(d[i]) for d in data)) for i, h in enumerate(headers)]
    sep = "+" + "+".join("-" * (w + 2) for w in widths) + "+"
    fmt = "|" + "|".join(f" {{:<{w}}} " for w in widths) + "|"
    print(sep)
    print(fmt.format(*headers))
    print(sep)
    for row in data:
        print(fmt.format(*row))
    print(sep)
    print(f"共 {len(rows)} 条记录")


def main():
    parser = argparse.ArgumentParser(description="快递柜数据库查询")
    parser.add_argument("--phone", metavar="LAST4", help="按手机尾号查待取包裹")
    parser.add_argument("--all",  action="store_true", help="包含已取包裹")
    parser.add_argument("--json", action="store_true", help="JSON 格式输出")
    args = parser.parse_args()

    try:
        conn = connect()
    except Exception as e:
        print(f"数据库连接失败：{e}", file=sys.stderr)
        sys.exit(1)

    try:
        if args.phone:
            rows = fetch_by_phone(conn, args.phone)
        else:
            rows = fetch_all(conn, include_picked=args.all)
    finally:
        conn.close()

    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        print_table(rows)


if __name__ == "__main__":
    main()
