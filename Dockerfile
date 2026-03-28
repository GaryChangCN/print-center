# ╔══════════════════════════════════════════════════════════════╗
# ║  打印中心 - 全合一镜像                                      ║
# ║  包含: CUPS (打印) + SANE (扫描) + Node.js (Web)            ║
# ║  ARM: ipp-usb + sane-airscan 替代 brscan4                  ║
# ║  USB 只透传一次，CUPS 和 SANE 在容器内共享，不冲突          ║
# ╚══════════════════════════════════════════════════════════════╝

# ── 构建阶段：编译 Node.js 应用 ─────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --registry=https://registry.npmmirror.com

COPY . .
RUN npm run build

# ── 生产阶段：最终镜像 ──────────────────────────────────────
FROM debian:bookworm-slim AS production

# ---------- 系统依赖 ----------
RUN apt-get update && apt-get install -y --no-install-recommends \
    # CUPS 打印服务
    cups \
    cups-bsd \
    cups-client \
    cups-filters \
    # brlaser: 开源 Brother 激光打印机驱动（支持 DCP-1618W）
    printer-driver-brlaser \
    # SANE 扫描框架
    sane \
    sane-utils \
    libsane \
    # ipp-usb + sane-airscan：ARM 上替代 brscan4 的扫描方案
    ipp-usb \
    sane-airscan \
    # USB 工具
    usbutils \
    libusb-1.0-0 \
    # LibreOffice (Office 文档转 PDF)
    libreoffice-writer-nogui \
    libreoffice-calc-nogui \
    # 工具
    wget \
    curl \
    ca-certificates \
    ghostscript \
    # 运行时
    procps \
  && rm -rf /var/lib/apt/lists/*

# ---------- Node.js 22 ----------
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

# ---------- Brother brscan4 SANE 后端 ----------
# 注：brscan4 仅提供 amd64/i386 官方包
# ARM 平台（NAS）如无法安装，扫描功能改用 SANE 通用后端
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "amd64" ]; then \
      wget -q -O /tmp/brscan4.deb \
        "https://download.brother.com/welcome/dlf105200/brscan4-0.4.11-1.amd64.deb" \
      && dpkg -i /tmp/brscan4.deb \
      && rm /tmp/brscan4.deb; \
    else \
      echo "Non-amd64 arch, skipping brscan4"; \
    fi

# ---------- CUPS 权限 ----------
# 允许在容器内不需要认证操作打印机
RUN usermod -aG lp root \
  && usermod -aG lpadmin root

# ---------- 复制 Node.js 应用 ----------
WORKDIR /app

# 只复制生产依赖
COPY package*.json ./
RUN npm ci --omit=dev --registry=https://registry.npmmirror.com \
  && npm cache clean --force

# 复制构建产物
COPY --from=builder /app/dist ./dist

# 数据目录
RUN mkdir -p /app/data/uploads /app/data/scans

# ---------- 入口脚本 ----------
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
# EXPOSE 631  # 如需暴露 CUPS Web 界面可开启

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV CUPS_SERVER=http://localhost:631
ENV PRINTER_NAME=Brother_DCP-1618W
ENV MOCK_MODE=false

CMD ["/docker-entrypoint.sh"]
