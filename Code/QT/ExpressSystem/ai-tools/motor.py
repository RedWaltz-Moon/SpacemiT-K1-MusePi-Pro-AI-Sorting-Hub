#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
单包裹出库：从指定格口取件并送至出口区。
调用方式：python3 motor.py <格口编号>
格口编号：1-8（支持 "2" 或 "2 号" 格式）
"""

import sys
import re
from pack_out_ai import all_init, all_close, grab_and_move


def parse_region(arg: str) -> int:
    m = re.search(r'\d+', arg)
    if not m:
        print(f"[ERROR] 无法解析格口编号: {arg}", file=sys.stderr)
        sys.exit(1)
    region = int(m.group())
    if not 1 <= region <= 8:
        print(f"[ERROR] 格口编号超出范围(1-8): {region}", file=sys.stderr)
        sys.exit(1)
    return region


def main():
    if len(sys.argv) < 2:
        print("用法: python3 motor.py <格口编号>", file=sys.stderr)
        sys.exit(1)

    region = parse_region(sys.argv[1])
    print(f">>> 开始出库，格口 {region}", flush=True)

    all_init()
    try:
        grab_and_move(region)
        print(f">>> 格口 {region} 取件完成", flush=True)
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        all_close()


if __name__ == "__main__":
    main()
