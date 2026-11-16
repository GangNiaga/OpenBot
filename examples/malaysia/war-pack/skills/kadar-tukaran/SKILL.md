---
name: kadar-tukaran
description: >-
  Kadar pertukaran harian dan penukaran matawang (MYR disokong) untuk anggaran kos,
  bajet perjalanan dan perbandingan harga antara negara. Guna bila nilai dalam RM
  atau matawang lain perlu dibandingkan.
license: MIT
compatibility: "OpenBot Malaysia — pelayan MCP 'tukaran' di http://127.0.0.1:4213/mcp"
metadata:
  openbot-slug: kadar-tukaran
  openbot-server: tukaran
---

# Kadar Tukaran

## Bila guna
- Anggaran kos dan bajet yang melibatkan lebih daripada satu matawang.
- Perbandingan harga antara negara (cth. harga peralatan di MYR vs SGD).
- Soalan harian "berapa RM untuk 100 USD hari ini".

## Arahan
1. Untuk kadar semasa, gunakan `tukaran/kadar_semasa`; untuk jumlah tertentu, gunakan `tukaran/tukar_matawang`.
2. Jika tidak pasti sesuatu kod matawang wujud, gunakan `tukaran/senarai_matawang` dahulu.
3. PERATURAN: sentiasa nyatakan bahawa kadar ini harian (exchangerate-api - tarikh kemaskini yang alat pulangkan) dan bahawa kadar sebenar bank atau penukar wang berbeza kerana yuran dan spread.
4. Untuk keputusan kewangan besar, rujuk BNM (bnm.gov.my) atau bank pengguna sebelum dilaksanakan.
5. Jangan sekali-kali mereka kadar daripada ingatan - hanya kadar yang alat pulangkan.

## Alat diperlukan
- `tukaran/kadar_semasa`
- `tukaran/tukar_matawang`
- `tukaran/senarai_matawang`
