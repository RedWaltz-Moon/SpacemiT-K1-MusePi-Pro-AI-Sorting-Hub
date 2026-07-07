# 速递智管

> 面向快递驿站的包裹全生命周期管理系统

基于 **PHP + MySQL + 原生前端**构建，覆盖包裹入库、货架可视化、取件记录管理、数据分析图表、多角色权限控制等功能。

---

## 功能概览

### 管理员（Web 端）
| 功能 | 说明 |
|------|------|
| 货架总览 | 可视化 6 格货架布局，实时展示包裹数量与占用率 |
| 包裹列表 | 多字段搜索、多列排序、货架筛选、行内展开详情、CSV 导出 |
| 取件记录 | 查看所有已取走包裹，关键字搜索 + 日期范围过滤、CSV 导出 |
| 数据分析 | 货架分布、分类分布、在库时长分桶、近 7 日入库趋势、近 7/8 周取件量 |
| 入库管理 | 单条表单入库 / CSV 批量拖拽导入（前端预览校验） |
| 异常处理 | 查看入库/出库异常工单，编辑处理状态与描述，删除记录，按类型/状态筛选，CSV 导出 |

### 普通用户（Web 端）
- 登录后可在 `profile.html` 个人中心查看与自身手机号绑定的取件历史，并修改密码

### 游客（无需登录）
- 通过 `query.html` 输入手机号即可查询在库包裹及货架位置

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 前端 | HTML5 / CSS3 / JavaScript ES6+（Fetch API，零框架） |
| 数据可视化 | 纯 CSS Flex/Grid + JS 动态宽度（无 ECharts/Chart.js） |
| 主题系统 | CSS Custom Properties + `data-theme` 属性 + `theme.js/theme.css` |
| 后端 | PHP 8.1.32 |
| 数据库 | MySQL 5.7.43，MySQLi Prepared Statement |

---

## 目录结构

```
嵌赛html/
├── auth.php                  # Bearer Token 鉴权中间件
├── cors.php                  # CORS 头（供跨域调用）
├── db.php                    # 数据库连接封装
│
├── login.php                 # 登录（Web Session + Bearer Token 双模式）
├── register.php              # Web 端注册（含验证码）
├── register_app.php          # App 端注册（JSON API）
├── register_push.php         # 注册 Expo Push Token（已登录，写 push_tokens 表）
├── logout.php                # 退出登录（Web）
├── check_session.php         # Web Session 状态检测
├── captcha.php               # SVG 验证码生成
├── forgot_password.html      # 忘记密码页（Web）
├── reset_password.php        # 重置密码（Web，含验证码）
├── reset_password_app.php    # 重置密码（App）
├── change_password.php       # 修改密码（已登录）
│
├── get_shipments.php         # 获取包裹列表（status=0/1/all）
├── get_slots.php             # 查询空闲货架（扫码端）
├── get_stats.php             # 取件量趋势统计
├── add_shipment.php          # 新增包裹
├── update_shipment.php       # 编辑包裹（全字段）
├── delete_shipment.php       # 删除包裹
├── batch_import.php          # CSV 批量导入
├── receive_shipment.php      # 扫码入库确认
├── export_taken.php          # 已取走包裹 CSV 导出
├── query_shipment.php        # 游客快捷查件（无需登录）
│
├── request_pickup.php        # 发起取件请求（写 pickup_requests 表）
├── get_pickup_status.php     # 轮询取件进度（返回 pending/done/failed）
├── get_active_pickups.php    # 获取当前进行中的取件
├── complete_pickup.php       # Qt/Python 端完成取件回写状态
├── get_pickup_pending.php    # Qt/Python 端拉取待处理取件请求
├── revert_pickup.php         # 撤销取件（恢复 status=0，仅管理员）
│
├── get_anomalies.php         # 获取异常工单列表（仅管理员）
├── update_anomaly.php        # 编辑异常工单状态与描述（仅管理员）
├── delete_anomaly.php        # 删除异常工单（仅管理员）
│
├── register_device.php       # K1 设备 IP 注册与查询（App AI 助手动态寻址）
│
├── show.html                 # Web 主控制台
├── login.html                # Web 登录页
├── register.html             # Web 注册页
├── query.html                # 游客查件页
├── profile.html              # 个人中心页
├── forgot_password.html      # 忘记密码页
├── theme.js                  # 深色/浅色主题切换（共用）
└── theme.css                 # 深色模式全局样式（共用）
```

---

## 数据库设计

```sql
CREATE DATABASE IF NOT EXISTS qiansai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE qiansai;

-- 用户表
CREATE TABLE users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    phone         VARCHAR(20)  UNIQUE NOT NULL COMMENT '手机号（登录账号）',
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(50),
    role          VARCHAR(10)  DEFAULT 'user' COMMENT 'admin / user',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bearer Token 表
CREATE TABLE user_tokens (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    token      VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 包裹表
CREATE TABLE shipments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    tracking_number VARCHAR(50)  NOT NULL COMMENT '快递单号',
    phone_suffix    VARCHAR(20)           COMMENT '收件人手机号',
    raw_text        VARCHAR(200)          COMMENT '物品信息',
    category        VARCHAR(50)           COMMENT '分类',
    location        TINYINT               COMMENT '货架位置 1–6',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    phone_last4     VARCHAR(4)            COMMENT '手机号后4位（冗余索引）',
    status          TINYINT DEFAULT 0     COMMENT '0=在库 1=已取走'
);

-- 取件请求队列
CREATE TABLE pickup_requests (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    locker     TINYINT NOT NULL        COMMENT '格口编号 1–8',
    phone      VARCHAR(20),
    status     VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/processing/done/failed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 推送令牌表（存储 Expo Push Token，App 登录后注册，用于推送取件通知）
CREATE TABLE push_tokens (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    phone       VARCHAR(20) NOT NULL           COMMENT '手机号（管理员用 __admin__）',
    expo_token  VARCHAR(255) NOT NULL UNIQUE   COMMENT 'ExponentPushToken[...]',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 异常工单表（入库异常由 pack_in.py PID超时自动写入；出库异常由用户通过飞书/AI工具上报）
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 功能详解

### 深色 / 浅色主题

所有页面引入 `theme.js` 和 `theme.css`：

- `theme.js` 在 `DOMContentLoaded` 时自动向 `<body>` 注入悬浮切换按钮，无需改动各页面 HTML 结构
- 当前主题写入 `html[data-theme]` 属性，`theme.css` 通过属性选择器覆盖所有硬编码颜色
- 偏好存入 `localStorage`，刷新页面或跨标签页保持一致
- 切换时 CSS `transition` 保证颜色平滑过渡（0.25 s ease）

### 忘记密码 / 重置密码

`forgot_password.html` + `reset_password.php`：

- 填写手机号、新密码（×2）和图形验证码后提交
- 复用注册页的 SVG 数学算式验证码（`captcha.php`），有效期 10 分钟、一次性令牌
- 手机号不存在则返回 400，验证码错误则返回 `refresh_captcha: true` 并刷新图片

### 个人中心（`profile.html`）

- 展示当前账号的手机号、角色、显示名称
- 管理员账号屏蔽改密表单，显示说明提示
- 普通用户可在线修改密码（校验旧密码 → 新密码长度 ≥ 6 → 两次一致），成功后 3 秒跳转登录页
- 展示个人取件历史（`get_shipments.php?status=1`），≤ 480 px 切换为卡片视图

### 移动端适配（Web）

所有 Web 页面均针对手机屏幕做了响应式处理。

**登录页 / 注册页 / 忘记密码页**

- Body 水平内边距收窄至 16 px，卡片内边距调整为 `24px 20px`
- 输入框高度提升至 44 px、字号调整为 16 px，防止 iOS Safari 自动缩放
- 注册页 / 忘记密码页验证码图片同步放大至 44 × 100 px

**游客快捷查件页（`query.html`）**

- 手机号输入框与查询按钮默认竖向堆叠（`flex-direction: column`），各占满全宽，不依赖媒体查询，兼容所有屏幕尺寸

**个人中心（`profile.html`）**

- ≤ 480 px：返回按钮占满全宽；输入框高度 44 px / 字号 16 px；取件历史**切换为卡片视图**（隐藏表格）

**主控制台（`show.html`）多断点逐级收缩**

| 断点 | 调整内容 |
|------|---------|
| ≤ 900 px | 统计卡片 4 列 → 2 列；数据分析图表改为单列；分析图表 grid 子项 `min-width: 0` 防止撑宽 |
| ≤ 768 px | 页面内边距收窄；入库表单改为单列 |
| ≤ 680 px | 包裹列表、取件记录、异常处理**切换为卡片视图**（隐藏表格） |
| ≤ 500 px | 统计卡片改为单列；在库时长分桶改为 2 列 |
| ≤ 480 px | 顶部导航栏折叠为两行、标签页横向滚动；工具栏纵向堆叠；日期筛选器纵向堆叠；趋势图横向可滚动（`flex: none` 防止柱子被压缩） |

### 取件记录

包裹取走后将数据库 `status` 字段更新为 `1`（已取走）。主控制台"取件记录"Tab 通过 `get_shipments.php?status=1` 查询并展示历史取件数据，支持关键字搜索和日期范围过滤，可导出为 CSV。

### 数据分析图表

数据分析 Tab 包含六张纯 CSS / JS 图表，均无第三方库依赖：

| 图表 | 类型 | 数据来源 |
|------|------|---------|
| 货架分布 | 水平进度条 | 前端计算（allData） |
| 分类分布 | 水平进度条 | 前端计算 |
| 在库时长分布 | 4 色分桶色块 | 前端实时计算 |
| 近 7 日入库趋势 | 垂直柱状图 | 前端计算 |
| 近 7 日取件量 | 垂直柱状图 | `get_stats.php` |
| 近 8 周取件量 | 垂直柱状图 | `get_stats.php` |

### 验证码机制

注册页与忘记密码页均内置数学算式验证码，服务端生成 SVG 图片并将答案存入 Session：

- 支持加、减、乘三种运算，带随机干扰线与噪点字符
- 有效期 **10 分钟**，验证通过后立即销毁（一次性令牌）
- 无需 `php-gd` 扩展，兼容性更好

### CSV 批量导入

在"入库管理"Tab 可拖拽上传 CSV 文件：

- 前端自定义解析器，正确处理含引号/逗号的字段
- 实时预览表格，**绿行**为合法数据，**红行**为格式错误行
- 仅将合法行提交至服务端，显示导入/跳过计数

CSV 格式参考：

```
tracking_number,phone_suffix,raw_text,category,location
SF1234567890,13812345678,iPhone 15 Pro,日常生活用品,3
JT9876543210,13987654321,冬季外套,衣服,1
```

### 货架与在库时长预警

- 在库时长实时计算并以颜色区分：绿色（< 3 天）/ 橙色（3–7 天）/ 红色（> 7 天）
- 主控制台数据每 **3 秒**自动刷新；页面隐藏时暂停，恢复焦点后立即更新
- 状态栏固定在视口底部，始终显示最后更新时间

### 撤销取件（纠正误取）

管理员在"取件记录"页面对误取包裹点击"撤销取件"，后端调用 `revert_pickup.php`：

- SQL：`UPDATE shipments SET status=0 WHERE id=? AND status=1`
- `AND status=1` 防止重复撤销
- 撤销后包裹重新出现在在库列表，货架格子恢复占用

### 权限体系

```
管理员 (admin)              普通用户 (手机号注册)      游客
    │                           │                    │
查看全部包裹               只见自己的包裹          query.html
增 / 删 / 改（含批量）      只读，无操作按钮         查位置即可
取件记录（全部）+ 撤销       取件记录（自己的）
数据分析                    个人中心（改密）
异常处理（查/编/删/导出）
个人中心
```

---

## 快速部署

### 环境要求

- PHP 8.1.32（需开启 Session）
- MySQL 5.7.43
- Web 服务器：Apache / Nginx（或 `php -S` 开发服务器）

### 1. 服务端（PHP + MySQL）

上传 `嵌赛html/` 目录下所有文件至 Web 根目录，执行「数据库设计」章节的建表 SQL。

以下文件均包含数据库连接参数，按实际修改：

```
db.php（统一连接封装，改这一处即可）
```

```php
$conn = new mysqli('localhost', '用户名', '密码', 'qiansai');
```

```bash
# 开发模式
php -S localhost:8080

# 或配置 Apache / Nginx 指向项目目录
```

浏览器访问 `http://localhost:8080/login.html`

### 2. 默认管理员

| 账号 | 密码 |
|------|------|
| `root` | `123456` |

> 正式部署前请修改默认密码。

---

## 接口速查

### Web / 通用接口
| 接口 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `login.php` | POST | — | 登录（Web返回Session，App返回token） |
| `register.php` | POST | — | Web注册（含验证码） |
| `register_app.php` | POST | — | App注册 |
| `captcha.php` | GET | — | SVG验证码图片 |
| `reset_password.php` | POST | — | Web重置密码（含验证码） |
| `reset_password_app.php` | POST | — | App重置密码 |
| `change_password.php` | POST | 已登录 | 修改密码 |
| `register_push.php` | POST | 已登录 | 注册 Expo Push Token |
| `check_session.php` | GET | — | Web Session检测 |
| `logout.php` | GET | — | 销毁Session |
| `query_shipment.php` | GET | — | 游客查件（无需登录） |

### 包裹接口
| 接口 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `get_shipments.php?status=0` | GET | 已登录 | 在库包裹（用户只见自己的） |
| `get_shipments.php?status=1` | GET | 已登录 | 已取走包裹 |
| `get_shipments.php?status=all` | GET | admin | 全部包裹 |
| `add_shipment.php` | POST | admin | 新增包裹 |
| `update_shipment.php` | POST | admin | 编辑包裹（全字段） |
| `delete_shipment.php` | POST | admin | 删除包裹 |
| `batch_import.php` | POST | admin | CSV批量导入 |
| `receive_shipment.php` | POST | — | 扫码入库确认 |
| `export_taken.php` | GET | 已登录 | 已取走记录CSV导出 |
| `get_slots.php` | GET | — | 查询空闲货架 |
| `get_stats.php` | GET | — | 取件量趋势统计 |

### 取件联动接口
| 接口 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `request_pickup.php` | POST | 已登录 | 发起取件，返回request_id |
| `get_pickup_status.php` | GET | 已登录 | 轮询取件进度 |
| `get_active_pickups.php` | GET | admin | 当前进行中的取件 |
| `get_pickup_pending.php` | GET | — | Qt端拉取待处理请求 |
| `complete_pickup.php` | POST | — | Qt端完成回写状态 |
| `revert_pickup.php` | POST | admin | 撤销取件（恢复在库） |

### 异常处理接口
| 接口 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `get_anomalies.php` | GET | admin | 获取异常工单列表（最近500条） |
| `update_anomaly.php` | POST | admin | 编辑工单：修改处理状态和描述 |
| `delete_anomaly.php` | POST | admin | 删除指定工单 |

### 设备接口
| 接口 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `register_device.php` | POST | — | K1 上报当前局域网 IP（chat_server 启动时调用） |
| `register_device.php` | GET | — | App 查询 K1 当前 IP（10 分钟内有效，过期返回 null） |

---

## 安全设计

| 威胁 | 防护措施 |
|------|---------|
| SQL 注入 | 全部接口使用 Prepared Statement + `bind_param` |
| XSS | 前端 `esc()` 函数对所有动态内容进行 HTML 转义 |
| 越权操作 | Web 端检查 `$_SESSION['role']`，App 端通过 `auth.php` 验证 Bearer Token + role |
| 暴力注册/重置 | 一次性数学验证码 + 10 分钟有效期 |
| 密码泄露 | `password_hash(PASSWORD_DEFAULT)` 存储，`password_verify()` 校验 |
| Token 泄露 | Bearer Token 存于客户端，每次登录生成新 token |

---

## License

本项目为参赛作品，仅供学习与交流使用。
