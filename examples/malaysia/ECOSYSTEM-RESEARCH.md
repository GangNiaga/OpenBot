# RESEARCH EKOSISTEM: OpenBot for Business, CopilotKit & Top Skills GitHub

**Tarikh:** 15 November 2026
**Tujuan:** Asas penyelarasan (alignment) seluruh dokumentasi `.md` projek dengan kedudukan rasmi
produk OpenBot/CopilotKit dan landskap skill komuniti. Dokumen ini ialah rujukan induk untuk
`WAR-ROOM.md`, `FNB-PLAYBOOK.md` dan `war-pack/`.
**Kaedah:** Tarik terus halaman rasmi `open.bot/business`, `copilotkit.ai`, `docs.copilotkit.ai`,
repo `anthropics/skills` dan repositori skill teratas GitHub (GitHub Search API + raw README).
**Konvensyen:** `[DISAHKAN - sumber]` = bacaan terus daripada halaman/repo rasmi pada tarikh research.
`[ANGGARAN - perlu semakan]` = tafsiran daripada bacaan tersebut.

---

## 1. open.bot/business — Posisi Produk OpenBot for Business `[DISAHKAN - open.bot/business]`

### 1.1 Tesis utama
> "AI coworkers **your company owns**." — Infrastruktur anda. Kod anda. Kawalan anda.

OpenBot for Business dibina oleh CopilotKit (pencipta **AG-UI**). Tiga persona dibawa ke ruang kerja
yang sama:

| Persona | Janji | Mekanisma |
|---|---|---|
| **Pekerja** | Serah kerja memenatkan, semak hasil, luluskan tindakan | Bot dikongsi merentas pasukan; workspace, Slack, Teams; kad kelulusan |
| **IT/Admin** | Tetapkan peraturan untuk semua orang | Akses per Bot/per Role/per Orang; audit trail; pilih lokasi deployment |
| **Jurutera** | Bawa apa yang anda bina | Sambung agen sedia ada melalui **AG-UI** tanpa bina semula stack |

### 1.2 "Modular lanes" — komposabiliti penuh `[DISAHKAN]`
1. **Agen anda** — di-host di mana saja, disambung melalui AG-UI (Claude Agent SDK, OpenAI Agents
   SDK, LangChain, Google ADK), atau guna Bot terbina dalam.
2. **Model anda** — OpenAI, Claude, Gemini, Grok, Kimi, DeepSeek, Qwen, Nemotron, Mistral —
   langganan sendiri atau API key sendiri.
3. **Alat anda** — disambung melalui **MCP**; hub MCP, sandbox, "modular lanes" — default baik
   atau plug-in sendiri.
4. **Infra anda** — laptop → Kubernetes + Helm → AWS / Azure / Google Cloud, satu klik.

### 1.5 Tadb urus "built in, not bolted on" `[DISAHKAN]`
- **Identiti & akses:** SSO, **SCIM provisioning**, **Bot roles + on-behalf-of tokens** (token
  dicat semasa bertindak bagi orang, lazimnya subset kebenaran).
- **Kawalan:** *Admin plane* (urus orang, Bot, alat, polisi satu tempat); geran alat pada setiap
  peringkat (Bot / Role / Orang, dengan pintu minta admin); **audit kos** per Bot/per Role/per
  Pasukan/per Orang.
- **Ketelusan:** audit trail penuh ("Setiap item diakses dan setiap tindakan direkodkan"),
  **eksport audit log ke SIEM**.
- **Pematuhan:** **SOC 2 Type II** (CopilotKit), label kandungan AI mengikut **EU AI Act**,
  retensi & pemadaman data atas permintaan.
- **Hosting & tenancy:** boleh **self-host penuh**, **multi-tenancy** (data pelanggan terpisah),
  **had penggunaan** token harian/mingguan/bulanan per tenant dan per orang.

### 1.4 Saluran (channels) `[DISAHKAN]`
iOS dan Android (early access), Slack melalui **OpenTag**, Teams, Desktop (Mac Apple Silicon/Intel,
Windows), Web (akan datang). Identiti disambung supaya setiap perbualan dan kelulusan tetap terikat
kepada orang yang sama.

### 1.5 Agen yang belajar (`Agents that learn`) `[DISAHKAN]`
- **Ajar terus:** tunjukkan proses sekali (demonstrasi).
- **Belajar dari kerja:** OpenBot memerhati corak, bentuk skill boleh-guna-semula, dan orang kekal
  kawal (contoh rasmi: *Expense Review Bot* belajar "semak tarikh penginapan sebelum hantar" selepas
  3 tuntutan hotel ditolak sebab sebab yang sama).
- **Trust is a setting:** tentukan apa boleh buat, apa perlukan kelulusan, apa di luar batas.

### 1.6 Corak orkestrator (kisah GTM 20 agen) `[DISAHKAN]`
1 eksekutif → 1 orkestrator ("Nicky Fury") → **20 agen pakar merentas 6 fungsi** (Strategi 3,
Marketing 5, Sales 3, Signals & Data 2, RevOps 2, Team Ops 3). Setiap agen ada **job description
bertulis** dan alatnya sendiri (7 produk). Analis **QA mengaudit output setiap malam**; seorang
**librarian** simpan memori kongsi pasukan supaya iktibar kitaran lepas dibawa ke kitaran baru;
program manager jalankan **kitaran GTM 2 minggu**. Kelulusan manusia kekal untuk apa yang penting
(outreach diluluskan sebelum keluar).

### 1.7 Perbandingan rasmi dengan Claude / OpenAI / OpenClaw `[DISAHKAN - jadual open.bot/business]`
- **Model lock-in:** OpenBot **Tidak** (mana-mana model, termasuk model terbuka) berbanding Claude
  (Claude sahaja) dan OpenAI (model OpenAI sahaja).
- **Agen:** OpenBot **Ya** (agen yang jurutera sudah tulis, melalui AG-UI) berbanding kedua-duanya
  "developers locked out".
- **Modularity:** OpenBot **Ya** ("modular by design") berbanding "closed product".
- **Ownership:** OpenBot **Ya** — kod **MIT**, deploy satu klik ke VPC anda (AWS/Azure/GCP) atau
  cloud kami, kongsi atau dedikasi.
- **Enterprise:** OpenBot **Ya** — tadb urus daripada CopilotKit (**SOC 2 Type II**), sokongan
  penuh + jurutera *forward-deployed*.

---

## 2. copilotkit.ai — Stack Produk CopilotKit `[DISAHKAN - copilotkit.ai]`

### 2.1 Produk dalam stack
- **CopilotKit Intelligence** — pembelajaran automatik + produk analitik untuk agen.
- **Frontend SDKs** — React, Vue, Angular, React Native, iOS, Android, Slack, Teams, WhatsApp.
- **Backend Connections** — 20+ kerangka agen (LangChain, DeepAgents, Google ADK, AWS Strands,
  Microsoft Agent Framework, Mastra, Claude Agent SDK (Py/TS), PydanticAI, AG2, Agno, LlamaIndex,
  CrewAI, OpenAI Agents SDK, dll.).
- **Channels** — Web, Slack, Teams, iOS, Android, WhatsApp.
- **OpenBot** dan **OpenBot for Business**; juga OpenFuse, OpenDots, OpenDuet.

### 2.2 AG-UI `[DISAHKAN]`
"General-purpose, bi-directional connection between a user-facing application and any agentic
backend." Spektrum Generative UI: **A2UI**, **MCP Apps**, **AG-UI**.

### 2.3 Kepentingan SDK
Chat, Threads, Frontend tools, **Generative UI** (controlled / declarative / open-ended),
**Shared state**, **Human-in-the-loop**, WebMCP, Built-in agent, **Sub-agents**.
Kod SDK boleh pre-built (`<CopilotChat agentId="support" />`), swap slot komponen, atau
**headless penuh** (`useAgent()`, `useRenderActivityMessage()`).

### 2.4 AG-UI Streams `[DISAHKAN - docs.copilotkit.ai]`
Pelengkap sistem thread sedia ada: spektrum penuh generative UI, input multimodal + muat naik
fail, **penyambungan semula dan catch-up selepas gangguan rangkaian dan merentas tab/peranti**
(keadaan disegerakkan, contoh rasmi: `STATE_DELTA · synced across devices`).

### 2.5 Automatic Learning (loop rasmi) `[DISAHKAN]`
1. **Setiap interaksi dirakam** — dalam-app (klik, edit, navigasi) dan dalam-chat (soal, isyarat
   maklum balas, kelulusan, edit, cuba semula).
2. **Learning containers** ditakrif untuk **per pengguna / per kumpulan / per organisasi**.
3. **Skill menulis diri** — fail skill dicipta/dipertingkat automatik (contoh rasmi UI:
   `analytics-skill.md improved`, `search-skill.md created`) untuk disemak dan diterbitkan.
4. **Eksport dataset** untuk fine-tune model tersuai.
- Anak-anak kajian: **User Memories**, **Trajectories**, *standalone collector*.

### 2.6 Produk analitik agen `[DISAHKAN]`
Runs, tool calls, tindak balas purata; hasil **completed / failed / handed off / abandoned**;
laluan pengguna (di mana berjaya, berjuang, berhenti). "CopilotKit menambah pandangan produk di
sebelah observabiliti LLM anda."

### 2.7 Buktinya pasaran `[DISAHKAN]`
56.3k bintang GitHub; **Siri A $27M** (TechCrunch); kursus **DeepLearning.AI** "Build Interactive
Agents with Generative UI"; sesi **Google Cloud Next** (A2UI, AG-UI, MCP Apps); Dipercayai
"majoriti Fortune 500 dan Global 50"; testimoni Docusign & Evergreen Wealth.

---

## 3. docs.copilotkit.ai — Peta Dokumentasi Rasmi `[DISAHKAN - docs.copilotkit.ai]`

Struktur dok (untuk sepadan dengan susunan dok kami):
`Introduction · Quickstart · Build with agents (Chat, Threads, Frontend-tools, Generative UI:
Controlled/Declarative/Open-ended, Interactivity: Shared state, Human-in-the-loop, WebMCP) ·
Agent capabilities (Built-in Agent, Sub-agents) · Intelligence (Overview, AG-UI Streams,
Automatic Learning: User Memories/Trajectories/Standalone collector) · Product Analytics ·
Channels · Hosting (Backend, Runtime, Deployment, Debugging) · Learn · Contributing ·
Open-source telemetry · Community frameworks`.

OpenBot diperihalkan rasmi sebagai: *"The modular, self-hostable workspace for AI coworkers, built
on CopilotKit and AG-UI. Bring any agent, then choose the models, tools and infrastructure it runs
on. Enterprise-ready with governance built in, like SSO and SCIM, boundaries, a full audit trail
and more."* `[DISAHKAN]`

**Kesimpulan padanan dengan fork kami:** setiap konsep dok rasmi ada padanan dalam kod kami —
Chat/Threads (`conversations`), Shared state, HITL (`approvals.md`), Sub-agents (router +
`/api/agents`), Routines (pelayan MCP `routines` terbina dalam), Automatic Learning (bekas
`learning_open_skills`), audit trail (`audit_events` + `plugin_grants`). Jurang yang belum ada:
**AG-UI Streams** (reconnect/catch-up merentas peranti), **Channels** Slack/Teams/iOS/Android,
**Product Analytics**, dan **Trajectories/User Memories** sebagai produk tersendiri.

---

## 4. Top 5 Skills di GitHub (Nov 2026) `[DISAHKAN - GitHub Search API]`

**Standard rujukan rasmi: [`anthropics/skills`](https://github.com/anthropics/skills) — 195,100
bintang, 22,900 fork.** Format `SKILL.md` = folder + YAML frontmatter (`name`, `description`) +
arahan; spec terbuka di [agentskills.io](https://agentskills.io); boleh didaftar sebagai marketplace
Claude Code (`/plugin marketplace add anthropics/skills`). Set rasmi: `docx`, `pdf`, `pptx`,
`xlsx`, `canvas-design`, `frontend-design`, `mcp-builder`, `webapp-testing`,
`web-artifacts-builder`, `brand-guidelines`, `skill-creator`.

**Lima skill komuniti teratas (ikut bintang, disahkan wujud):**

| # | Repo | Bintang | Apa buat | Iktibar untuk kami |
|---|---|---|---|---|
| 1 | [`affaan-m/ECC`](https://github.com/affaan-m/ECC) | 303,534 | "Agent harness performance optimization system" — skills, instincts, memory, security, research-first dev; 16 terjemahan README | **Memori berlapis + instinct** = padanan peta jalan Fase 3 (memori jangka panjang, ADD-only) |
| 2 | [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman) | 120,343 | Skill + proksi jimat token: −33.2% token input, −54% kos (sama skor); 30+ agen; berjaya jadi produk "Caveman Code" | **Frugality token** pada system prompt & konteks alat — kurangkan kos setiap run Bot |
| 3 | [`tt-a1i/archify`](https://github.com/tt-a1i/archify) | 96,567 | Idea/pelan/codebase → **gambarajah interaktif HTML**; 130K+ install di skills.sh; Apache-2.0 | Skill `lukis-carta` kami boleh naik taraf: Mermaid → HTML interaktif seperti Archify |
| 4 | [`blader/humanizer`](https://github.com/blader/humanizer) | 69,322 | Buang tanda tulisan AI ikut panduan Wikipedia "Signs of AI writing"; ujian buta 16/16 dipilih hakim | Tambah **glosari gaya BM rasmi** pada skill `terjemah-rasmi` — keluarkan "bukan kemanusiaan" BM |
| 5 | [`mvanhorn/last30days-skill`](https://github.com/mvanhorn/last30days-skill) | 67,716 | Research topik merentas Reddit, X, YouTube, HN, Polymarket + web → sintesis 30 hari | Corak **pipeline research pelbagai sumber** untuk skill `analisis-data` & bilik perang |

> Penyebutan hormat: `OpenMontageInc/OpenMontage` (80,612★, produksi video agentic, 700+ skill),
> `coreyhaines31/marketingskills` (60,468★), `K-Dense-AI/scientific-agent-skills` (57,278★).

**Corak lintas top-5 (apa yang buat skill "top"):** (1) satu masalah sakit yang jelas dan terukur;
(2) nombor kesan diterbitkan (token, kos, %); (3) satu fail SKILL.md yang patuh standard —
frontmatter kemas, arahan boleh diikuti; (4) sasaran merentas banyak agen (bukan kunci satu
vendor); (5) contoh sebelum/lepas yang boleh dinilai pantas.

---

## 5. Apa Bermakna untuk OpenBot Malaysia — Tindakan Penyelarasan

1. **Terminologi entiti = "Bot"** (kapital B), seperti produk rasmi; "coworker" kekal hanya sebagai
   kata hubungan ("the one you make coworkers with"). Dok lama yang panggil entiti "coworker"
   diselaraskan. `[ANGGARAN]`
2. **Katalog MCP kini 14 entry** (`parallel`, `parallel-authenticated`, `exa`, `exa-authenticated`,
   `firecrawl`, `firecrawl-authenticated`, `coingecko`, `malaysiatransit`, `composio`,
   `google-drive`, `notion`, `routines`, `malaysia`, `memori`) — dok senibina dikemaskini supaya
   senarai itu tepat. `[DISAHKAN - server/src/plugins/catalogue.ts]`
3. **War-pack sudah patuh standard anthropics/skills** (frontmatter `name` + `description`);
   kekal sebagai cermin standard terbuka, `skills.yaml` kekal sumber kebenaran. `[DISAHKAN]`
4. **Peta jalan bersepadan** dengan kedudukan rasmi produk (jurang → fasa):
   - Fase 2 (Autonomi): Routines engine + proaktif + trigger webhook — sejajar "Routines" rasmi.
   - Fase 3 (Pintar): Automatic Learning loop + memori (padanan CopilotKit Intelligence; iktibar
     ECC #1) + SKILL.md standard (sudah patuh).
   - Fase 4 (Platform): AG-UI Streams (reconnect/catch-up), Channels (Slack/Teams), HITL v2,
     analitik run (padanan Product Analytics), orkestrator pelbagai Bot (padanan kisah Nicky Fury).
     Kemas kini 16 November 2026: trigger webhook Composio, learning sweep (`OPENBOT_LEARNING_SWEEP`)
     dan eksport span Langfuse (`openbot.turn`) sudah dalam kod; corak orkestrator Nicky Fury
     kini ada padanannya — **Pengarah Operasi** (supervisor Bot yang memecahkan kerja dan
     mendelegasikan melalui handoff `bot.message`). AG-UI Streams reconnect/catch-up dan analitik
     run kekal sebagai jurang.
5. **Status semasa deployment** (rujuk `WAR-ROOM.md` untuk sejarah): **22 Bot, 8 pelayan MCP
   aktif, 120 alat** (memori kini 7 alat — 4 memori + 3 kit RAG dokumen), 4 panggilan vendor
   langsung disahkan (Composio, Exa, CoinGecko, Malaysia Transit) pada 15 Nov 2026; 16 Nov 2026
   menambah trigger Composio (HMAC `x-composio-signature`), learning sweep, Langfuse, memori
   hibrid RRF + `valid_at` + soft-delete, dan Pengarah Operasi. `[DISAHKAN - kod & bootstrap]`

---

## 6. Sumber

- `https://open.bot/business` — halaman rasmi OpenBot for Business (ditarik 15 Nov 2026).
- `https://www.copilotkit.ai/` — halaman produk CopilotKit (ditarik 15 Nov 2026).
- `https://docs.copilotkit.ai/` — dokumen CopilotKit (ditarik 15 Nov 2026).
- `https://github.com/anthropics/skills` — 195,100★; standard Agent Skills (ditarik 15 Nov 2026).
- GitHub Search API `q=agent skills claude sort=stars` — kedudukan top-5 komuniti (15 Nov 2026).
