#!/usr/bin/env bash
# Mula stack OpenBot lengkap dalam satu bekas awan (Render):
#   1. Pelayan MCP Malaysia (port 4210) - carta organisasi & data Malaysia
#   2. Mock Intelligence (port 19100 awan, 19099 laluan setempat) - ganti CopilotKit Intelligence untuk deployment ini
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

# Lepaskan port yang masih dipegang SESIAPA SAJA: cari pendengar (LISTEN) melalui /proc/net/tcp,
# petakan inode soket kepada PID melalui /proc/*/fd, hentikan pemegangnya. Padanan cmdline di atas
# hanya jumpa proses but lama yang arahannya dikenali; ini juga menjumpai pemegang yang tidak
# dikenali - dan log barisnya mendedahkan siapa dia sebelum dihentikan. 19099 turut dibersihkan
# kerana deployment lama memegangnya.
bebas_port() {
  local port="$1" nama="$2" hex inode fd pid
  hex="$(printf '%04X' "$port")"
  for inode in $(awk -v p=":${hex}" '$2 ~ p"$" && $4 == "0A" {print $10}' /proc/net/tcp /proc/net/tcp6 2>/dev/null | sort -u); do
    for fd in /proc/[0-9]*/fd/*; do
      if [ "$(readlink "$fd" 2>/dev/null)" = "socket:[$inode]" ]; then
        pid="${fd#/proc/}"
        pid="${pid%%/*}"
        if [ "$pid" != "$$" ] && [ "$pid" != "$PPID" ]; then
          echo "[cloud] port $nama dipegang PID $pid ($(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | cut -c1-160)) - dihentikan"
          kill "$pid" 2>/dev/null || true
        fi
        break
      fi
    done
  done
}
sleep 1

echo "[cloud] migrasi database (Supabase)..."
(cd server && bun scripts/migrate.ts) || { echo "[cloud] migrasi gagal - deploy dihenti"; exit 1; }

echo "[cloud] mula pelayan MCP Malaysia di 4210..."
bebas_port 4210 "4210"
bun examples/malaysia/mcp/server.ts &

echo "[cloud] mula mock Intelligence di 19100..."
bebas_port 19100 "19100"
bebas_port 19099 "19099 (lama)"
export INTELLIGENCE_MOCK_PORT=19100
bun examples/malaysia/intelligence-mock.ts &
mock_pid=$!
sleep 2
if ! kill -0 "$mock_pid" 2>/dev/null; then
  echo "[cloud] AMARAN: mock Intelligence mati serta-merta selepas mula - lihat ralat di atas"
fi

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
