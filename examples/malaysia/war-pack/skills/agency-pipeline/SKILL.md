---
name: agency-pipeline
description: >-
  Diagnostik kesihatan pipeline, analisis velocity, skor kualiti dagangan (MEDDPICC) dan
  ramalan hasil berlapis kepada keputusan — bukan angka tunggal tanpa julat keyakinan.
  Guna bila pengguna perlu menyemak pipeline menjelang quarter-end, membina forecast,
  atau mengenal pasti dagangan bermasalah awal.
license: MIT
compatibility: "OpenBot — geran alat ditadbir oleh OpenBot, bukan fail ini"
metadata:
  openbot-slug: agency-pipeline
---

# Analis Pipeline

## Bila guna
Gunakan skill ini apabila pengguna mahu mendiagnos kesihatan pipeline jualan, membina forecast yang boleh dipertahankan, atau mengesan dagangan berisiko sebelum quarter gagal. Sumber: Agency Agents (MIT, github.com/msitarzewski/agency-agents).

## Arahan
1. Kira Pipeline Velocity = (Peluang Berkualifikasi x Saiz Dagangan Purata x Kadar Menang) / Panjang Kitaran Jualan — setiap pemboleh ubah ialah lever diagnostik, dan kejatuhan top-of-funnel muncul dalam hasil 2-3 quarter kemudian, menjadikannya isyarat amaran terawal dalam sistem.
2. Semak coverage pipeline terhadap kuota baki: 3x untuk perniagaan matang, 4-5x untuk peringkat pertumbuhan atau pasaran baharu, 5x+ untuk rep baharu — dan sentiasa leraikan coverage dengan kualiti (quality-adjusted), bukan volum mentah.
3. Peringkat stage dan tarikh tutup bukan metodologi forecast: skor kualiti dagangan gabungkan kedalaman kualifikasi (8 medan MEDDPICC), keamatan engagement, dan velocity progresi antara stage.
4. Dagangan dengan kurang 5 daripada 8 medan MEDDPICC adalah underqualified — dagangan underqualified di peringkat lewat ialah punca utama forecast miss.
5. Burukan isyarat bahaya: tiada aktiviti melebihi 14 hari pada dagangan peringkat lewat, dagangan single-threaded bernilai melebihi 50K USD, dan dagangan tergantung pada stage lebih 1.5x median tempoh stage — intervensi secara jelas atau keluarkan dari pipeline.
6. Jangan paparkan satu angka forecast tanpa julat keyakinan: laporkan Commit (keyakinan melebihi 90%), Best Case (melebihi 60%), dan Upside (bawah 60%) dengan andaian jelas bagi setiap kategori.
7. Bina forecast berlapis: kadar konversi sejarah (base rate hampir selalu lebih rendah daripada probabiliti stage CRM), pelarasan velocity dagangan, isyarat engagement (dagangan multi-threaded tutup 2-3x lebih tinggi), dan corak bermusim seperti mampatan quarter-end.
8. Asingkan metrik leading (aktiviti, engagement, penciptaan pipeline) daripada lagging (hasil, win rate, panjang kitaran) — bertindak pada leading, sahkan dengan lagging.
9. Tanda pipeline yang tidak dikemas kini melebihi 30 hari untuk semakan tanpa mengira stage atau tarikh tutup, dan nyatakan kelemahan data sebelum analisis — forecast yang dibina atas data tidak lengkap ialah tekaan dengan spreadsheet.
10. Bahagikan segmen sebelum menarik kesimpulan — purata campuran menyembunyikan isyarat, dan setiap metrik perlu penanda aras (purata sejarah, perbandingan kohort, atau standard industri).
11. Laporkan penemuan tidak selesa dengan ketepatan dan nada yang sama seperti berita baik, dan ingat korelasi bukan kausaliti — rep dengan win rate tinggi tetapi dagangan kecil mungkin cherry-picking, bukan outperform.
12. Beri cadangan intervensi yang spesifik dan boleh bertindak: "Jadualkan meeting economic buyer minggu ini", bukan "perbaiki engagement dagangan".
13. Format output: laporan kesihatan pipeline (metrik velocity, coverage quality-adjusted, funnel konversi per stage dengan hari median, senarai dagangan perlu intervensi dengan skor MEDDPICC dan isyarat risiko) serta model forecast Commit/Best Case/Upside dengan faktor risiko terkuantifikasi.
