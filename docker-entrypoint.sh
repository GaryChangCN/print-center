#!/bin/bash
set -e

ARCH=$(uname -m)
echo "=== Print Center starting (arch: $ARCH) ==="

# ── 1. D-Bus (SANE 依赖) ─────────────────────────────────
if [ -S /run/dbus/system_bus_socket ]; then
  echo "[dbus] already running"
else
  mkdir -p /run/dbus
  dbus-daemon --system --fork 2>/dev/null || true
  echo "[dbus] started"
fi

# ── 2. 启动 CUPS ────────────────────────────────────────────
# /etc/cups 已从宿主机挂载（复用旧配置），不覆写 cupsd.conf
echo "[cups] starting..."

# 确保 cupsd.conf 允许本地应用访问（IPP 走 localhost:631）
if ! grep -q "Listen.*631" /etc/cups/cupsd.conf 2>/dev/null; then
  echo "Listen localhost:631" >> /etc/cups/cupsd.conf
fi

service cups start
sleep 3

# ── 3. 确认打印机 ─────────────────────────────────────────
PRINTER_NAME="${PRINTER_NAME:-Brother_DCP-1618W}"

if lpstat -a 2>/dev/null | grep -q "^${PRINTER_NAME}"; then
  echo "[cups] printer ${PRINTER_NAME} ready"
else
  echo "[cups] printer ${PRINTER_NAME} not found, auto-registering..."

  USB_URI=$(lpinfo -v 2>/dev/null | grep -i "brother\|usb" | head -1 | awk '{print $2}' || true)
  if [ -n "$USB_URI" ]; then
    PPD=$(lpinfo -m 2>/dev/null | grep -i "brlaser" | head -1 | awk '{print $1}' || true)
    if [ -n "$PPD" ]; then
      lpadmin -p "$PRINTER_NAME" -E -v "$USB_URI" -m "$PPD" -o media=A4 2>/dev/null || true
    else
      lpadmin -p "$PRINTER_NAME" -E -v "$USB_URI" -o media=A4 2>/dev/null || true
    fi
    lpadmin -d "$PRINTER_NAME" 2>/dev/null || true
    echo "[cups] printer registered"
  else
    echo "[cups] WARNING: no USB printer found"
  fi
fi

# ── 4. 扫描仪 ───────────────────────────────────────────────
if [ "$ARCH" = "x86_64" ]; then
  # x86: 使用 brscan4 驱动
  echo "[scan] x86_64 detected, configuring brscan4..."
  if command -v brsaneconfig4 &>/dev/null; then
    if ! brsaneconfig4 -q 2>/dev/null | grep -qi "DCP"; then
      brsaneconfig4 -a name=DCP-1618W model=DCP-1618W 2>/dev/null || true
      echo "[scan] scanner registered via brscan4"
    else
      echo "[scan] scanner already registered"
    fi
  else
    echo "[scan] WARNING: brsaneconfig4 not found"
  fi
else
  # ARM: 通过 QEMU 运行 x86_64 的 brscan4
  echo "[scan] ARM detected, using QEMU for brscan4..."
  if command -v qemu-x86_64-static &>/dev/null; then
    # 注册 brscan4 扫描仪
    if ! qemu-x86_64-static /usr/bin/brsaneconfig4 -q 2>/dev/null | grep -qi "DCP"; then
      qemu-x86_64-static /usr/bin/brsaneconfig4 -a name=DCP-1618W model=DCP-1618W 2>/dev/null || true
      echo "[scan] scanner registered via brscan4 (QEMU)"
    else
      echo "[scan] scanner already registered"
    fi
    # 验证扫描设备
    SCANNER=$(qemu-x86_64-static /usr/bin/scanimage -L 2>/dev/null | head -1 || true)
    if [ -n "$SCANNER" ]; then
      echo "[scan] scanner found: $SCANNER"
    else
      echo "[scan] WARNING: scanner not detected, will retry on first scan request"
    fi
  else
    echo "[scan] WARNING: qemu-user-static not installed, scanning unavailable on ARM"
  fi
fi

# ── 5. 启动 Node.js 应用 ────────────────────────────────────
echo "[app] starting web server..."
exec node /app/dist/server/index.js
