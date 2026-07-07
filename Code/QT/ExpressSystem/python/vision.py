#!/usr/bin/env python3
import ctypes, os, glob

import onnxruntime as _ort_tmp
_capi_dir = os.path.join(os.path.dirname(_ort_tmp.__file__), 'capi')
for _so in glob.glob(os.path.join(_capi_dir, 'libonnxruntime*.so*')):
    ctypes.CDLL(_so, mode=ctypes.RTLD_GLOBAL)

import spacemit_ort
import cv2
import numpy as np
import onnxruntime as ort
from threading import Thread, Lock

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "best_qdq.onnx")
INPUT_SIZE = 320
CONF_THRESHOLD = 0.5
MIN_AREA = 500

_session = None


def _create_minimal_onnx():
    from onnx import helper, TensorProto
    X = helper.make_tensor_value_info('X', TensorProto.FLOAT, [1])
    Y = helper.make_tensor_value_info('Y', TensorProto.FLOAT, [1])
    node = helper.make_node('Identity', ['X'], ['Y'])
    graph = helper.make_graph([node], 'init', [X], [Y])
    m = helper.make_model(graph, opset_imports=[helper.make_opsetid('', 11)])
    m.ir_version = 7
    return m.SerializeToString()


_init_sess = ort.InferenceSession(_create_minimal_onnx())


def load_model(path=MODEL_PATH):
    global _session
    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    _session = ort.InferenceSession(path, opts, providers=["SpaceMITExecutionProvider"])
    dummy = np.zeros((1, 3, INPUT_SIZE, INPUT_SIZE), np.float32)
    for _ in range(10):
        _session.run(None, {_session.get_inputs()[0].name: dummy})
    print(f"视觉模型已加载  EP:{_session.get_providers()}")


def _letterbox(img):
    """等比缩放 + 灰边填充到 INPUT_SIZE×INPUT_SIZE，返回图像及还原参数。"""
    h, w = img.shape[:2]
    scale = INPUT_SIZE / max(h, w)
    nh, nw = int(h * scale), int(w * scale)
    img_r = cv2.resize(img, (nw, nh))
    pad_h = (INPUT_SIZE - nh) // 2
    pad_w = (INPUT_SIZE - nw) // 2
    canvas = np.full((INPUT_SIZE, INPUT_SIZE, 3), 114, dtype=np.uint8)
    canvas[pad_h:pad_h + nh, pad_w:pad_w + nw] = img_r
    return canvas, scale, pad_w, pad_h


def detect_offset(frame):
    """
    返回物块质心相对画面中心的像素偏差。
    正值：物块在画面右侧；负值：在左侧。
    无物块返回 None。
    """
    if _session is None:
        raise RuntimeError("未加载模型，请先调用 vision.load_model()")

    h, w = frame.shape[:2]
    img_lb, scale, pad_w, pad_h = _letterbox(frame)

    blob = img_lb[:, :, ::-1].transpose(2, 0, 1).astype(np.float32) / 255.0
    blob = blob[np.newaxis, ...]

    raw = _session.run(None, {_session.get_inputs()[0].name: blob})[0]

    preds = raw[0].T
    mask = preds[:, 4] >= CONF_THRESHOLD
    preds = preds[mask]
    if len(preds) == 0:
        return None

    best_i = np.argmax(preds[:, 4])
    best = preds[best_i]

    area_orig = (best[2] / scale) * (best[3] / scale)
    if area_orig < MIN_AREA:
        return None

    cx_orig = (best[0] - pad_w) / scale
    return int(cx_orig) - w // 2


def draw_overlay(frame, arm_mm, offset_px, block_mm=None):
    """在画面上叠加坐标系信息。"""
    h, w = frame.shape[:2]
    cx = w // 2
    cv2.line(frame, (cx, 0), (cx, h), (0, 255, 0), 1)

    if offset_px is not None:
        bx = cx + offset_px
        cv2.line(frame, (bx, 0), (bx, h), (0, 0, 255), 2)
        text = f"offset:{offset_px:+d}px"
        if block_mm is not None:
            text += f"  BLOCK:{block_mm:.1f}mm"
        cv2.putText(frame, text, (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

    cv2.putText(frame, f"ARM:{arm_mm:.1f}mm", (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    return frame


class CameraGrabber:
    """多线程摄像头抓取，保证帧同步。
    使用方式：
        cam = CameraGrabber(id)   # 打开设备、配置参数（不启动抓取线程）
        cam.start()               # 启动后台抓取线程
        frame = cam.read()        # 读取最新帧
        cam.stop()                # 停止
    """
    def __init__(self, cam_id, width=320, height=240, fps=10):
        print(f"=== CameraGrabber v3 init cam={cam_id} (release_after) ===", flush=True)
        self.cam_id = cam_id
        self.width = width
        self.height = height
        self.fps = fps
        self.cap = None
        self.frame = None
        self.lock = Lock()
        self.running = False
        self._fail_count = 0
        self.thread = None

        # 初始化时只验证设备并配置参数，然后立即释放，不保持 V4L2 流。
        # 否则两个设备的流会同时占用 USB 带宽，导致第二个设备无法读取帧。
        self._open_device(release_after=True)

    def _open_device(self, release_after=False):
        """打开并配置摄像头。release_after=True 时配置完立即释放（用于 __init__）"""
        import time
        self.cap = cv2.VideoCapture(self.cam_id, cv2.CAP_V4L2)
        if not self.cap.isOpened():
            raise RuntimeError(f"摄像头 {self.cam_id} 打开失败")

        # 1) 先设置分辨率，再设置 FOURCC
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self.cap.set(cv2.CAP_PROP_FPS, self.fps)

        # 2) 尝试 MJPG，回读检查是否实际生效
        fourcc_mjpg = cv2.VideoWriter_fourcc('M', 'J', 'P', 'G')
        self.cap.set(cv2.CAP_PROP_FOURCC, fourcc_mjpg)
        time.sleep(0.05)
        actual_fourcc = int(self.cap.get(cv2.CAP_PROP_FOURCC))
        self._mjpg_active = (actual_fourcc == fourcc_mjpg)
        fourcc_name = (
            chr(actual_fourcc & 0xFF) +
            chr((actual_fourcc >> 8) & 0xFF) +
            chr((actual_fourcc >> 16) & 0xFF) +
            chr((actual_fourcc >> 24) & 0xFF)
        )
        actual_w = self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        actual_h = self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        print(f"[CAM {self.cam_id}] 实际参数: {actual_w:.0f}x{actual_h:.0f}  "
              f"FOURCC={fourcc_name}  MJPG={'OK' if self._mjpg_active else '未生效'}", flush=True)

        # 不支持 MJPG 且分辨率太高时降分辨率
        if not self._mjpg_active and (actual_w > 320 or actual_h > 240):
            print(f"[CAM {self.cam_id}] MJPG 不支持，降低分辨率到 320x240 以节省 USB 带宽", flush=True)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)

        # 3) 丢弃前几帧，让摄像头稳定
        for _ in range(5):
            ret, _ = self.cap.read()
            if not ret:
                time.sleep(0.05)

        if release_after:
            self.cap.release()
            self.cap = None
            print(f"[CAM {self.cam_id}] 设备验证完成，已释放（等待 resume）", flush=True)

    def start(self):
        """启动后台抓取线程（在所有摄像头配置完成后调用）"""
        if self.thread is not None:
            return
        self.running = True
        self.thread = Thread(target=self._grab, daemon=True)
        self.thread.start()
        print(f"[CAM {self.cam_id}] 抓取线程已启动", flush=True)

    def pause(self):
        """暂停抓取：停止线程并释放设备以释放 USB 带宽"""
        if self.thread is None:
            return
        self.running = False
        self.thread.join(timeout=2.0)
        self.thread = None
        self.cap.release()
        self.frame = None
        print(f"[CAM {self.cam_id}] 抓取已暂停", flush=True)

    def resume(self):
        """恢复抓取：重新打开设备并启动线程"""
        if self.thread is not None:
            return
        self._open_device()
        self.start()

    def is_active(self):
        """返回当前是否正在抓取"""
        return self.thread is not None and self.thread.is_alive()

    def _reconnect(self):
        """尝试关闭并重新打开摄像头"""
        import time
        try:
            self.cap.release()
        except Exception:
            pass
        time.sleep(0.3)
        try:
            self._open_device()
            self._fail_count = 0
            print(f"[CAM {self.cam_id}] 重连成功", flush=True)
            return True
        except RuntimeError:
            print(f"[CAM {self.cam_id}] 重连失败，稍后重试...", flush=True)
            return False

    def _grab(self):
        import time
        while self.running:
            ret, frame = self.cap.read()
            if ret:
                with self.lock:
                    self.frame = frame
                self._fail_count = 0
            else:
                self._fail_count += 1
                # 连续 50 次（约 0.25s）读不到帧，尝试重连
                if self._fail_count >= 50:
                    print(f"[CAM {self.cam_id}] 连续读取失败 {self._fail_count} 次，尝试重连...", flush=True)
                    if not self._reconnect():
                        time.sleep(1.0)
                    continue
                time.sleep(0.005)

    def read(self):
        with self.lock:
            return self.frame.copy() if self.frame is not None else None

    def stop(self):
        self.running = False
        if self.thread is not None:
            self.thread.join(timeout=2.0)
            self.thread = None
        if self.cap is not None:
            self.cap.release()
            self.cap = None
