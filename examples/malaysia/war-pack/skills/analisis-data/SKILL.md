---
name: analisis-data
description: >-
  Cari, baca dan analisis set data terbuka Malaysia (data.gov.my) dengan peraturan
  anti-reka angka. Guna bila perlu statistik rasmi Malaysia atau penemuan berdata.
license: MIT
compatibility: "OpenBot Malaysia — pelayan MCP 'malaysia' di http://127.0.0.1:4210/mcp"
metadata:
  openbot-slug: analisis-data
  openbot-server: malaysia
---

# Analisis Data

## Bila guna
- Perlu statistik rasmi Malaysia (sosioekonomi, demografi, kewangan dan seumpamanya).
- Laporan atau keputusan perlu disokong penemuan berdata.
- Pengguna minta carta atau ringkasan daripada set data terbuka.

## Arahan
1. Ikuti aliran tetap: `malaysia/carian_dataset` (cari set data relevan di data.gov.my) -> `malaysia/ambil_dataset` (ambil butiran dan sumber fail) -> `malaysia/analisis_teks_bm` dan `malaysia/penukar_unit` (ringkas dan normalkan angka; format RM, unit tempatan).
2. PERATURAN MUTLAK: jangan sesekali mereka angka statistik. Setiap angka mesti datang daripada set data yang diambil atau sumber yang dirujuk.
3. Bila carian atau pengambilan gagal: katakan dengan jelas, berikan apa yang diketahui bertanda "perlu disahkan", dan sertakan URL sumber tepat (data.gov.my, dosm.gov.my) untuk pengguna semak sendiri.
4. Untuk setiap penemuan, nyatakan: sumber, tarikh data, skop (negeri/negara, tempoh) dan had data.
5. Jika carta diperlukan, guna `malaysia/mermaid_carta` untuk jana carta daripada data yang disahkan.

## Alat diperlukan
- `malaysia/carian_dataset`
- `malaysia/ambil_dataset`
- `malaysia/analisis_teks_bm`
- `malaysia/penukar_unit`
- `malaysia/mermaid_carta`

Rujukan alat di atas ialah pengisytiharan, bukan geran — akses tertakluk kepada dasar kelulusan OpenBot.

## Sumber
- skills.yaml: `examples/malaysia/skills.yaml` (slug: `analisis-data`)
- Standard SKILL.md: https://agentskills.io
