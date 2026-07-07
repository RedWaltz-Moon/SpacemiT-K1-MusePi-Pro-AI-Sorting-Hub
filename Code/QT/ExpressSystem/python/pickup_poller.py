"""
pickup_poller.py — 手机取件请求轮询脚本
每 3 秒查询一次服务器 pickup_requests 表，发现 pending 请求后调用 motor.py 执行出库，
完成后回调服务器标记请求完成并更新包裹状态为已取走。

集成方式：在 Qt 应用 MainWindow 构造函数中加一行：
    QProcess::startDetached("python3", {QCoreApplication::applicationDirPath() + "/../python/pickup_poller.py"});
或直接在终端运行：python3 pickup_poller.py
"""

import time
import requests
import subprocess
import sys
import os
import fcntl

SERVER       = "https://red-waltz.top"
API_KEY      = "qt-polling-key-2024"
POLL_URL     = f"{SERVER}/get_pickup_pending.php?key={API_KEY}"
COMPLETE_URL = f"{SERVER}/complete_pickup.php"

MOTOR_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ai-tools", "motor.py")

# ── 进程锁：防止多实例并发执行同一格口 ────────────────────────────────────────
_LOCK_PATH = "/tmp/pickup_poller.lock"
_lock_fd   = None

def _acquire_process_lock():
    global _lock_fd
    _lock_fd = open(_LOCK_PATH, "w")
    try:
        fcntl.flock(_lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except IOError:
        print("[pickup_poller] 已有实例在运行，退出", flush=True)
        sys.exit(0)

# ── 本次进程内去重：防止 mark_complete 失败后同一请求被重复执行 ──────────────
_done_ids: set = set()


def execute_pickup(locker: int) -> bool:
    """调用 motor.py <格口编号> 执行出库，返回是否成功。"""
    try:
        result = subprocess.run(
            [sys.executable, MOTOR_SCRIPT, str(locker)],
            timeout=90,
            capture_output=True,
            text=True,
        )
        if result.stdout:
            print(f"[motor] {result.stdout.strip()}", flush=True)
        if result.returncode != 0:
            print(f"[motor] 出错: {result.stderr.strip()}", flush=True)
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        print(f"[pickup_poller] motor.py 超时（90s），locker={locker}", flush=True)
        return False
    except Exception as e:
        print(f"[pickup_poller] 调用 motor.py 异常: {e}", flush=True)
        return False


def mark_complete(request_id: int, success: bool):
    """通知服务器标记请求完成 / 失败，并将 shipment.status 更新为已取走。"""
    try:
        resp = requests.post(
            COMPLETE_URL,
            json={"key": API_KEY, "request_id": request_id, "success": success},
            timeout=5,
        )
        resp.raise_for_status()
    except Exception as e:
        print(f"[pickup_poller] 回调 complete_pickup 失败: {e}", flush=True)


def poll_once():
    """查询一次 pending 请求列表，只执行最新的一条，其余积压请求立即标记为 failed。"""
    try:
        resp = requests.get(POLL_URL, timeout=5)
        resp.raise_for_status()
        pending = resp.json()
    except Exception as e:
        print(f"[pickup_poller] 查询失败: {e}", flush=True)
        return

    if not pending:
        return

    # 按 id 升序排列，最大 id = 最新请求
    pending_sorted = sorted(pending, key=lambda r: int(r["id"]))

    # 旧积压请求（除最新一条外）：直接标记 failed，不执行硬件
    for old_req in pending_sorted[:-1]:
        rid = int(old_req["id"])
        if rid not in _done_ids:
            _done_ids.add(rid)
            mark_complete(rid, success=False)
            print(f"[pickup_poller] 清理积压请求 #{rid}（标记 failed）", flush=True)

    # 只执行最新的一条
    req        = pending_sorted[-1]
    request_id = int(req["id"])
    locker     = int(req["locker"])
    phone      = req.get("phone", "")
    package_id = req.get("package_id", "")

    if request_id in _done_ids:
        return
    _done_ids.add(request_id)

    print(f"[pickup_poller] 处理取件 #{request_id}: package={package_id} locker={locker} phone={phone}", flush=True)

    success = execute_pickup(locker)
    mark_complete(request_id, success)

    status = "完成" if success else "失败"
    print(f"[pickup_poller] 取件{status} #{request_id}", flush=True)


def run_poller(interval: float = 3.0):
    """持续轮询，interval 秒检查一次。Ctrl+C 退出。"""
    print(f"[pickup_poller] 启动，间隔 {interval}s，motor.py={MOTOR_SCRIPT}", flush=True)
    while True:
        poll_once()
        time.sleep(interval)


if __name__ == "__main__":
    _acquire_process_lock()
    run_poller()
