---
name: waktu-solat
description: >-
  Waktu solat rasmi JAKIM untuk semua zon daerah Malaysia (bulan semasa), hari ini
  atau esok - untuk jadual peribadi, mesyuarat di masjid dan pengurusan hari. Guna
  bila masa solat diperlukan dalam perancangan.
license: MIT
compatibility: "OpenBot Malaysia — pelayan MCP 'solat' di http://127.0.0.1:4214/mcp"
metadata:
  openbot-slug: waktu-solat
  openbot-server: solat
---

# Waktu Solat

## Bila guna
- Jadual peribadi atau mesyuarat yang perlu elak waktu solat.
- Perancangan hari bermula sebelum Subuh atau berakhir selepas Maghrib.
- Perkongsian waktu solat harian kepada pengguna Malaysia.

## Arahan
1. Jika pengguna menyebut negeri atau daerah tanpa kod zon, panggil `solat/senarai_zon_solat` dengan penapis negeri itu dan minta mereka pilih zon yang tepat sebelum memanggil `solat/waktu_solat`.
2. Default alat ialah hari ini; "esok" diterima melalui parameter hari.
3. PERATURAN: sentiasa nyatakan zon yang digunakan dalam jawapan (cth. "SGR01 - Gombak/Petaling/Shah Alam") kerana zon bersebelahan berbeza beberapa minit.
4. Nyatakan bahawa untuk kegunaan rasmi jadual bulanan, rujuk e-solat JAKIM (www.e-solat.gov.my).
5. Alat ini memulangkan bulan semasa sahaja - jangan anggar waktu untuk bulan lain; tawarkan rujukan e-solat.

## Alat diperlukan
- `solat/senarai_zon_solat`
- `solat/waktu_solat`
