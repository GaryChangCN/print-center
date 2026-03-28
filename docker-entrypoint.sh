#!/bin/bash
set -e

echo "🚀 启动打印中心容器..."

# ── 1. 启动 CUPS ────────────────────────────────────────────
# /etc/cups 已从宿主机挂载（复用旧配置），不覆写 cupsd.conf
echo "⚙️  启动 CUPS（使用已有配置）..."

# 确保 cupsd.conf 允许本地应用访问（IPP 走 localhost:631）
# 如果旧配置只监听 socket，补上 localhost 监听
if ! grep -q "Listen.*631" /etc/cups/cupsd.conf 2>/dev/null; then
  echo "Listen localhost:631" >> /etc/cups/cupsd.conf
fi

service cups start
echo "⏳ 等待 CUPS 启动..."
sleep 3

# ── 2. 确认打印机 ─────────────────────────────────────────
PRINTER_NAME="${PRINTER_NAME:-Brother_DCP-1618W}"

if lpstat -a 2>/dev/null | grep -q "^${PRINTER_NAME}"; then
  echo "✅ 打印机 ${PRINTER_NAME} 已就绪（来自旧配置）"
else
  echo "⚠️  打印机 ${PRINTER_NAME} 不在 CUPS 中，尝试自动注册..."

  USB_URI=$(lpinfo -v 2>/dev/null | grep -i "brother\|usb" | head -1 | awk '{print $2}' || true)
  if [ -n "$USB_URI" ]; then
    PPD=$(lpinfo -m 2>/dev/null | grep -i "brlaser" | head -1 | awk '{print $1}' || true)
    if [ -n "$PPD" ]; then
      lpadmin -p "$PRINTER_NAME" -E -v "$USB_URI" -m "$PPD" -o media=A4 2>/dev/null || true
    else
      lpadmin -p "$PRINTER_NAME" -E -v "$USB_URI" -o media=A4 2>/dev/null || true
    fi
    lpadmin -d "$PRINTER_NAME" 2>/dev/null || true
    echo "   ✅ 打印机已注册"
  else
    echo "   ⚠️  未发现 USB 打印机"
  fi
fi

# ── 3. 注册扫描仪（brscan4）────────────────────────────────
echo "🔍 检测扫描仪..."

# brscan4 USB 扫描仪通常自动检测，这里做一次确认
if command -v brsaneconfig4 &>/dev/null; then
  # 检查是否已注册
  if ! brsaneconfig4 -q 2>/dev/null | grep -qi "DCP"; then
    brsaneconfig4 -a name=DCP-1618W model=DCP-1618W 2>/dev/null || true
    echo "✅ 扫描仪已注册到 brscan4"
  else
    echo "✅ 扫描仪已存在"
  fi
fi

# ── 4. 启动 Node.js 应用 ────────────────────────────────────
echo "🌐 启动 Web 服务..."
exec node /app/dist/server/index.js
