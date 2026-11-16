---
name: cuaca-harian
description: >-
  Cuaca semasa dan ramalan harian untuk bandar Malaysia dalam Bahasa Melayu, untuk
  perancangan acara luar, penghantaran dan perjalanan. Guna bila mana-mana keputusan
  bergantung pada cuaca.
license: MIT
compatibility: "OpenBot Malaysia — pelayan MCP 'cuaca' di http://127.0.0.1:4212/mcp"
metadata:
  openbot-slug: cuaca-harian
  openbot-server: cuaca
---

# Cuaca Harian

## Bila guna
- Merancang acara luar, mesyuarat tapak, penghantaran atau perjalanan.
- Soalan harian "cuaca macam mana sekarang / esok / minggu ini di [bandar]".
- Keputusan yang bergantung pada hujan atau ribut petir (pemasangan, aktiviti luar, perlabuhan).

## Arahan
1. Untuk lokasi yang samar, panggil `cuaca/cari_lokasi` dahulu dan tunjukkan pilihan kepada pengguna sebelum memilih.
2. Untuk soalan "sekarang", gunakan `cuaca/cuaca_semasa`; untuk perancangan, gunakan `cuaca/ramalan_cuaca` dengan bilangan hari yang sesuai (1-7).
3. Terjemahkan ramalan kepada cadangan praktikal (cth. "rabu hujan lebat - tunda penghantaran ke khamis").
4. PERATURAN: sentiasa nyatakan bahawa sumbernya Open-Meteo, dan bahawa amaran cuaca rasmi (ribut petir, angin kencang, banjir) mesti disemak di MetMalaysia (met.gov.my).
5. Jangan sekali-kali mereka angka cuaca daripada ingatan - hanya angka yang alat pulangkan.

## Alat diperlukan
- `cuaca/cuaca_semasa`
- `cuaca/ramalan_cuaca`
- `cuaca/cari_lokasi`
