#!/bin/bash
# 空压站多机协同智能调度 Agent —— 启动脚本（生产模式）
# 端口固定 5173
# 返回码：已启动=0；启动成功=0；启动失败=2
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 2

PORT=5173
LOG_FILE="$SCRIPT_DIR/server.log"

# 通过 ss 提取监听指定端口的 PID（不使用 fuser/lsof）
port_pids() {
  ss -ltnp | grep -F ":${PORT} " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u
}

# 1) 已启动则直接返回 0
if [ -n "$(port_pids)" ]; then
  echo "[start] 服务已在运行（端口 ${PORT}），无需重复启动"
  exit 0
fi

# 2) 清理构建缓存，避免陈旧产物
rm -rf dist node_modules/.vite

# 3) 生产构建
echo "[start] 正在生产构建 ..."
if ! npm run build > "$LOG_FILE" 2>&1; then
  echo "[start] 构建失败，日志：$LOG_FILE"
  exit 2
fi

# 4) 启动生产预览服务
#    不使用 timeout；环境变量先 export 再 nohup，避免被当成命令名
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=1024"
nohup npm run preview >> "$LOG_FILE" 2>&1 &
disown

# 5) 轮询端口就绪（最多等待 60 秒）
for _ in $(seq 1 60); do
  if [ -n "$(port_pids)" ]; then
    echo "[start] 启动成功：http://localhost:${PORT}/"
    exit 0
  fi
  sleep 1
done

echo "[start] 启动失败：端口 ${PORT} 未就绪，日志：$LOG_FILE"
exit 2
