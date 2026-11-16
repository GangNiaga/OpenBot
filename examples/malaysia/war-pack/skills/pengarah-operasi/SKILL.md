---
name: pengarah-operasi
description: >-
  Kemahiran penyeliaan: terima satu tugasan merentasi kepakaran, pecahkan, delegasikan
  setiap bahagian kepada Bot pakar melalui handoff `bot.message`, kemudian konsolidasikan
  dan laporkan balik dengan status jujur (siap / tertangguh / perlu kelulusan).
  Guna bila satu hasil gabungan diperlukan daripada beberapa Bot.
license: MIT
compatibility: "OpenBot Malaysia — pelayan MCP 'malaysia' di http://127.0.0.1:4210/mcp"
metadata:
  openbot-slug: pengarah-operasi
  openbot-server: malaysia
---

# Pengarah Operasi

## Bila guna
- Satu tugasan merentasi beberapa kepakaran (contoh: "siapkan laporan kos dan risiko pelancaran produk").
- Pengguna mahu SATU hasil gabungan, bukan beberapa perbualan berasingan dengan Bot berlainan.
- Kerja perlu dipecahkan, didelegasikan dan dikumpulkan semula dengan status yang jujur.

## Arahan
1. TERIMA tugasan: fahamkan dahulu hasil akhir, sempadan (tarikh, sumber, peraturan) dan
   bentuk jawapan yang diingini sebelum bertindak.
2. PECAHKAN tugasan kepada bahagian kecil yang boleh disiapkan satu Bot satu bahagian;
   tulis senarai pembahagian secara terbuka supaya pengguna nampak pembahagian anda.
3. DELEGASIKAN setiap bahagian melalui handoff `bot.message` - SATU panggilan `message_bot`
   per bahagian, dengan medan penuh: `bot` (nama Bot dalam roster), `task` (apa yang diminta),
   `constraints` (had kerja) dan `expecting` (bentuk jawapan yang dijangka). Peta kepakaran
   roster Malaysia: teknikal/integrasi -> Pegawai Teknologi; kos/bajet RM -> Pegawai Kewangan;
   SOP/proses/logistik -> Pegawai Operasi; kempen/pasaran -> Pegawai Pemasaran; statistik/data
   -> Penganalisis Data; penulisan BM korporat -> Pereka Kandungan; terjemahan -> Penterjemah
   Rasmi; pematuhan/undang-undang -> Penasihat Pematuhan; struktur organisasi -> Pegawai
   Organisasi atau Perunding Organisasi; kerja am -> Pembantu Malaysia.
4. SEMAK SEMPADAN KEDALAMAN: handoff dikekang platform (kedalaman maksimum dan bilangan
   per run). Jika alat `message_bot` tidak ditawarkan, atau panggilan ditolak kerana sempadan
   telah dicapai, JANGAN pusing sempadan - siapkan bahagian itu sendiri dan tanda ia
   "tidak didelegasikan".
5. JEJAK setiap handoff (kepada siapa, apa, bila dijangka pulang). Untuk tugasan besar yang
   merentas thread, simpan status ke memori jangka panjang: `memori/simpan_memori`
   (kind peristiwa), dan semak semula dengan `memori/cari_memori`.
6. KONSOLIDASIKAN balasan semua Bot: singkirkan pertindihan, selesaikan percanggahan dengan
   jujur (nyatakan Bot mana berselisih dan sumber mana anda ambil), dan jangan sesekali
   mengisi ruang yang tidak dibalas dengan tekaan.
7. LAPOR AKHIR dengan tiga bahagian wajib: **APA YANG SIAP** (hasil setiap bahagian beserta
   Bot yang menyiapkannya), **APA YANG MASIH TERTANGGUH** (sebab dan jangkaan masa), dan
   **APA YANG PERLU KELULUSAN** (keputusan pengguna sebelum kerja diteruskan). DILARANG
   mengaku siap jika tiada balasan handoff sebenar dalam run ini.

## Alat diperlukan
- `message_bot` — handoff dalaman OpenBot (jenis baris giliran kerja: `bot.message`)
- `memori/cari_memori`, `memori/simpan_memori` — jejak status tugasan merentas thread

Rujukan alat di atas ialah pengisytiharan, bukan geran — akses tertakluk kepada dasar kelulusan OpenBot.

## Sumber
- agents.yaml: `examples/malaysia/agents.yaml` (Bot: `pengarah-operasi`)
- Standard SKILL.md: https://agentskills.io
