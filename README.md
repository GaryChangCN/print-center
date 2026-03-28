# Print Center / 打印中心

个人打印中心 —— 基于 NAS 的打印机 & 扫描仪 Web 管理工作台。

通过 USB 将多功能一体机连接到 NAS，在局域网内任何设备（Windows / macOS / Android / iOS）的浏览器上即可完成打印、扫描、证件扫描、PDF 处理等操作。内置 CUPS 打印服务和 SANE 扫描服务，同时支持 AirPrint / IPP 协议 —— macOS 和 iOS 可直接添加为系统打印机，Windows、Android 可通过 IPP 添加网络打印机。

<!-- 截图放在 docs/screenshots/ 目录下 -->
<!-- ![主界面](docs/screenshots/print.png) -->

## 功能特性

**打印**
- 上传 PDF / 图片 / Word / Excel，设置份数、纸张、方向等参数
- 实时显示打印机连接状态和打印队列
- 上传进度条 + 阶段提示

**扫描**
- 单页扫描 / 多页扫描合并为 PDF
- 支持 DPI、色彩模式、纸张大小、输出格式设置
- 多页模式支持拖拽排序、逐页编辑和删除
- 扫描设备互斥锁，防止多端并发冲突

**图片编辑**
- 扫描后直接进入全屏编辑器
- 裁剪、旋转（90°/180°/270°）、水平/垂直翻转
- 亮度和对比度调节
- 纯前端 Canvas 实现，零延迟

**证件扫描**
- 引导式正反面扫描（扫正面 → 翻面 → 扫反面 → 自动合成）
- 正反面合成到 A4 页面，可直接打印或下载

**PDF 工具**
- 页面排序 / 删除（拖拽操作）
- 多文件合并
- 按页码范围拆分

**历史记录**
- 打印和扫描历史查看
- 支持重新打印和下载
- 自动清理过期记录（默认 30 天）

## 界面预览

| 打印 | 扫描 | 证件扫描 |
|:---:|:---:|:---:|
| ![打印](docs/screenshots/print.png) | ![扫描](docs/screenshots/scan.png) | ![证件扫描](docs/screenshots/idcard.png) |

| PDF 工具 | 历史记录 |
|:---:|:---:|
| ![PDF工具](docs/screenshots/pdf-tools.png) | ![历史记录](docs/screenshots/history.png) |

## 技术架构

```
┌─────────────────────────────────────────────┐
│              Docker 容器                      │
│                                               │
│  浏览器 (React + Tailwind CSS)                │
│      │ HTTP                                   │
│      v                                        │
│  Node.js (Hono)  <──>  SQLite                │
│      │                                        │
│      ├── IPP 二进制协议 ──> CUPS (打印)        │
│      │                         │              │
│      ├── scanimage ──────> SANE (扫描)        │
│      │                         │              │
│      v                         v              │
│              USB 打印机/扫描仪                 │
│         (Brother DCP-1618W)                   │
└─────────────────────────────────────────────┘
```

CUPS 和 SANE 运行在同一个容器内，共享 USB 设备，避免多容器抢占 USB 的问题。

### 为什么手写 IPP 协议？

本项目没有使用任何 CUPS/IPP 第三方库，而是直接构建 IPP 二进制报文通过 HTTP 与 CUPS 通信。原因是现有的 `ipp` npm 包要求 Node.js < 4，无法在现代 Node.js 上运行。

```
IPP 报文结构:
┌──────────┬───────────┬───────────┐
│ 版本 2B  │ 操作码 2B │ 请求ID 4B │  ← 头部 8 字节
├──────────┴───────────┴───────────┤
│ 操作属性 (charset, printer-uri)  │
│ 任务属性 (copies, media, ...)    │
│ 属性结束标记                      │
├──────────────────────────────────┤
│ 文件数据 (PDF/图片)               │
└──────────────────────────────────┘
```

支持的 IPP 操作：
- `Print-Job` (0x0002) — 提交打印任务
- `Get-Printer-Attributes` (0x000b) — 查询打印机状态
- `Get-Jobs` (0x000a) — 查询打印队列

### 技术选型

| 组件 | 技术 | 说明 |
|------|------|------|
| 前端 | React 18 + Tailwind CSS | 移动端优先的响应式 UI |
| 后端 | Hono + Node.js 22 | 轻量全栈框架 |
| 打印 | CUPS + 手写 IPP 协议 | 无第三方 IPP 库依赖 |
| 扫描 | SANE + scanimage | Linux 通用扫描框架 |
| 图片编辑 | Canvas API | 纯前端，裁剪/旋转/亮度调节 |
| PDF 处理 | pdf-lib | 服务端排序/合并/拆分 |
| 证件合成 | sharp | 服务端图像合成 |
| 数据库 | SQLite (better-sqlite3) | WAL 模式，零配置 |

## 部署

### 前置条件

- NAS 或 Linux 主机，已安装 Docker + Docker Compose
- USB 多功能一体机（打印 + 扫描）

### 1. 准备目录

```bash
mkdir -p /volume1/docker/print-center/{app,cups,data}
```

### 2. 上传代码到 `app/` 目录

### 3. 查找 USB 设备路径

```bash
lsusb | grep -i brother
# → Bus 003 Device 002: ID 04f9:0398 Brother Industries, Ltd DCP-1618W
```

根据输出修改 `docker-compose.yml` 中的 `devices` 路径。

### 4. 构建并启动

```bash
cd /volume1/docker/print-center/app
docker compose up -d --build
```

### 5. 访问

浏览器打开 `http://你的NAS地址:3100`

### 已有 CUPS 配置迁移

如果之前已有 CUPS 容器，可以复用打印机配置：

```bash
# 复制旧配置
cp -r /volume1/docker/cups /volume1/docker/print-center/cups

# 停止旧容器（释放 USB）
docker stop cups

# 启动新容器
cd /volume1/docker/print-center/app
docker compose up -d --build
```

### docker-compose.yml 示例

```yaml
services:
  print-center:
    build: .
    image: print-center:latest
    container_name: print-center
    restart: unless-stopped
    ports:
      - "3100:3000"
    volumes:
      - /volume1/docker/print-center/data:/app/data
      - /volume1/docker/print-center/cups:/etc/cups
    environment:
      - CUPS_SERVER=http://localhost:631
      - PRINTER_NAME=Brother_DCP-1618W
    devices:
      - /dev/bus/usb/003:/dev/bus/usb/003
    privileged: true
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | Web 服务端口 |
| `CUPS_SERVER` | `http://localhost:631` | CUPS 地址（容器内） |
| `PRINTER_NAME` | `Brother_DCP-1618W` | 打印机名称 |
| `MOCK_MODE` | `false` | 模拟模式，无需真实硬件 |
| `DATA_DIR` | `/app/data` | 数据存储目录 |
| `MAX_FILE_SIZE` | `50` | 最大上传文件大小（MB） |
| `HISTORY_RETENTION_DAYS` | `30` | 历史记录保留天数 |

## 本地开发

```bash
npm install

# 复制环境变量模板
cp .env.example .env
# 设置 MOCK_MODE=true 可无需真实硬件

npm run dev
# 前端: http://localhost:5173
# 后端: http://localhost:3001
```

## 目录结构

```
src/
├── client/                    # React 前端
│   ├── components/
│   │   ├── layout/            # 布局、导航
│   │   ├── print/             # 打印模块
│   │   ├── scan/              # 扫描模块
│   │   ├── idcard/            # 证件扫描
│   │   ├── editor/            # 图片编辑器
│   │   ├── pdf/               # PDF 工具
│   │   ├── history/           # 历史记录
│   │   └── shared/            # 通用组件
│   └── lib/                   # API 客户端、工具函数、类型
└── server/                    # Hono 后端
    ├── routes/                # API 路由
    ├── services/              # 业务逻辑（CUPS、扫描、PDF、清理）
    ├── services/mock/         # Mock 服务（开发用）
    └── db/                    # SQLite 数据库
```

## 支持的设备

理论上支持所有 CUPS 兼容的 USB 打印机和 SANE 兼容的 USB 扫描仪。已测试：

- **Brother DCP-1618W**（打印 + 扫描）

## 相关协议

- [IPP - Internet Printing Protocol (RFC 8011)](https://datatracker.ietf.org/doc/html/rfc8011)
- [CUPS - Common UNIX Printing System](https://www.cups.org/)
- [SANE - Scanner Access Now Easy](http://www.sane-project.org/)

## License

MIT
