# 速递智管 · 移动端 App

> 面向快递驿站的包裹全生命周期管理 App（React Native / Expo SDK 56）

---

## 功能概览

### 普通用户
| 功能 | 说明 |
|------|------|
| 在库包裹 | 查看与本账号手机号绑定的所有在库包裹，超 7 天自动弹窗提醒 |
| 一键取件 | 确认后服务端写入取件请求，App 轮询进度，机械臂出库后动画反馈 |
| 取件历史 | 查看已取走的历史包裹记录 |
| 个人中心 | 账号信息、修改密码、开启到站推送通知、退出登录 |

### 管理员（额外功能）
| 功能 | 说明 |
|------|------|
| 货架总览 | 实时可视化 6 格货架，出库格口动态高亮闪烁（每 3 秒轮询） |
| 包裹管理 | 全量在库包裹，搜索、行内编辑、删除；FAB 按钮跳转手动入库 |
| 手动入库 | 填写单号/手机号，点击格口选择器入库 |
| 取件记录 | 所有已取走包裹，支持撤销取件（纠正误操作） |
| 异常处理 | 查看入库/出库异常工单，按类型/状态筛选，编辑处理状态与描述，删除 |
| 数据看板 | 格口分布、分类分布、在库时长、近 7 日 / 近 8 周取件量柱状图 |

### AI 助手（悬浮按钮，用户与管理员均可用）
| 功能 | 说明 |
|------|------|
| 悬浮拖拽按钮 | 直径为屏幕宽 1/6 的圆形按钮，可全屏拖动，默认停靠屏幕右侧距底部 1/3 处 |
| 底部抽屉对话框 | 点击弹出下 3/4 屏聊天面板，上 1/4 暗色遮罩点击关闭，含 ✕ 按钮 |
| 查询包裹 | 告知手机尾号，AI 自动查询在库包裹并报告 |
| 驿站忙闲 | 询问当前在库件数及繁忙程度 |
| 上报异常 | 描述问题，AI 自动创建异常工单 |
| 预约取件 | 告知到达时间，AI 在指定时刻驱动硬件出库并通知大屏 |
| 会话连续 | 同一次打开面板内多轮对话保持上下文（session_id） |

### 游客（无需登录）
- 登录页直接入口，输入手机号查询在库包裹及格口位置

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 框架 | React Native 0.85.3 / Expo SDK 56 |
| 导航 | React Navigation 7（Stack + BottomTabs） |
| 动画 | React Native Animated API（零第三方动画库） |
| 渐变 | expo-linear-gradient |
| 图标 | @expo/vector-icons（Ionicons） |
| 存储 | expo-secure-store（Bearer Token + 用户信息） |
| 推送 | expo-notifications（需 EAS Build 正式 APK） |
| 通信 | Fetch API，JSON over HTTP，Bearer Token 鉴权 |
| 构建 | EAS Build（云端 Android APK / iOS IPA） |
| 热更新 | expo-updates + EAS Update（OTA，无需重新打包） |
| 原生配置 | expo-build-properties（AndroidManifest / build.gradle 修改） |

---

## 项目结构

```
sudizhiguan-app/
├── App.js                          # 入口：导航容器、角色路由、通知 handler、FloatingAIButton
├── app.json                        # Expo 配置（包名、图标、插件、EAS projectId）
├── eas.json                        # EAS Build 配置（preview / production，Android + iOS）
├── src/
│   ├── config.js                   # API 基础 URL
│   ├── api.js                      # 全部 HTTP 接口封装（含异常工单接口）
│   ├── storage.js                  # expo-secure-store 封装（token / user）
│   ├── components/
│   │   └── FloatingAIButton.js     # 悬浮 AI 助手（拖拽 FAB + 底部抽屉对话框）
│   └── screens/
│       ├── LoginScreen.js          # 登录（手机号 + 密码）
│       ├── RegisterScreen.js       # 注册（含客户端数学算式验证码）
│       ├── ForgotPasswordScreen.js # 忘记密码
│       ├── GuestQueryScreen.js     # 游客查件（无需登录）
│       ├── ProfileScreen.js        # 个人中心（改密 / 推送 / 登出）
│       ├── user/
│       │   ├── MyPackagesScreen.js # 在库包裹 + 一键取件 + 动画弹窗
│       │   └── HistoryScreen.js    # 取件历史
│       └── admin/
│           ├── ShelfScreen.js         # 货架总览（实时动画格口）
│           ├── AdminPackagesScreen.js # 包裹管理（搜索/编辑/删除，FAB 入库）
│           ├── AddPackageScreen.js    # 手动入库（格口选择器）
│           ├── PickupRecordsScreen.js # 取件记录（撤销功能）
│           ├── AnomalyScreen.js       # 异常处理（工单列表/筛选/编辑/删除）
│           └── AnalyticsScreen.js     # 数据看板（动画柱状图）
└── assets/                            # 图标与启动图
```

---

## 核心流程

### 一键取件流程

```
用户点击「一键取件」
  → Alert 确认弹窗
  → POST request_pickup.php（写入 pickup_requests 表）
  → 弹出动画 Modal（SpinningRing 旋转等待）
  → 每 2 秒轮询 get_pickup_status.php
  → 硬件端完成出库，status = done
      → Modal 切换为 SuccessCircle 弹跳动画
      → 2.8 秒后自动关闭，刷新列表
  → 或 status = failed / 120 秒超时
      → Modal 切换为 FailCircle 抖动动画
      → 手动关闭
```

### 登录与角色路由

```
App 启动
  → SecureStore 读取 token + user
  → token 存在 → 按 user.role 进入 UserTabs / AdminTabs
  → token 不存在 → 进入 Stack（Login / Register / ForgotPassword / GuestQuery）
```

---

## 构建与发布

### 环境要求

- Node.js 18+
- EAS CLI：`npm install -g eas-cli`
- Expo 账号（expo.dev）

### 本地开发

```bash
npm install
npx expo start
```

### 打包 Android APK

```bash
eas login
eas build --platform android --profile production
```

构建在 Expo 云端完成（约 10–15 分钟），完成后下载 APK 安装即可。

### 打包 iOS IPA

需要 Apple Developer 账号（$99/年）：

```bash
eas build --platform ios --profile production
```

首次构建会提示登录 Apple ID 并自动创建证书和描述文件。

### 两端同时出包

```bash
eas build --platform all --profile production
```

### 热更新（OTA，无需重新打包）

JS 代码修改后可通过 EAS Update 推送，已安装的 App 下次启动自动更新：

```bash
eas update --channel production --message "修复xxx"
```

`runtimeVersion` 策略为 `appVersion`，只有修改了原生代码（app.json 插件、原生模块）才需要重新 EAS Build；纯 JS/资源变更走 OTA 即可。

### 版本更新

每次 EAS Build 前修改 `app.json` 中的版本号：

```json
"version": "1.0.2",
"android": { "versionCode": 4 },
"ios":     { "buildNumber": "4" }
```

`versionCode`（Android）和 `buildNumber`（iOS）必须每次递增。

---

## 接口依赖

服务端地址：`https://red-waltz.top`（`src/config.js`）

| 接口 | 用途 |
|------|------|
| `login.php` | 登录，返回 Bearer Token |
| `register_app.php` | 注册 |
| `reset_password_app.php` | 重置密码 |
| `change_password.php` | 修改密码 |
| `get_shipments.php` | 获取包裹列表（status=0/1） |
| `add_shipment.php` | 新增包裹 |
| `update_shipment.php` | 编辑包裹 |
| `delete_shipment.php` | 删除包裹 |
| `get_slots.php` | 查询空闲格口 |
| `get_stats.php` | 取件量统计 |
| `request_pickup.php` | 发起取件请求 |
| `get_pickup_status.php` | 轮询取件进度 |
| `get_active_pickups.php` | 当前正在出库的格口 |
| `revert_pickup.php` | 撤销取件 |
| `query_shipment.php` | 游客查件 |
| `register_push.php` | 注册推送 Token |
| `get_anomalies.php` | 获取异常工单列表（管理员） |
| `update_anomaly.php` | 编辑工单状态与描述（管理员） |
| `delete_anomaly.php` | 删除异常工单（管理员） |
| `register_device.php` | K1 设备上报 / 查询局域网 IP（AI 助手动态寻址） |

---

## 注意事项

- 推送通知（`expo-notifications`）仅在 EAS Build 正式 APK/IPA 中有效，Expo Go 不支持
- Bearer Token 存储于 `expo-secure-store`，加密保存在设备本地
- 所有网络请求均带 `Authorization: Bearer <token>` Header，服务端统一验证
- AI 助手通过 `register_device.php` 动态获取 K1 局域网 IP，手机与 K1 需在同一网络
- `chat_server.py` 每 5 分钟自动续报 IP，`register_device.php` TTL 10 分钟，长期运行不会过期
- 热更新（`eas update`）仅适用于 JS/资源变更；原生配置变更须重新 EAS Build
- `FloatingAIButton` 渲染在 `NavigationContainer` 外层，确保悬浮层覆盖全部页面
- Android 9+ 默认禁止 HTTP 明文流量，局域网访问 K1 需通过 `expo-build-properties` 插件设置 `usesCleartextTraffic: true`，直接写在 `android` 节无效
