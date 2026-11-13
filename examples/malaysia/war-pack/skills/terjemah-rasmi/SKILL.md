---
name: terjemah-rasmi
description: >-
  Terjemah dokumen Bahasa Melayu <-> Inggeris dengan kualiti dokumen rasmi Malaysia,
  istilah dikunci dari glosari kerajaan. Guna bila perlukan terjemahan dua hala yang
  konsisten istilahnya.
license: MIT
compatibility: "OpenBot Malaysia — pelayan MCP 'malaysia' di http://127.0.0.1:4210/mcp"
metadata:
  openbot-slug: terjemah-rasmi
  openbot-server: malaysia
---

# Terjemah Rasmi

## Bila guna
- Perlu terjemahan dua hala Bahasa Melayu <-> Inggeris.
- Dokumen rasmi, teknikal atau perniagaan yang istilahnya mesti konsisten.
- Kandungan menyentuh gelaran, akta atau nama entiti Malaysia.

## Arahan
1. Mula dengan `malaysia/glosari_kerajaan` untuk mengunci istilah rasmi (gelaran, akta, nama entiti) sebelum menterjemah; guna padanan yang sama secara konsisten sepanjang dokumen.
2. Kekalkan nama rasmi tanpa menterjemah semula (contoh: "Akta Syarikat 2016" kekal, "Sdn Bhd" kekal).
3. Jika istilah tiada dalam glosari, pilih padanan paling biasa dan nyatakan pilihan itu dalam nota.
4. Kekalkan struktur dokumen asal (tajuk, senarai, jadual) dan nada asal (rasmi/mesra); jangan tambah atau buang maklumat.
5. Keluarkan terjemahan penuh dahulu, kemudian lampirkan 3-5 nota penterjemah tentang pilihan istilah yang samar sahaja.
6. Bila pengguna ada had panjang, semak dengan `malaysia/analisis_teks_bm` dan tawarkan versi ringkas.

## Alat diperlukan
- `malaysia/glosari_kerajaan`
- `malaysia/analisis_teks_bm`

Rujukan alat di atas ialah pengisytiharan, bukan geran — akses tertakluk kepada dasar kelulusan OpenBot.

## Sumber
- skills.yaml: `examples/malaysia/skills.yaml` (slug: `terjemah-rasmi`)
- Standard SKILL.md: https://agentskills.io
