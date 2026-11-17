# Penyelidikan GitHub: Skill, Plugin, MCP Servers dan Connector

*Tarikh: 17 November 2026. Sumber: GitHub (anthropics/skills, agentskills.io, modelcontextprotocol/registry, mcp-scan/Snyk, composio-dev/composio, nango-dev/nango, PipedreamHQ/pipedream, activepieces/activepieces, msitarzewski/agency-agents) dan laman dokumen vendor.*

Laporan ini menjawab satu soalan: apa yang ekosistem agent terbuka buat hari ini dalam empat bahagian ini yang OpenBot belum buat, dan mana yang berbaloi dipinjam. Setiap cadangan ditala berbanding apa yang OpenBot sudah ada, supaya senarai ini boleh dijalankan dan bukan senarai impian.

---

## 1. SKILL

**Apa yang sudah ada di OpenBot.** Skills dalam Postgres (`skills`, `skill_tools`), bridge dua hala SKILL.md mengikut standard agentskills.io (`plugin-store/skill-md.ts`), import/export melalui `POST /api/plugins/skills/import` dan `GET /api/plugins/skills/{slug}/skill.md`, pipeline pembelajaran yang mencadangkan skill daripada run (`learning_open_skills`), dan seed pakej penyewa (`skills.yaml`).

**Penemuan utama.**
- Standard agentskills.io telah menjadi piawaian terbuka yang sebenar: frontmatter hanya enam medan (`name` wajib ≤64 aksara kebab-case, `description` wajib ≤1024 aksara yang menjelaskan "apa + bila", `license`, `compatibility`, `metadata`, dan eksperimen `allowed-tools`). `version` dan `author` bukan medan top-level — ia disimpan dalam `metadata`. Bridge OpenBot sudah mematuhi kontrak ini.
- Progressive disclosure tiga peringkat: (1) nama + deskripsi sentiasa dalam konteks (~100 token), (2) badan dimuat bila dicetus, (3) `references/` dan `scripts/` dimuat atas permintaan dengan penunjuk eksplisit.
- Claude Code membungkus plugin sebagai `.claude-plugin/plugin.json` (name, version, `dependencies` semver, `userConfig`, komponen commands/agents/skills/hooks/mcpServers) + `marketplace.json` yang memetakan nama ke sumber (path relative, github, git-subdir).
- ClawHub (registry OpenClaw) menjalankan semver + changelog + lockfile (`lock.json` pin versi) + pengesahan digest arkib sebelum pasang, dan paparkan ringkasan imbasan keselamatan pada setiap skill.
- OpenClaw menyusun senarai kesilaan skill tujuh peringkat (workspace → bundled) dan mengetatkan per-skill dengan `enabled` + suntikan env.

**Cadangan (keputusan).**
1. **DIBUAT** — Import roster Agency Agents (MIT, github.com/msitarzewski/agency-agents): 268 watak pakar dikondensat kepada 15 skill Bahasa Melayu (marketing ×6, sales ×3, finance ×3, product ×1, support ×2) dalam `war-pack/skills/agency-*/SKILL.md`, didaftarkan dalam `skills.yaml` dan dilampirkan kepada 10 Bot yang betul. Skor format disemak dengan parser sebenar repo.
2. **Bila berbaloi** — Sokong `allowed-tools` daripada frontmatter sebagai skop pra-lulusan semasa giliran skill aktif (melalui pintu kelulusan sedia ada). Parser kini mengabaikannya.
3. **Bila berbaloi** — Rekod semakan per-revisi untuk output pipeline pembelajaran (corak Skill Workshop OpenClaw: sejarah + undo per-revisi).

---

## 2. PLUGIN

**Apa yang sudah ada di OpenBot.** Katalog first-party beku dalam kod dengan auth types (none/deployment-bearer/user-oauth/builtin), grants + owner grants + share targets, call policy, content governance, approvals untuk alat tulis, guardrail arahan injeksi, dan health per alat (`mcp_tools.lastError`).

**Penemuan utama.**
- Manifest masa pasang: Claude Code dan ClawHub sama-sama minta persetujuan kebenaran SEKALI pada pemasangan (userConfig/sensitive), bukan setiap panggilan. OpenBot menguatkan setiap panggilan tetapi tiada manifest pemasangan.
- Lazy activation ala VS Code: plugin tidak dibuang manifestnya sehingga peristiwa pencetus berlaku — relevan untuk katalog besar.
- Sandboxing "trusted gateway, untrusted execution": WASM (Extism) untuk skrip tidak dipercayai; skill hanyalah suntikan konteks dan tidak pernah berkeistimewaan sendiri — OpenBot sudah di belah yang selamat (skill ialah arahan, bukan keupayaan).

**Cadangan (keputusan).**
1. **Bila berbaloi** — Lapisan marketplace baca-sahaja: parser `marketplace.json` yang menyenaraikan sumber pihak ketiga untuk pentadbir import satu-satu (tiada auto-install; katalog first-party kekal beku).
2. **Bila berbaloi** — Ringkasan kebenaran pada kad pemasangan app brokered (apa yang geran akan benarkan) daripada data `writeTools` + `effect` yang sudah direkodkan.

---

## 3. MCP SERVERS

**Apa yang sudah ada di OpenBot.** Klien MCP dengan registry DB (`mcp_servers`, `mcp_tools`), transport pelbagai (streamable HTTP, Arcade, Composio), disclosure alat untuk set besar, approvals, guardrail, dan seed 8 server / 120 alat + server lokal keyless (memori, cuaca, tukaran, solat, malaysia-transit).

**Penemuan utama.**
- Spesifikasi MCP 2025-06-18: tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) adalah HINT, bukan jaminan — OpenBot betul: `declaredRead` disimpan tetapi tidak dipercayai untuk langkau approval.
- Elicitation (`elicitation/create`) dan structured output (`structuredContent` + `outputSchema`) kini sebahagian spesifikasi; registry rasmi (modelcontextprotocol/registry) beku di API v0.1 dengan `server.json` bercirikan namespace `io.github.<user>/`.
- Keselamatan: tool poisoning (Invariant Labs, kini Snyk Agent Scan / mcp-scan) — arahan hasad dalam deskripsi alat; rug-pull — definisi alat berubah selepas kelulusan. Mitigasi: hash deskripsi+schema dan banding setiap refresh.
- Server keyless berbaloi: **Context7** (Upstash, docs perpustakaan semasa), **Playwright MCP** (Microsoft), **sequential-thinking** (rasmi). Semuanya keyless; Playwright berat (browser) untuk kontena Render.

**Cadangan (keputusan).**
1. **DIBUAT** — Rug-pull detection: kolum `mcp_tools.content_hash` (SHA-256 deskripsi + input schema) dan `mcp_servers.changed_tools` (array nama alat yang berubah definisi antara listing) — perubahan yang "menunggang rugi" kelulusan lama kini TERLIHAT di sisi baris hijau, bukan senyap.
2. **DIBUAT** — Entry katalog **Context7** (keyless, `https://mcp.context7.com/mcp`, dua alat bacaan `resolve-library-id` + `get-library-docs`) — dokumentasi perpustakaan semasa untuk semua Bot teknikal.
3. **Bila berbaloi** — Elicitation client: borang inline dalam chat semasa server minta input tambahan, melalui approval gate sedia ada.
4. **Bila berbaloi** — Sinkron katalog daripada registry rasmi (baca-sahaja, untuk papan cadangan pentadbir).

---

## 4. CONNECTOR

**Apa yang sudah ada di OpenBot.** Lapisan sambungan: `composio_connections`, `brokered_connections/accounts/identities`, `pending_authorizations`, `mcp_user_credentials`, connector REST langsung (Google Drive, Notion), dan trigger ingress HMAC (x-composio-signature + dedup log_id + rotasi rahsia).

**Penemuan utama.**
- **Composio v3.1 (model semasa)**: auth_config (`ac_...`) + connected account per `user_id`; `POST /api/v3/connected_accounts/link {auth_config_id, user_id}` → `redirect_url` + `connected_account_id`; token disimpan dan di-refresh oleh Composio. **Server MCP per-toolkit/per-account telah deprecated** — pengganti: meta-tools global `https://connect.composio.dev/mcp` (discover/authorize/execute) atau session-based SDK (`sessions.create()` → `session.mcp.url`). Ini sebab connector Composio produksi rosak (model lama kunci-API mati, 401/410).
- Triggers v3: event ke webhook URL projek, ditandatangan dengan `subscription.secret` — OpenBot sudah ada HMAC verify + rotasi; IP Composio dinamik jadi jangan IP allowlist.
- Nango: model Connection dengan refresh loop oleh platform + auth webhook `connectionId` + pemisahan syncs (tarikan berkala) vs actions (on-demand). Corak yang berbaloi: reconnect flow automatik bila tool call gagal 401.
- Activepieces: pieces type-safe dengan `PieceAuth` + actions/triggers + `sampleData` — corak manifest yang baik untuk connector boleh-import.

**Cadangan (keputusan).**
1. **JALAN SEMULA (pautan dijana)** — Pautan OAuth Gmail Composio dijana semula melalui `POST /api/v3/connected_accounts/link` (auth_config `ac_GX5bM9hAT8bb`, user `openbot-malaysia` → `ca_1Nfdqs2lJWGe`). Selepas pemilik klik pautan dan selesai consent, entry katalog composio dikemas kini ke endpoint meta-tools dan alat Composio hidup balik.
2. **Bila berbaloi** — Reconnect automatik ala Nango: bila panggilan alat gagal 401/token-invalid pada app brokered, jana pautan sambung-semula untuk pemilik dan tanda koneksi `needs_reauth`.
3. **Bila berbaloi** — Sinkron metadata toolkit Composio (auth scheme per app) ke dalam kad pemasangan, supaya pentadbir nampak bentuk auth sebelum connect.

---

## Kesimpulan

Dibuat pada rilis ini: **15 skill pakar Agency Agents (MIT)** diimport dan dilampirkan, **rug-pull detection** untuk keselamatan alat MCP, dan **entry katalog Context7**. Pautan OAuth Composio dijana semula dan menunggu satu klik pemilik. Yang tinggal sebagai backlog berpangkat: `allowed-tools` skop pra-lulusan, marketplace baca-sahaja, elicitation client, reconnect automatik, dan sinkron registry rasmi.

**Attribusi**: roster asal `Agency Agents` (MIT, Copyright 2025 AgentLand Contributors, github.com/msitarzewski/agency-agents). Condensation Bahasa Melayu dan pemetaan ke format OpenBot dibuat dalam repo ini; setiap SKILL.md membawa ayat sumber dalam seksyen "Bila guna".
