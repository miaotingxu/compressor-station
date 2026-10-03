#!/bin/bash
# 空压站多机协同智能调度 Agent —— 停止脚本
# 通过 ss 提取监听端口的 PID 并 kill（不使用 fuser/lsof）
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 0

PORT=5173

# 通过 ss 提取监听指定端口的 PID
port_pids() {
  ss -ltnp | grep -F ":${PORT} " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u
}

pids="$(port_pids)"
if [ -z "$pids" ]; then
  echo "[stop] 服务未运行（端口 ${PORT}）"
  exit 0
fi

for pid in $pids; do
  echo "[stop] 终止进程 ${pid}"
  kill "$pid"
done

# 等待端口释放
for _ in $(seq 1 30); do
  if [ -z "$(port_pids)" ]; then
    echo "[stop] 服务已停止"
    exit 0
  fi
  sleep 1
done

# 仍未释放则强制终止
for pid in $(port_pids); do
  echo "[stop] 强制终止进程 ${pid}"
  kill -9 "$pid"
done
echo "[stop] 服务已强制停止"
exit 0
