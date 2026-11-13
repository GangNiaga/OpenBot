#!/usr/bin/env bash
# Mula stack OpenBot lengkap dalam satu bekas awan (Render):
#   1. Pelayan MCP Malaysia (port 4210) - carta organisasi & data Malaysia
#   2. Mock Intelligence (port 19099) - ganti CopilotKit Intelligence untuk deployment ini
#   3. Pelayan OpenBot (port $PORT) - API + WebSocket AG-UI (foreground)
# Selepas pelayan siap, bootstrap daftar MCP Malaysia + beri geran alat kepada semua Bot.
set -uo pipefail
cd "$(dirname "$0")/.."

echo "[cloud] mula pelayan MCP Malaysia di 4210..."
bun examples/malaysia/mcp/server.ts &

echo "[cloud] mula mock Intelligence di 19099..."
bun examples/malaysia/intelligence-mock.ts &

(
  # Bootstrap MCP Malaysia selepas pelayan siap (idempoten, bukan fatal jika gagal)
  for i in $(seq 1 90); do
    sleep 2
    if curl -sf "http://127.0.0.1:${PORT:-3001}/health" > /dev/null 2>&1; then
      OPENBOOT_SERVER_URL="http://127.0.0.1:${PORT:-3001}" bun examples/malaysia/bootstrap.ts && exit 0
    fi
  done
  echo "[cloud] bootstrap MCP tidak siap dalam masa diberi (bukan fatal; boleh dijalankan semula)"
) &

echo "[cloud] mula pelayan OpenBot di ${PORT:-3001}..."
exec bun server/src/index.ts
