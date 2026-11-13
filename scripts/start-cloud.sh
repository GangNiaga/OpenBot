#!/usr/bin/env bash
# Mula stack OpenBot lengkap dalam satu bekas awan (Render):
#   1. Pelayan MCP Malaysia (port 4210) - carta organisasi & data Malaysia
#   2. Mock Intelligence (port 19099) - ganti CopilotKit Intelligence untuk deployment ini
#   3. Pelayan OpenBot (port $PORT) - API + WebSocket AG-UI (foreground)
# Selepas pelayan siap, bootstrap daftar MCP Malaysia + beri geran alat kepada semua Bot.
set -uo pipefail
cd "$(dirname "$0")/.."

# Proses lama boleh masih hidup: Render mula semula entrypoint dalam bekas yang sama bila ia
# mengesan port baharu ("Restarting deploy to update network configuration"), dan proses latar
# belakang (&) milik but sebelumnya tidak mati bersama PID 1. Mereka pegang 4210/19099/10000 dan
# but baharu mati dengan EADDRINUSE. Bunuh sebelum apa-apa dimulakan, supaya setiap but mengikat
# dengan bersih.
#
# `pkill` tiada dalam imej (procps tidak dipasang), jadi imbas /proc terus: baca cmdline setiap
# proses, padankan corak, bunuh PID-nya. Corak tidak akan padankan skrip ini sendiri
# (/bin/bash scripts/start-cloud.sh) atau ibu bapanya.
for pattern in "examples/malaysia/mcp/server.ts" "examples/malaysia/intelligence-mock.ts" "src/index.ts"; do
  for proc in /proc/[0-9]*/cmdline; do
    if tr '\0' ' ' < "$proc" 2>/dev/null | grep -qF "$pattern"; then
      pid="${proc#/proc/}"
      pid="${pid%/cmdline}"
      if [ "$pid" != "$$" ] && [ "$pid" != "$PPID" ]; then
        kill "$pid" 2>/dev/null || true
      fi
    fi
  done
done
sleep 1

echo "[cloud] migrasi database (Supabase)..."
(cd server && bun scripts/migrate.ts) || { echo "[cloud] migrasi gagal - deploy dihenti"; exit 1; }

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
# Dari direktori `server`, bukan akar repo: TENANT_PACKAGE_DIR (`../examples/malaysia`) dan
# lalaiannya (`../examples/fintech`) adalah laluan relatif kepada `server/`, sama seperti cara
# migrasi di atas dijalankan. Jika tidak, tenant package dibaca dari luar repo dan boot mati.
cd server
exec bun src/index.ts
