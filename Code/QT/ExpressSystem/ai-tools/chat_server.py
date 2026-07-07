#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
K1 快递站 AI 聊天服务 — 直连 DeepSeek API（无 openclaw 进程开销）
端口: 8765
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
import json, subprocess, sys, os, socket, traceback, pathlib, threading, time
import urllib.request, urllib.error

PORT       = 8765
REPORT_URL = "https://red-waltz.top/register_device.php"
SCRIPT_DIR = pathlib.Path(__file__).parent.resolve()
HW_TOOLS   = SCRIPT_DIR / "hardware_tools.py"

# ── DeepSeek API Key 自动检测 ────────────────────────────────────────────────
def _load_api_key():
    # 1. 环境变量
    v = os.environ.get("DEEPSEEK_API_KEY", "")
    if v: return v
    # 2. 常见 openclaw 配置路径
    home = pathlib.Path.home()
    candidates = [
        home / ".openclaw" / "config.json",
        home / ".config" / "openclaw" / "config.json",
        home / ".openclaw.json",
    ]
    for p in candidates:
        try:
            data = json.loads(p.read_text())
            for k in ("deepseekApiKey", "apiKey", "api_key", "DEEPSEEK_API_KEY"):
                val = data.get(k, "")
                if val: return val
            # 嵌套结构: {"deepseek": {"apiKey": "..."}}
            for section in data.values():
                if isinstance(section, dict):
                    for k in ("apiKey", "api_key", "key"):
                        val = section.get(k, "")
                        if val and val.startswith("sk-"): return val
        except Exception:
            pass
    return ""

DEEPSEEK_API_KEY = _load_api_key()
if not DEEPSEEK_API_KEY:
    print("[WARN] 未找到 DeepSeek API Key，请在 systemd service 中添加：")
    print("       Environment=DEEPSEEK_API_KEY=sk-xxxx")

# ── 系统提示 & 工具定义 ──────────────────────────────────────────────────────
SYSTEM_PROMPT = (
    "你是智能快递站AI助手，帮用户查询包裹、了解驿站忙闲、上报异常、预约取件。"
    "回答简洁，使用中文。用户提到手机尾号时主动调用查询工具。"
    "预约取件时必须严格按用户说的时间设置eta_seconds（10秒后=10，5分钟后=300，立即=0），"
    "绝对不能提前执行，即使时间很短也要原样传入。"
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "hw_query_packages",
            "description": "按手机号后4位查询在库包裹列表",
            "parameters": {
                "type": "object",
                "properties": {
                    "phone_suffix": {"type": "string", "description": "手机号后4位数字"}
                },
                "required": ["phone_suffix"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "hw_get_busyness",
            "description": "查询驿站当前忙闲程度（在库包裹数量）",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "hw_create_anomaly",
            "description": "创建出库异常工单（用户反映包裹丢失或未收到）",
            "parameters": {
                "type": "object",
                "properties": {
                    "phone_suffix": {"type": "string", "description": "手机号后4位"},
                    "description":  {"type": "string", "description": "异常描述"}
                },
                "required": ["phone_suffix"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "hw_prepare_pickup",
            "description": "预约取件：驱动机械臂将包裹移至出口区，eta_seconds=0表示立即执行",
            "parameters": {
                "type": "object",
                "properties": {
                    "phone_suffix": {"type": "string", "description": "手机号后4位"},
                    "eta_seconds":  {"type": "integer", "description": "预计到达秒数，0=立即；例如10秒后=10，5分钟后=300"}
                },
                "required": ["phone_suffix"]
            }
        }
    }
]

# ── 工具执行 ─────────────────────────────────────────────────────────────────
def run_tool(name: str, args: dict) -> str:
    if name == "hw_query_packages":
        hw_args = ["query_packages", "--phone", args.get("phone_suffix", "")]
    elif name == "hw_get_busyness":
        hw_args = ["get_busyness"]
    elif name == "hw_create_anomaly":
        hw_args = ["create_anomaly", "--type", "outbound",
                   "--phone", args.get("phone_suffix", "")]
        if args.get("description"):
            hw_args += ["--desc", args["description"]]
    elif name == "hw_prepare_pickup":
        phone = args.get("phone_suffix", "")
        # 兼容旧参数名 eta_minutes（整数分钟）和新参数名 eta_seconds（整数秒）
        if "eta_seconds" in args:
            eta = int(args["eta_seconds"])
        elif "eta_minutes" in args:
            eta = int(args["eta_minutes"]) * 60
        else:
            eta = 0
        if eta > 0:
            def _exec_pickup():
                try:
                    subprocess.run(
                        [sys.executable, str(HW_TOOLS),
                         "prepare_pickup", "--phone", phone],
                        capture_output=True, text=True, timeout=120
                    )
                    print(f"[scheduled_pickup] 尾号{phone} 已执行", flush=True)
                except Exception as e:
                    print(f"[scheduled_pickup] 执行失败: {e}", flush=True)
            t = threading.Timer(eta, _exec_pickup)
            t.daemon = True
            t.start()
            mins = eta // 60
            secs = eta % 60
            time_str = f"{mins}分{secs}秒" if mins else f"{secs}秒"
            return f'{{"scheduled": true, "eta_seconds": {eta}, "phone": "{phone}", "message": "已预约，{time_str}后自动出库"}}'
        hw_args = ["prepare_pickup", "--phone", phone]
    else:
        return f"未知工具: {name}"

    try:
        r = subprocess.run(
            [sys.executable, str(HW_TOOLS)] + hw_args,
            capture_output=True, text=True, timeout=120
        )
        return r.stdout.strip() or r.stderr.strip() or "（无输出）"
    except subprocess.TimeoutExpired:
        return "工具执行超时"
    except Exception as e:
        return f"工具执行失败: {e}"

# ── 会话管理 & 对话 ──────────────────────────────────────────────────────────
_sessions: dict[str, list] = {}

def deepseek_chat(message: str, session_id: str) -> tuple[str, str]:
    if session_id not in _sessions:
        _sessions[session_id] = [{"role": "system", "content": SYSTEM_PROMPT}]

    msgs = _sessions[session_id]
    msgs.append({"role": "user", "content": message})

    for _ in range(4):   # 最多 3 轮 tool call
        payload = json.dumps({
            "model":    "deepseek-chat",
            "messages": msgs,
            "tools":    TOOLS,
            "tool_choice": "auto",
        }, ensure_ascii=False).encode()

        req = urllib.request.Request(
            "https://api.deepseek.com/chat/completions",
            data=payload,
            headers={
                "Content-Type":  "application/json",
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            }
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())

        choice = data["choices"][0]
        msg    = choice["message"]
        msgs.append(msg)

        if choice["finish_reason"] == "tool_calls":
            for tc in msg.get("tool_calls", []):
                fn     = tc["function"]["name"]
                tc_args = json.loads(tc["function"]["arguments"])
                result  = run_tool(fn, tc_args)
                print(f"[tool] {fn}({tc_args}) => {result[:80]}")
                msgs.append({
                    "role":         "tool",
                    "tool_call_id": tc["id"],
                    "content":      result,
                })
        else:
            _sessions[session_id] = msgs[-40:]   # 保留最近 40 条防止过长
            return msg.get("content", "（无回复）"), session_id

    _sessions[session_id] = msgs[-40:]
    return "（工具调用轮次过多，请重试）", session_id

# ── IP 上报 ──────────────────────────────────────────────────────────────────
def report_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        data = json.dumps({"ip": ip}).encode()
        req  = urllib.request.Request(
            REPORT_URL, data=data,
            headers={"Content-Type": "application/json"}
        )
        urllib.request.urlopen(req, timeout=5)
        print(f"[chat_server] IP 已上报: {ip}")
    except Exception as e:
        print(f"[chat_server] IP 上报失败: {e}")

# ── HTTP 服务 ────────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200); self._cors(); self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body   = json.loads(self.rfile.read(length))
            msg    = body.get("message", "").strip()
            sid    = body.get("session_id") or "default"
            if not msg:
                raise ValueError("message 不能为空")

            reply, new_sid = deepseek_chat(msg, sid)

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self._cors(); self.end_headers()
            self.wfile.write(json.dumps(
                {"reply": reply, "session_id": new_sid}, ensure_ascii=False
            ).encode())

        except Exception:
            tb = traceback.format_exc()
            print(tb)
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self._cors(); self.end_headers()
            self.wfile.write(json.dumps({"error": tb[-300:]}).encode())

    def log_message(self, fmt, *args):
        print(f"[http] {fmt % args}")


def _ip_reporter():
    """每 5 分钟重新上报一次 IP，保持 register_device.php 的 10 分钟 TTL 不过期。"""
    while True:
        time.sleep(300)
        report_ip()

if __name__ == "__main__":
    report_ip()
    threading.Thread(target=_ip_reporter, daemon=True).start()
    print(f"[chat_server] listening on 0.0.0.0:{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
