---
name: ringkasan-mesyuarat
description: >-
  Sediakan minit mesyuarat gaya rasmi Malaysia dengan jadual tindakan (siapa, apa, bila)
  daripada perbualan atau nota. Guna bila mesyuarat selesai atau bila pengguna minta notulensi.
license: MIT
compatibility: "OpenBot Malaysia — pelayan MCP 'malaysia' di http://127.0.0.1:4210/mcp"
metadata:
  openbot-slug: ringkasan-mesyuarat
  openbot-server: malaysia
---

# Ringkasan Mesyuarat

## Bila guna
- Mesyuarat telah selesai dan notulensi diperlukan.
- Pengguna memberi perbualan, nota atau transkrip dan mahu minit gaya rasmi Malaysia.
- Pengguna minta ringkasan mesyuarat dengan jadual tindakan yang jelas.

## Arahan
1. Guna `malaysia/templat_minit_mesyuarat` sebagai kerangka minit, kemudian isikan dengan apa yang berlaku.
2. Rekod keputusan, bukan perbincangan panjang — ringkaskan setiap perkara kepada keputusan yang dibuat.
3. Untuk setiap tindakan, nyatakan pemegang tanggungjawab yang JELAS (nama atau jawatan), tarikh akhir sebenar dan status.
4. Semak tarikh akhir dengan `malaysia/kalendar_cuti` — hanya cuti berstatus DISAHKAN dikira penghalang penjadualan.
5. Selepas menulis, jalankan `malaysia/analisis_teks_bm` pada minit anda dan kekal ringkas (sasaran: paling lambat 1 halaman).
6. Jika butiran tiada (nama hadirin, tarikh), guna pemegang tempat yang jelas (contoh: [NAMA PEGAWAI], [TARIKH]) — JANGAN reka nama.
7. Keluarkan minit dalam format markdown yang boleh disalin terus ke dokumen rasmi.

## Alat diperlukan
- `malaysia/templat_minit_mesyuarat`
- `malaysia/analisis_teks_bm`
- `malaysia/kalendar_cuti`

Rujukan alat di atas ialah pengisytiharan, bukan geran — akses tertakluk kepada dasar kelulusan OpenBot.

## Sumber
- skills.yaml: `examples/malaysia/skills.yaml` (slug: `ringkasan-mesyuarat`)
- Standard SKILL.md: https://agentskills.io
