# War-Pack Malaysia — Kemahiran Standard Terbuka SKILL.md

## Apa ini?

War-pack ialah pemetaan 6 kemahiran pakej tenant Malaysia (`examples/malaysia/`) kepada standard terbuka **SKILL.md** ([agentskills.io](https://agentskills.io)). Setiap folder dalam `skills/` ialah skill kendiri yang boleh diimport ke mana-mana agen mematuhi standard itu tanpa mengubah kod OpenBot.

Sumber kebenaran (source of truth): **`examples/malaysia/skills.yaml`** — fail itu kekal sebagai definisi kemahiran asal untuk OpenBot; folder war-pack hanya cermin standard terbuka untuk pengguna luar.

## Format SKILL.md

- YAML frontmatter di bahagian atas fail, dibatasi `---`.
- Medan wajib: `name` (huruf kecil + sengkang, mesti sama dengan nama folder, maksimum 64 aksara) dan `description` (maksimum 1024 aksara; menyatakan APA kemahiran buat + BILA guna).
- Medan tambahan: `license`, `compatibility` dan `metadata` (slug OpenBot + nama pelayan MCP).
- **Progressive disclosure**: agen hanya membaca `name` + `description` pada permulaan; badan penuh skill dimuatkan hanya bila skill diaktifkan. Ini menjimatkan tetingkap konteks model.

## Cara import ke agen lain

1. Pastikan pelayan MCP `malaysia` berjalan di `http://127.0.0.1:4210/mcp` (lihat `examples/malaysia/mcp/README.md`).
2. Salin folder `skills/<slug>/` (cukup dengan fail `SKILL.md`) ke direktori kemahiran agen sasaran.
3. Pemetaan rujukan alat `malaysia/<tool>` kepada pendaftaran alat agen sasaran — rujukan alat ialah **pengisytiharan, bukan geran**; akses masih tertakluk kepada dasar kelulusan agen sasaran.
4. Uji satu arahan ringkas untuk setiap skill sebelum ke produksi.

## Pemetaan folder <-> skills.yaml

| Folder SKILL.md | Slug skills.yaml | Fungsi ringkas |
| --- | --- | --- |
| `skills/bilik-perang/` | `bilik-perang` | Taklimat strategik Bilik Perang (5 bahagian tetap) |
| `skills/ringkasan-mesyuarat/` | `ringkasan-mesyuarat` | Minit mesyuarat gaya rasmi + jadual tindakan |
| `skills/terjemah-rasmi/` | `terjemah-rasmi` | Terjemahan BM <-> Inggeris, istilah dikunci glosari |
| `skills/analisis-data/` | `analisis-data` | Analisis set data terbuka Malaysia (anti-reka angka) |
| `skills/lukis-carta/` | `lukis-carta` | Carta organisasi Mermaid yang disahkan |
| `skills/hari-kelepasan/` | `hari-kelepasan` | Semak kelepasan am nasional untuk penjadualan |

## Rujukan

- `examples/malaysia/skills.yaml` — definisi 10 kemahiran asal pakej Malaysia.
- [agentskills.io](https://agentskills.io) — spesifikasi standard SKILL.md.
- `MCP-WAR-PACK.md` — registry pelayan MCP disahkan (Research Nov 2025).
