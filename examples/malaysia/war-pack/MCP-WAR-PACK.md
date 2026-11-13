# MCP War-Pack — Registry Pelayan MCP Disahkan (Research Nov 2025)

Registry ini disahkan melalui GitHub REST API semasa research (Nov 2025); semua repositori yang disenaraikan disahkan wujud dan aktif pada masa research. Ini bukan jaminan masa depan — sahkan semula sebelum memasang.

## Cara daftar ke OpenBot

- **Admin > Plugins** — antara muka admin untuk pelayan MCP yang disokong.
- **`POST /api/plugins/servers/custom`** — pelayan awam sahaja (mesti **HTTPS**).
- **Entri katalog first-party** — untuk pelayan tempatan sendiri (HTTP), tambah entri katalog first-party; corak rujukan: entri `malaysia` di `http://127.0.0.1:4210/mcp`.

## A. Lokal dulu — tanpa kunci API (self-hosted, keyless)

| Repositori | Kegunaan | Bintang (★) | Lesen | Nota |
| --- | --- | --- | --- | --- |
| `modelcontextprotocol/servers` | filesystem, fetch, memory, sequential-thinking, time, git | 91k+ | MIT | Rujukan rasmi pelayan MCP; aktif |
| `microsoft/playwright-mcp` | Automasi pelayar (Playwright) | 39k+ | Apache-2.0 | |
| `ChromeDevTools/chrome-devtools-mcp` | Inspeksi dan debug Chrome | 55k+ | Apache-2.0 | |
| `bytebase/dbhub` | Postgres/MySQL/SQLite | 3.8k+ | MIT | |
| `basicmachines-co/basic-memory` | Memori berbasis fail markdown | 4.5k+ | AGPL-3.0 | Perakuan: semak lesen sebelum redistribute |
| `docker/mcp-gateway` | Isolasi kontainer + pengurusan secret | 1.6k+ | MIT | |

## B. Penyelidikan web (tier percuma)

| Repositori | Kegunaan | Bintang (★) | Lesen |
| --- | --- | --- | --- |
| `firecrawl/firecrawl-mcp-server` | Merangkak dan menganalisis halaman web | 7.8k | MIT |
| `tavily-ai/tavily-mcp` | Carian web | 2.5k | MIT |
| `exa-labs/exa-mcp-server` | Carian semantik | 5.2k | MIT |
| `brave/brave-search-mcp-server` | Carian web Brave | 1.5k | MIT |

## C. Perusahaan/kod

| Repositori | Kegunaan | Bintang (★) | Lesen |
| --- | --- | --- | --- |
| `github/github-mcp-server` | Repositori, isu dan PR GitHub | 34k | MIT |
| `upstash/context7` | Dokumentasi segar untuk pustaka/kod | 64k | MIT |
| `oraios/serena` | Pelayan MCP kod semantik | 31k | Semak lesen sebelum guna |
| `czlonkowski/n8n-mcp` | Automasi aliran kerja n8n | 23k | MIT |
| `getsentry/toolkit` | Sentry MCP | aktif | |
| `korotovsky/slack-mcp-server` | Integrasi Slack | 1.9k | MIT |

## D. Elak (tidak valid)

| Repositori | Sebab | Alternatif |
| --- | --- | --- |
| `mem0ai/mem0-mcp` | Diarkibkan 2026-03 | |
| `modelcontextprotocol/servers-archived` | sqlite/postgres/puppeteer/slack digantikan oleh pelayan rasmi | |
| `linear/linear-mcp-server` | 404 semasa research — sahkan manual sebelum guna | `tacticlaunch/mcp-linear` |
| `supabase-community/supabase-mcp` | 404 semasa research — sahkan manual sebelum guna | `alexander-zuev/supabase-mcp-server` |
| `stripe/stripe-agent-toolkit` | 404 semasa research — sahkan manual sebelum guna | |

## Keselamatan (daripada kajian komuniti HN/Reddit 2025-2026)

- **Tool-result poisoning** — kandungan hasil alat boleh menyuntik arahan; jangan percaya output alat secara membuta tuli.
- **Harness-level approvals** — kelulusan di peringkat harness; OpenBot sudah ada mekanisme ini: geran alat + dasar + audit.
- **Elak geran blanket** — jangan beri semua alat kepada semua Bot; geran ikut kemahiran (rujukan alat ialah pengisytiharan, bukan geran).
- **Imbasan sebelum aktifkan** — guna MCP-Scanner atau MCP-Shield ke atas pelayan MCP pihak ketiga.
- **Klien OpenBot** — hanya Streamable HTTP, timeout 15s (sambungan) / 60s (panggilan), cap 20k aksara bagi hasil alat.

## Kemahiran standard terbuka

- `anthropics/skills` — 19 skills rasmi: docx, pdf, pptx, xlsx, mcp-builder, skill-creator dan lain-lain.
- `addyosmani/agent-skills` — koleksi skills komuniti.
- `pbakaus/impeccable` — skills kualiti output.
- `ComposioHQ/awesome-claude-skills` — senarai kurasi skills.
- Spesifikasi standard: https://agentskills.io/specification

---

Disahkan melalui GitHub REST API semasa research. Bintang (★) adalah anggaran masa research; sentiasa sahkan semasa sebelum memasang.
