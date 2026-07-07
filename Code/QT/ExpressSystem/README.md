# 快递智能取件系统

> 基于 Qt 5 + MySQL 的嵌入式快递自助取件终端，搭载机械臂与步进电机实现全自动出库

---

## 项目简介

**快递智能取件（ExpressSystem）** 是一套运行在 SpacemiT K1 Muse Pi Pro（RISC-V 嵌入式开发板）触摸屏上的快递自助取件终端。用户凭手机尾号通过数字键盘或 AI 对话自助取件，系统自动驱动机械臂与步进电机将包裹从存储格口搬运至出口区，管理员通过 PIN 码登录后台管理快递记录，所有数据实时同步至云端 MySQL。

UI 采用全局响应式样式表，以 800×480 为基准分辨率，自动按屏幕比例缩放，适配从嵌入式小屏到 1080p 显示器的多种场景。

---

## 功能特性

### 用户端
- **数字键盘自助取件**：输入手机号后 4 位，自动检索名下所有待取快递，确认后驱动机械臂出库
- **信息查询**：支持手机尾号或快递单号模糊搜索，彩色状态徽标显示「待取 / 已取」

### 管理员端
- **PIN 码验证**：6 位数字二次鉴权
- **全览记录**：查看所有快递的单号、手机尾号、商品信息、格口、状态
- **手动取件 / 撤回**：对任意记录执行取件或恢复待取
- **实时刷新**：每 3 秒自动轮询数据库

### AI 助手（OpenClaw）
- **一键取全部包裹**：对话如"手机尾号 1234 帮我取件"，AI 自动查库，一次返回所有待取包裹的动作并依次触发机械臂出库
- **自动查库**：检测到 4 位手机尾号时自动查询数据库并将包裹信息注入上下文
- **结构化响应**：AI 返回 JSON actions 数组，逐一标记已取并调用 motor.py
- **可中断**：请求进行中发送按钮变为红色「取 消」，点击立即终止 openclaw 进程

### 云端 AI 对话（通义千问）
- **自由对话**：接入阿里云通义千问 `qwen-turbo` 模型，用于通用问答，与取件 AI 助手可同时打开
- **多轮对话**：保留完整对话历史，支持上下文连续问答
- **可中断**：请求进行中发送按钮变为红色「取 消」，点击立即中止网络请求并回滚本轮历史

### 系统设置
- **虚拟环境管理**：一键激活 Python 虚拟环境并验证
- **摄像头识别进程**：启动/停止 `scan_json.py`，实时扫码识别快递单并入库
- **大屏显示进程**：启动/停止 `parcel_display.py`，每 3 秒将待取包裹信息推送至淘晶驰串口屏
- **包裹入库进程**：启动/停止 `pack_in.py`，等待传感器信号后读取数据库格口分配并驱动机械臂自动入库

### App 取件联动（pickup_poller.py）
- Qt 启动时自动后台运行 `pickup_poller.py`（`QProcess::startDetached`）
- 每 3 秒轮询服务器待处理取件请求（`pickup_requests` 表中的 pending 条目）
- 发现请求后调用 `motor.py <格口编号>` 驱动步进电机开锁，90 秒超时保护
- 出库完成后回调服务器将请求状态更新为 done，并同步将包裹 `status` 标记为已取走
- 手机 App 通过轮询取件进度接口感知结果，展示成功 / 失败动画弹窗

---

## 硬件架构

```
┌─────────────────────────────────────────────────────┐
│         SpacemiT K1X Muse Pi Pro (RISC-V)           │
│                                                     │
│   Qt 应用                                           │
│    ├── QProcess → ai-tools/motor.py                 │
│    │               └── ai-tools/pack_out_ai.py      │
│    │                    ├── /dev/ttyUSB0  → 步进电机控制器
│    │                    └── /dev/ttyACM0 → 机械臂 RET6 MCU
│    │                                                │
│    └── SettingsDialog → python/pack_in.py           │
│                    ├── /dev/ttyUSB0                 │
│                    └── /dev/ttyACM0                 │
│                                                     │
│   摄像头 → python/scan_json.py → MySQL               │
│   python/parcel_display.py → /dev/ttyS0 串口屏       │
│   python/pickup_poller.py → ai-tools/motor.py       │
│                                                     │
│   OpenClaw → ai-tools/hardware-plugin               │
│               └── ai-tools/hardware_tools.py        │
│                    ├── MySQL（查询/异常工单）          │
│                    ├── ai-tools/motor.py（预约取件）   │
│                    └── /dev/ttyS0（大屏通知）         │
│                                                     │
│   ai-tools/chat_server.py（HTTP 8765）               │
│     → openclaw agent → hardware_tools.py            │
│     → App AI 助手（局域网直连，动态 IP 注册）           │
└─────────────────────────────────────────────────────┘
```

### 格口布局（1–8 号）

| 格口编号 | 步进电机地址 | 放料出口 |
|---|---|---|
| 1、3、5、7（奇数） | 0x01 | 区域 7（左出口） |
| 2、4、6、8（偶数） | 0x02 | 区域 8（右出口） |

### 出库流程

1. Qt 调用 `ai-tools/motor.py <格口编号>`（通过 `QProcess::startDetached`，激活 Python 虚拟环境后执行），`motor.py` 内部调用 `ai-tools/pack_out_ai.py`
2. `all_init()`：步进电机回零 + 机械臂复位（RESET → 移至中位 → RIGHT 姿态）
3. `grab_and_move(region)`：
   - 步进电机移至目标格口
   - 机械臂执行 `CATCHOUT`（抓取），等待 3 秒
   - 步进电机移至出口区（7 或 8）
   - 机械臂执行 `DROPOUT`（放下），等待 3 秒
   - 步进电机返回准备位
4. `all_close()`：步进电机归位 + 机械臂 STOP/RESET + 串口关闭
5. Qt 同步将数据库中对应包裹状态更新为已取（`status = 1`）

---

## 技术栈

| 组件 | 版本 / 说明 |
|---|---|
| Qt | 5.11.3 |
| 编译器 | GCC（RISC-V）/ MinGW 5.3（Windows 调试） |
| 数据库 | MySQL 5.7.43（远程云数据库） |
| Qt 模块 | `core` `gui` `widgets` `sql` `network` |
| AI 助手后端 | OpenClaw（本地 Gateway，CLI 调用） |
| 云端 AI 后端 | 阿里云通义千问 DashScope API（`qwen-turbo`，OpenAI 兼容接口） |
| 硬件接口 | `/dev/ttyUSB0`（步进电机）、`/dev/ttyACM0`（机械臂 RET6） |
| Python 依赖 | `mysql-connector-python`、`pyserial` |
| 构建系统 | qmake |
| 目标平台 | SpacemiT K1 Muse Pi Pro（RISC-V）/ Windows 11 |

---

## 项目结构

```
ExpressSystem/
├── main.cpp                # 应用入口；全局响应式样式表；数据库初始化
├── mainwindow.h/.cpp       # 主窗口：快递取件 / 信息查询 / AI助手 / 本地AI / 管理员
├── pickdialog.h/.cpp       # 自助取件（数字键盘 + 结果列表 + 调用 motor.py）
├── consultdialog.h/.cpp    # 信息查询（模糊搜索 + 结果表格）
├── admindialog.h/.cpp      # 管理员面板（全量列表 + 取件/撤回）
├── pindialog.h/.cpp        # 管理员 PIN 码验证
├── chatdialog.h/.cpp       # AI 助手（OpenClaw CLI，一键取全部包裹 + 调用 motor.py）
├── ollamachatdialog.h/.cpp # 本地 AI 对话（Ollama HTTP API，多轮自由对话）
├── settingsdialog.h/.cpp   # 系统设置（虚拟环境 / 摄像头 / 大屏进程管理）
├── database.h/.cpp         # 数据库访问层（连接、查询、更新）
├── python/                 # Qt 直接启动的后台脚本
│   ├── pack_in.py          # 入库驱动：传感器信号→格口分配→机械臂入库；PID超时自动上报异常
│   ├── scan_json.py        # 摄像头扫码识别，解析后写入数据库
│   ├── parcel_display.py   # 读取数据库，通过串口推送至淘晶驰大屏
│   ├── pickup_poller.py    # App取件联动：每 3 秒轮询服务器 pending 请求，调用 ai-tools/motor.py
│   ├── tracker.py          # 视觉 PID 闭环追踪
│   ├── vision.py           # 图像预处理 + YOLOv8n 推理
│   └── motor_ctrl.py       # 步进电机底层串口控制
└── ai-tools/               # AI 工具库（OpenClaw 插件 + 被 AI/subprocess 调用的脚本）
    ├── hardware_tools.py   # CLI 调度层：query_packages / get_busyness / create_anomaly / prepare_pickup
    ├── chat_server.py      # HTTP 聊天服务（端口 8765）：封装 openclaw agent，供 App AI 助手调用
    ├── motor.py            # 单包裹出库入口：解析格口编号，调用 pack_out_ai.py
    ├── pack_out_ai.py      # 出库硬件驱动核心：步进电机 + 机械臂控制
    ├── db_query.py         # 数据库查询工具（表格/JSON 输出，支持按手机尾号筛选）
    └── hardware-plugin/    # OpenClaw npm 插件
        ├── package.json
        ├── openclaw.plugin.json
        └── src/index.js    # 注册 4 个 AI 工具，调用 hardware_tools.py
└── ExpressSystem.pro       # qmake 项目文件
```

---

## 数据库设计

本项目连接已有的 `shipments` 表，首次启动自动检测并补全缺失字段。

### `shipments` 表核心字段

| 字段名 | 类型 | 说明 |
|---|---|---|
| `id` | INT PK AUTO\_INCREMENT | 主键 |
| `tracking_number` | VARCHAR | 快递单号 |
| `raw_text` | VARCHAR | 商品描述 |
| `category` | VARCHAR | 商品分类 |
| `phone_suffix` | VARCHAR | 手机号（取末 4 位匹配） |
| `location` | VARCHAR(100) | 存放格口编号（1–8） |
| `status` | TINYINT | `0` 待取，`1` 已取 |
| `created_at` | DATETIME | 入库时间 |

---

## 快速开始

### 环境要求

- Qt 5.11.3（含对应工具链）
- MySQL Qt 驱动：`qsqlmysql.dll` / `libqsqlmysql.so` 及 `libmysql`
- Python 3 虚拟环境（`~/demo_env`）
- OpenClaw Gateway（AI 助手功能）
- 阿里云通义千问 API Key（云端 AI 对话功能）
- 硬件：步进电机控制器（`/dev/ttyUSB0`）+ 机械臂控制板（`/dev/ttyACM0`）

### 编译

```bash
qmake ExpressSystem.pro
make
# 或在 Qt Creator 中直接构建
```

### 数据库配置

修改 `database.cpp` 顶部：

```cpp
static const QString DB_HOST = "your.mysql.host";
static const int     DB_PORT = 3306;
static const QString DB_NAME = "your_database";
static const QString DB_USER = "your_user";
static const QString DB_PWD  = "your_password";
```

### AI 助手配置（OpenClaw）

```bash
openclaw gateway status        # 确认 Gateway 运行
openclaw dashboard --no-open   # 查看 Token
```

默认 session-id 为 `express-pickup`，可在 `chatdialog.cpp` 修改：

```cpp
m_proc->start("openclaw", {"agent", "--session-id", "express-pickup", ...});
```

### 云端 AI 配置（通义千问）

前往 [阿里云百炼控制台](https://bailian.console.aliyun.com/) 创建 API Key，填入 `ollamachatdialog.cpp` 顶部：

```cpp
static const QString API_KEY = "sk-xxxxxxxxxxxxxxxx"; // 替换为你的 API Key
```

默认模型为 `qwen-turbo`，可按需改为 `qwen-plus` 等，K1 需能访问公网。

### Python 环境配置

```bash
python3 -m venv ~/demo_env
source ~/demo_env/bin/activate
pip install mysql-connector-python pyserial
```

串口配置（`pack_out_ai.py` / `pack_in.py` 顶部）：

```python
uart     = serial.Serial(port="/dev/ttyUSB0", baudrate=115200, ...)  # 步进电机
uart_arm = serial.Serial(port="/dev/ttyACM0", baudrate=115200, ...)  # 机械臂
```

串口屏配置（`parcel_display.py` 顶部）：

```python
SERIAL_PORT = "/dev/ttyS0"
BAUDRATE    = 115200
```

---

## 使用说明

### 普通用户
1. 主界面点击 **「快递取件」**
2. 键盘输入手机号 **后 4 位**，自动列出所有待取快递
3. 选中记录，点击 **「确认取件」**，机械臂自动将包裹搬运至出口区，数据库标记已取

### 信息查询
1. 主界面点击 **「信息查询」**，输入手机尾号或快递单号
2. 状态以彩色徽标标注（待取 / 已取）

### 管理员
1. 主界面右上角点击 **「管 理 员」**，输入 6 位 PIN 码
2. 管理面板可查看全部记录，每 3 秒自动刷新
3. 点击「取件」或「撤回」执行对应操作

### AI 助手
1. 主界面点击 **「AI 助手」**
2. 输入如"手机尾号 1234 帮我取件"
3. AI 查询数据库，依次驱动机械臂取出所有包裹并标记已取
4. 请求进行中可点击红色**「取 消」**按钮随时中止

### 云端 AI
1. 主界面点击 **「本地 AI」**（按钮名称未变）
2. 与通义千问 `qwen-turbo` 进行多轮自由对话，可与 AI 助手窗口同时打开
3. 请求进行中可点击红色**「取 消」**按钮随时中止，本轮问题自动从历史中移除

### 数据库查询工具
```bash
source ~/demo_env/bin/activate
python3 ai-tools/db_query.py                # 查所有待取包裹
python3 ai-tools/db_query.py --phone 1234   # 按手机尾号筛选
python3 ai-tools/db_query.py --all          # 含已取记录
python3 ai-tools/db_query.py --json         # JSON 格式输出
```

### App AI 助手（chat_server.py）
```bash
# 启动 HTTP 聊天服务（端口 8765，开机由 systemd 自动启动）
python3 ai-tools/chat_server.py

# 手动测试
curl -s -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"message":"现在驿站忙不忙？"}'
```

启动时自动向 `https://red-waltz.top/register_device.php` 上报局域网 IP，App 通过后端中转动态发现 K1 地址，无需手动配置 IP。

### AI 工具库（hardware_tools.py）
```bash
# 查询包裹
python3 ai-tools/hardware_tools.py query_packages --phone 1234
# 驿站忙闲
python3 ai-tools/hardware_tools.py get_busyness
# 出库异常工单（用户反映未收到）
python3 ai-tools/hardware_tools.py create_anomaly --type outbound --phone 1234
# 入库异常工单（PID超时手动模拟）
python3 ai-tools/hardware_tools.py create_anomaly --type inbound --location 3
# 预约取件（eta=0 立即，eta>0 后台倒计时）
python3 ai-tools/hardware_tools.py prepare_pickup --phone 1234 --eta 10
```

### 系统设置
1. 主界面右上角点击 **「设  置」**
2. **虚拟环境**：点击「激活」初始化 Python 环境
3. **摄像头识别**：启动 `scan_json.py` 扫码入库
4. **大屏显示**：启动 `parcel_display.py` 推送包裹信息至串口屏
5. **包裹入库**：启动 `pack_in.py` 驱动机械臂自动入库

---

## 注意事项

- 使用 **qmake** 构建，请勿用 CMake 打开
- MinGW 大函数 + lambda + 长字符串可触发 ICE，解决方案是拆分为小方法
- 全局样式表以 `800×480` 为基准，通过 `qBound(0.8, s, 2.0)` 自动缩放
- 所有 SQL 查询使用参数绑定，已防范 SQL 注入
- `motor.py` 通过 `QProcess::startDetached` 异步执行，Qt 界面不会阻塞等待出库完成；多包裹依次触发时动作为并发，硬件需支持
- 格口编号必须在 1–8 范围内；AI 返回的格口字段支持 `"3"` 或 `"3 号"` 格式，`motor.py` 用正则自动解析
- AI 助手依赖 OpenClaw Gateway 运行；云端 AI 依赖网络连通阿里云 DashScope，需在代码中填入有效 API Key
- AI 助手与云端 AI 对话两个窗口可同时打开，互不阻塞

---

## 模块依赖关系

```
main.cpp
 ├── MainWindow
 │    ├── PickDialog        （自助取件 → ai-tools/motor.py → pack_out_ai.py → 硬件）
 │    ├── ConsultDialog     （信息查询）
 │    ├── ChatDialog        （AI 助手 → OpenClaw → ai-tools/motor.py → 硬件）
 │    ├── OllamaChatDialog  （云端 AI → 通义千问 DashScope API）
 │    ├── AdminDialog       （管理面板）
 │    │    └── PinDialog    （PIN 验证）
 │    └── SettingsDialog    （进程管理：虚拟环境 / 摄像头 / 大屏 / 包裹入库）
 └── database.cpp           （所有对话框共用）

python/pickup_poller.py     （后台常驻 → ai-tools/motor.py）
python/pack_in.py           （入库驱动 → PID超时 → ai-tools/hardware_tools.py create_anomaly）

ai-tools/hardware-plugin    （OpenClaw 插件）
 └── hardware_tools.py      （query_packages / get_busyness / create_anomaly / prepare_pickup）
      ├── MySQL
      ├── ai-tools/motor.py
      └── /dev/ttyS0
```

---

## License

本项目仅供学习与课程展示使用，未经授权请勿用于商业部署。
