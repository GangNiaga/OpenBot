# LAPORAN PENYELIDIKAN: Landskap Perniagaan F&B (Makanan & Minuman) MALAYSIA
**Tujuan:** Asas pembinaan pasukan bot AI yang mengurus perniagaan F&B Malaysia
**Kaedah:** API rasmi data.gov.my / storage.dosm.gov.my (CSV/XLSX DOSM), MySST (RMCD), halal.gov.my (JAKIM), SSM, GitHub API, HN Algolia, MCP tempatan `127.0.0.1:4210/mcp`
**Konvensyen:** `[DISAHKAN - sumber]` = angka ditarik terus dari sumber rasmi yang berjaya diakses. `[ANGGARAN - perlu semakan]` = berasaskan amalan industri/pengetahuan umum, TIDAK disahkan dalam sidang ini.
**Nota jujuk:** Reddit (403), moh.gov.my, epf.gov.my, perkeso.gov.my, kpdn.gov.my, jakim.gov.my TIDAK dapat diakses (lihat Bahagian 8 & 9). Terdapat SEMAKAN PENTING terhadap dakwaan "SST 8% untuk F&B" — lihat Q3.

---

## 0. RINGKASAN EKSEKUTIF
- Pasaran perkhidmatan makanan & minuman (F&B services) Malaysia: **RM75.2B (2024) -> RM83.0B (2025, +10.4%)**, Q1 2026 RM22.1B (+10.9%), Q2 2026 (prelim) RM22.4B (+9.8%) `[DISAHKAN - DOSM ST2 2026]`. Gunakan ~RM88-90B sebagai angka penuh 2026 `[ANGGARAN]`.
- Struktur: **136,453 pertubuhan F&B (Banci Ekonomi 2022)**; 88% milikan perseorangan tetapi syarikat Sdn Bhd (8% pertubuhan) hasilkan 44% output — pasaran "ekor panjang" SME + segmen korporat besar `[DISAHKAN]`.
- Tekanan kos: inflasi "makanan di luar rumah" melebihi inflasi umum setiap tahun sejak 2023 (contoh 2025: +4.0% vs umum ~+1.7%) `[DISAHKAN - CPI DOSM]`; gaji median sektor makanan RM2,013/bln (2025) `[DISAHKAN]`; SST F&B ialah **6%** (bukan 8%) di atas ambang RM1.5M `[DISAHKAN - MySST]`.
- Peluang utama bot: CRM WhatsApp-first, penyelarasan delivery/dapur awan, kawalan bahan buangan & BEP, penjaga kalendar pematuhan (SST/halal/lesen PBT).

---

## 1. SAIZ PASARAN & PERTUMBUHAN

### 1.1 Angka rasmi perkhidmatan makanan & minuman (survei suku tahunan DOSM) `[DISAHKAN - DOSM ST2 2026, jadual "Perkhidmatan Makanan dan Minuman"]`
| Tahun | Hasil (RM bilion) | Pertumbuhan YoY | Pekerja |
|---|---|---|---|
| 2019 | 72.0 | - | 895,190 |
| 2020 | 56.4 | -21.6% | 821,305 |
| 2021 | 50.8 | -10.0% | 813,852 |
| 2022 | 65.9 | +29.8% | 823,470 |
| 2023 | 71.0 | +7.7% | 833,567 |
| 2024 | 75.2 | +5.9% | 837,094 |
| 2025 | **83.0** | **+10.4%** | 858,131 |
| 2026 Q1 / Q2p | 22.06 / 22.39 (per suku) | +10.9% / +9.8% | 861k / 862k |

- Ekstrapolasi 2026 penuh ~RM88-90B `[ANGGARAN - ekstrapolasi 2 suku pertama]`.
- Gaji & upah sektor ini (2025): RM8.14B/tahun; hasil per pekerja ~RM96.8k/tahun `[DISAHKAN - dikira dari data di atas]`.
- Skop DOSM: restoran, kafe, kedai makan/mamak, gerai, katering acara, perkhidmatan minuman (MSIC I56). Butiran pecahan delivery tiada dalam publikasi ini.

### 1.2 Struktur industri — Banci Ekonomi 2022 `[DISAHKAN - census_economy_2022_subsector_i_fnb.xlsx]`
- **136,453 pertubuhan**; output kasar **RM98.96B**; nilai tambah **RM43.83B** (nisbah 44.3%); pekerja 1,079,843; gaji RM15.47B.
- Aktiviti: Perkhidmatan makanan 107,129 pertubuhan (RM82.8B) | Katering acara 16,208 (RM6.7B) | Perkhidmatan minuman 13,116 (RM9.4B).
- Taraf sah: **Milikan perseorangan 120,495 (88.3%)** output RM50.6B (51%); **Sdn Bhd 10,847 (8.0%)** output RM43.7B (44.1%) — purata RM4.0M per Sdn Bhd vs RM420k per enterprise.
- Negeri: **Selangor 40% output (RM39.9B)**, Johor RM8.9B, P.Pinang RM7.0B.
- Isyarat: bilangan pertubuhan susut 167,490 (2015) -> 136,453 (2022) (nota: kaedah banci berbeza, tapi arah konsisten dengan persaingan tinggi).
- Implikasi bot: 88% pasaran = enterprise kecil — bot perlu "bahasa" murah & mudah (Sheets/WhatsApp), bukan ERP berat.

### 1.3 Harga & kuasa beli `[DISAHKAN]`
- CPI "Makanan di luar rumah" (COICOP 001): 2023 **+6.7%**, 2024 **+3.6%**, 2025 **+4.0%**, Sep 2026 **+2.6% YoY** (indeks 183.0). "Perkhidmatan penyediaan makanan & minuman" (111) Sep 2026 **+2.8% YoY**. Inflasi umum Sep 2026 +2.4%. (sumber: cpi_3d.csv + mcoicop.csv)
- CPI "Makanan di rumah" lebih lambat: +1.2% YoY Sep 2026 -> harga menu naik lebih pantas daripada kos mentah 2024-2026 = ruang margin bagi pengurusan kos cekap.
- Pendapatan isi rumah median: **RM7,017/bln (2024)** (hh_income.csv).
- Perdagangan borong & runcit (semua subsektor): RM1.87 trilion (2025); Ogo 2026 RM173.0B/bulan — F&B services ~4-5% daripadanya `[DISAHKAN - iowrt.csv]`.

---

## 2. TREN 2024-2026

### 2.1 Yang disahkan dengan data rasmi
1. **Pembayaran tanpa tunai meletup** `[DISAHKAN - channels.csv (BNM)]`: perbankan mudah alih RM13B (Jan 2019) -> **RM240B/bulan (Jun 2026)** (~18x); volum pengeluaran tunai ATM -35% (74M -> 48M/bulan). QR-ordering/e-wallet bukan lagi pilihan.
2. **Rekod 2025 sambil pekerja masih bawah 2019**: hasil +15% vs 2019 tetapi pekerja 858k < 895k (2019) `[DISAHKAN - DOSM]` -> tema produktiviti/automasi: lebih banyak hasil, lebih sedikit pekerja.
3. **Kos tenaga naik** `[DISAHKAN - wages_industry.csv]`: median gaji formal sektor penginapan & makanan RM1,912 (2024) -> **RM2,013 (2025)**, purata RM2,527. ~50% pekerja = "pekerja asas" (purata RM1,492/bln, banci 2022).
4. **Sewa komersial bertambah SST 8% (rental/leasing, ambang RM500k, 1 Jul 2025)** `[DISAHKAN - MySST FAQ 2025]` — beban sewa F&B naik bila tuan premis berdaftar SST.
5. **Konteks global**: ketegangan komisen platform vs restoran & kritikan ekonomi unit cloud kitchen (CloudKitchens) diperdebat sejak 2020-2023 `[DISAHKAN - wujud diskusi; HN Algolia]`.

### 2.2 Tren industri yang TIDAK dapat disahkan di sini `[ANGGARAN - perlu semakan]`
- **Delivery**: Grab/Foodpanda/ShopeeFood — komisen lazim dilaporkan **25-35%** per pesanan (halaman merchant rasmi tidak mendedahkan angka; grab.com/my/merchant = 200 tanpa angka; shopeefood.com.my DNS gagal di sini). Promo pula lazimnya kos merchant tambahan 10-20% `[ANGGARAN]`.
- **Cloud kitchen / jenama maya**: CAPEX lebih rendah ~40-60% vs kedai fizikal; risiko utama = pengurutan algoritma platform & kehilangan ingatan jenama `[ANGGARAN]`.
- **Kopi/teh rantai**: Tealive (>800), ZUS (>600), Mixue (>1,500 cawangan MY) dilaporkan media `[ANGGARAN - semak laporan tahunan syarikat]`.
- **TikTok/WhatsApp viral marketing**; ekonomi bazar Ramadhan (bagi sesetengah outlet, jualan bazar boleh capai 30-50% jualan bulan itu `[ANGGARAN]`); minuman berfungsi/sihat; kopitiam revival.

---

## 3. PERATURAN & PERMOHONAN LESEN (senarai semak)

### 3.1 Pendaftaran entiti — SSM `[DISAHKAN-parsial: portal 200; jadual yuran tidak diekstrak -> yuran diletak ANGGARAN]`
- **Enterprise (Sole Prop/Perkongsian)**: ROB Akta Pendaftaran Perniagaan 1956; yuran lazim **RM30/tahun (nama sendiri) / RM60/tahun (nama dagang)** `[ANGGARAN - perlu semakan]`.
- **Sdn Bhd (Akta Syarikat 2016)**: yuran pendaftaran lazim **RM1,010** `[ANGGARAN - perlu semakan]`.
- **Lesen WRT (KPDN)**: wajib utk syarikat asing >=50% ekuiti; modal berbayar min **RM1 juta** `[ANGGARAN - kpdn.gov.my gagal TLS]`.

### 3.2 Lesen premis PBT & keselamatan makanan
- Lesen premis/kedai tahunan **PBT (DBKL/MBPJ dll.)** + tanda papan; lesen khusus (hiburan/karaoke) berasingan `[ANGGARAN - amaun ikut PBT]`.
- **Akta Makanan 1983 & Peraturan-Peraturan Makanan 1985** — undang-undang teras keselamatan makanan `[DISAHKAN-parsial: wujud/umum; portal MOH disekat challenge JS]`.
- **Peraturan-Peraturan Kebersihan Makanan 2009**: **kursus pengendalian makanan** wajib utk pengendali makanan — lazim RM50-70, 1 hari, sertifikat sah 5 tahun `[ANGGARAN]`.
- **Vaksin antitifoid** pengendali makanan — lazim disyaratkan PBT, booster ~3 tahun `[ANGGARAN]`.

### 3.3 Halal — JAKIM `[DISAHKAN-parsial]`
- Portal **halal.gov.my hidup (200)**; permohonan domestik via **MYeHALAL (myehalal.halal.gov.my/domestik/v1)** `[DISAHKAN]`.
- Carta perkhidmatan JAKIM: sijil dikeluarkan **dalam 30 hari** selepas bayaran & prosedur lengkap `[DISAHKAN - halal.gov.my "Client Charter"]`.
- Prosedur semasa: pekeliling **PPSHM Bil.1/2026 & Bil.2/2026 + PLH MAC 2026** tersedia di portal `[DISAHKAN - senarai]; kandungan PDF dilindungi SPA (tidak diekstrak)`.
- Validiti sijil **2 tahun** + pemantauan; yuran tahunan ikut kategori premis lazim **RM100-RM1,000+** `[ANGGARAN - perlu semakan PPSHM]`. Syarat utama: panel halal dalaman, sumber mentah halal, SSM aktif, kebersihan premis.

### 3.4 Cukai — SEMAKAN PENTING `[DISAHKAN - MySST, kod perkhidmatan 9902.01.2651]`
- **F&B = Kumpulan B, kadar 6% — BUKAN 8%.** FAQ rasmi: "kadar 8% untuk semua perkhidmatan boleh cukai kecuali F&B, Logistik, Telekomunikasi, Parking (6%)". F&B dimasukkan ke SST mulai 1 Mac 2024 pada kadar **6%**; kenaikan 6%->8% hanya untuk kategori lain (juga 1 Mac 2024).
- **Ambang pendaftaran F&B: RM1,500,000** perkhidmatan boleh cukai dalam 12 bulan (restoran/bar/kafeteria/katerer/pengendali food court; termasuk eat-in & take-away; kecuali kafeteria institusi pendidikan/keagamaan).
- **Rental/leasing: 8%, ambang RM500k, efektif 1 Jul 2025** — semak kontrak sewa & sewa peralatan.
- Arahan bot: hardcode 6% untuk F&B berdaftar; jangan guna 8% pada resit makanan.

### 3.5 Tenaga kerja
- **EPF (KWSP)**: majikan 13% (gaji <=RM5,000) / 12% (>RM5,000); pekerja 11% `[ANGGARAN - epf.gov.my timeout]`.
- **SOCSO + EIS (PERKESO)**: majikan ~1.75% gabungan; pekerja 0.5% `[ANGGARAN]`.
- **Gaji minimum RM1,700/bln** efektif 1 Feb 2025 (majikan <5 pekerja fasa kemudian) `[ANGGARAN - perlu semakan perakuan]; median sektor RM2,013 (2025) DISAHKAN DOSM`.
- Pekerja asing: permit sektor perkhidmatan + kuota `[ANGGARAN]`.

---

## 4. EKONOMI UNIT F&B (asas model bot)

### 4.1 Piawaian industri `[ANGGARAN - perlu semakan; tiada dataset rasmi P&L terbuka]`
| Baris | Julat sihat | Catatan |
|---|---|---|
| Kos bahan makanan | **28-35%** jualan | Kawal via recipe costing & sisa |
| Kos tenaga | **25-35%** | Mamak 24j tinggi; delivery-only rendah |
| Sewa | **10-15%** | KL/Selangor tertinggi |
| Komisen delivery | **25-35%/pesanan** | Margin selepas komisen kerap <20% |
| Utiliti & lain | 8-12% | |
| Untung bersih sasaran | 5-10% | <5% = rapuh |

- Cross-check rasmi: nilai tambah/output industri = **44.3%** (banci 2022) — konsisten dgn input perantaraan ~56% `[DISAHKAN]`.
- **Sisa (waste)**: sasaran <3% jualan `[ANGGARAN]`.
- **BEP**: BEP = Kos Tetap / (1 - Kos Pembolehubah%); bot kira BEP mingguan & amaran bila jualan <1.1x BEP `[reka bentuk]`.
- **Kadar kegagalan**: tiada statistik rasmi penutupan restoran dijumpai (SSM penamatan tiada API terbuka di sini). Klise "30% tutup <3 tahun / >50% dalam 5 tahun" = global `[ANGGARAN]`. Titik rasmi: pertubuhan 167k->136k (2015->2022) `[DISAHKAN]`.
- **Harga rujukan**: DOSM PriceCatcher ada item "MAKANAN SIAP MASAK" (nasi lemak, nasi goreng ayam, kopi panas dsb.) tetapi **fail harian 404** semasa sidang; hanya lookups hidup — semak pricecatcher.gov.my kemudian.

---

## 5. ENAM SENARIO PERNIAGAAN (semua julat modal `[ANGGARAN]` melainkan dinyatakan)

| # | Senario | Modal permulaan | Kakitangan | Margin kasar tipikal | Saluran jualan | Risiko utama | KPI utama | Kesesuaian bot AI |
|---|---|---|---|---|---|---|---|---|
| a | **Kopitiam/Mamak 24 jam** | RM150k-400k | 8-15 (2-3 syif) | 35-45% | Walk-in + WhatsApp pre-order + delivery | kos tenaga 24j, keletihan, kebersihan, SST bila >RM1.5M | jualan/jam, food-cost %, turn meja | TINGGI: roster syif, inventory, amaran stok, WhatsApp order |
| b | **Kafe khas / kopi rantai** | RM300k-800k (francais + fit-out) | 5-10 | 55-70% (kopi) | Dine-in + delivery + QR loyalty | tepu pasaran bandar, sewa, CAC promo | cawan/hari, % pelanggan berulang, rating Google | TINGGI: loyalty QR, reply-review, ujian menu, P&L mingguan |
| c | **Dapur awan / jenama maya** | RM50k-150k | 3-6 | 50-60% (pra-komisen) | Grab/Foodpanda/ShopeeFood 100% | komisen 25-35%, ranking algoritma, konflik jenama | margin sumbangan/pesanan selepas komisen, kadar batal | SANGAT TINGGI: sync menu pelplatform, optimizer promo, ramalan permintaan |
| d | **Restoran keluarga / steamboat / BBQ** | RM200k-500k | 8-12 | 45-55% | Dine-in + tempahan WhatsApp + korporat | bahan basah terbuang, musiman (CNY/Ramadhan), gas | turn meja, waste %, tempahan awal | TINGGI: tempahan+deposit, senarai beli automatik, planning pre-cut |
| e | **Katering & acara (B2B/kahwin/korporat)** | RM30k-100k | 5-10 + krew acara | 35-50% | tender, grup FB/WhatsApp, penganjur | aliran tunai deposit, kejar harga, deposit akhir | margin per pax, pipeline bernilai, kadar tutup | SANGAT TINGGI: jana sebut harga, siri follow-up, jadual acara, inventori |
| f | **Food truck / bazar Ramadhan / pop-up** | RM5k-20k gerai; RM40k-80k truck | 2-5 | 55-65% | lokasi bazar, TikTok/IG lokasi harian, walk-in | permit/lot bazar, cuaca, halal bahan, stok | jualan/jam per lokasi, kos bahan/unit, untung harian | TINGGI: pengurusan lokasi, senarai prep, kandungan TikTok auto |

- Sokongan data: katering = RM6.7B (16.2k pertubuhan) & minuman RM9.4B (13.1k) `[DISAHKAN - banci]` — senario (e) & (f) bukan ceruk kecil.
- Sahkan modal sebenar dengan temuduga operator sebelum bot menasihat angka kemas.

---

## 6. PEMASARAN & JUALAN TEMPATAN

### 6.1 Kanal yang WORK `[ANGGARAN-arsitektur; disokong data digital DISAHKAN]`
1. **TikTok + IG Reels**: kandungan "hidden gem", POV chef, harga jujuk — kesedaran & percubaan.
2. **WhatsApp Business + broadcast**: tempahan, senarai menunggu, promo Ramadhan/Raya; asas CRM (Q7).
3. **Google Maps/GBusiness reviews**: trafik "kedai makan dekat sini" — minta review selepas bil; balas semua review.
4. **Ranking platform delivery**: masa penyediaan pendek, kadar batal rendah, foto menu, promo didanai `[ANGGARAN]`.
5. **Loyalty QR / punch card**: murah, cocok kopi/mamak (ulang lawatan).
6. **Linktree/bio pages**: menu -> WhatsApp -> Google Maps dalam 3 klik.
7. **Kalendar bazar Ramadhan / Raya / CNY**: FOMO + pre-order, premium diterima `[ANGGARAN]`.

### 6.2 Funnel tipikal F&B MY
```
Kesedaran (TikTok/Maps/delivery app) -> Percubaan (diskaun 1st order / QR) -> Berulang (WhatsApp broadcast + loyalty) -> Advokasi (review/share)
```
- Metrik bot: % ulang lawatan 30-hari, CAC vs LTV, kadar buka broadcast, jualan/jam per slot promo.
- Anchor digital: mobile banking RM240B/bln & ATM -35% `[DISAHKAN]` — pembayaran QR/resit digital tiada halangan.

### 6.3 Kelompongan riset
- Reddit 403 walaupun dengan browser-UA (dicuba sekali); FB groups perlukan login — "ground truth" operator (contoh: untung lot bazar) belum ditarik; gunakan temuduga operator sebagai sumber manual bot.

---

## 7. CRM & AUTOMASI REALITI UNTUK SME F&B MALAYSIA

### 7.1 Realiti semasa `[ANGGARAN - amalan lazim; tiada tinjauan rasmi dijumpai]`
- **WhatsApp-first CRM**: pemilik ("toke") guna WhatsApp peribadi + broadcast; WhatsApp Business API (perlu BSP/kos per-tblgn) masih rendah adopsi SME kecil.
- **Excel/Google Sheets CRM**: paling umum (stok, gaji, tempahan katering) — bot mesti boleh baca/tulis Sheets, jangan desak ERP.
- **Loyalty punch card fizikal/QR** di kafe; POS tempatan (StoreHub dll.) dengan laporan ringkas `[ANGGARAN - tinjauan vendor tidak dijalankan]`.
- **Integrasi rasmi delivery**: SDK rasmi Grab Food wujud (Python/Go) di GitHub `[DISAHKAN - repos grab/grabfood-api-sdk-python & -go, 200]` — laluan integrasi merchant yang sah.

### 7.2 Cadangan pasukan bot (dari data di atas)
1. **Bot Juruwang**: P&L mingguan dari Sheets/POS; kalkulator SST 6% ambang RM1.5M; EPF/SOCSO; amaran BEP.
2. **Bot Stok & Sisa**: recipe costing, amaran sisa >3%, forecast pre-order Ramadhan.
3. **Bot Pemasaran**: cron idea kandungan TikTok/IG; auto-broadcast WhatsApp senarai pelanggan berulang; monitor & reply review Google.
4. **Bot Delivery Ops**: metrik platform, margin selepas komisen per item, cadangan harga pasca-komisen (contoh: RM15 -> bida RM20.90 bila komisen 30%) `[ANGGARAN komisen]`.
5. **Bot Pematuhan**: kalendar lesen PBT, kursus pengendalian (5 thn), vaksin typhoid (3 thn), halal audit 2-tahun, tarikh akhir SST-02.
- Prinsip: **bot MELAPOR & MENYEDIA, manusia memutuskan** — sesuai untuk 88% pemilik enterprise perseorangan.

---

## 8. KEGAGALAN & BATASAN RISET (jujur)
- MCP tempatan `127.0.0.1:4210/mcp`: HIDUP (200) tetapi hanya **6 set data demo** (births, deaths, marriages, population_state, life_expectancy, electricity_consumption); `ambil_dataset` guna param `id_set_data`.
- data.gov.my CKAN `/api/3/action/package_search` -> HTML 404 (API lama ditamatkan); api.data.gov.my hanya melayan 6 id sama (404 utk wretail/cpi dsb.).
- open.dosm.gov.my laman 200 tetapi `/api/1.0/*` & laman dataset 404 — data diperoleh dari **storage.dosm.gov.my / storage.data.gov.my** (CSV/XLSX statik) + katalog GitHub **data-gov-my/datagovmy-meta** (jalan pintas berkesan).
- PriceCatcher harian: 404 semua tarikh dicuba (2025-06 -> 2026-11); lookups sahaja hidup.
- MOH: moh.gov.my timeout; hq.moh.gov.my 200 tapi challenge JS; JAKIM DNS gagal; EPF/SOCSO/KPDN tidak dapat diakses; Reddit 403 (cuba browser-UA sekali).
- Angka yuran halal/SSM & gaji minimum perlu semakan manual (telefon/portal) sebelum bot mengaku.

---

## 9. SUMBER (semua URL diuji curl; kod status diberikan)

**Data rasmi (semua 200, ditarik & dihurai):**
1. `https://storage.dosm.gov.my/services/services_2026-q2.xlsx` — 200 — **(sumber utama saiz pasaran)** hasil/pekerja/gaji F&B 2019-2026Q2p
2. `https://storage.dosm.gov.my/census/census_economy_2022_subsector_i_fnb.xlsx` — 200 — 136,453 pertubuhan, output, taraf sah, negeri, kategori pekerja
3. `https://storage.dosm.gov.my/cpi/cpi_3d.csv` — 200 — indeks bulanan: 001=Makanan di luar rumah, 111=Perkhidmatan penyediaan makanan & minuman
4. `https://storage.dosm.gov.my/dictionaries/mcoicop.csv` — 200 — kamus COICOP BM/EN
5. `https://storage.dosm.gov.my/iowrt/iowrt.csv` — 200 — Indeks Perdagangan Borong & Runcit bulanan
6. `https://storage.dosm.gov.my/labour/wages_industry.csv` — 200 — gaji median/purata sektor (seksyen I)
7. `https://storage.data.gov.my/finsector/payments/channels.csv` — 200 — BNM: elektronik vs tunai
8. `https://storage.dosm.gov.my/hies/hh_income.csv` — 200 — pendapatan isi rumah median RM7,017 (2024)
9. `https://storage.data.gov.my/pricecatcher/lookup_item.csv` & `lookup_premise.csv` — 200; `pricecatcher_YYYY-MM-DD.csv` — **404**

**Metadata katalog (GitHub):**
10. `https://api.github.com/search/repositories?q=...` — 200 (org listing `data-gov-my` — 404; guna search API)
11. `https://raw.githubusercontent.com/data-gov-my/datagovmy-meta/main/...` — 200 — pautan semua dataset DOSM (data-catalogue/*.json, pub-dosm/publications/*.json)
12. `https://api.github.com/repos/grab/grabfood-api-sdk-python` / `-go` (dijumpai via search) — 200 — SDK rasmi Grab Food

**Regulator:**
13. `https://mysst.customs.gov.my/` — 200 — portal SST RMCD
14. `https://mysst.customs.gov.my/faq-services-tax/` — 200 — **"8% kecuali F&B/Logistik/Telco/Parking = 6%"**; 1 Mac 2024
15. `https://mysst.customs.gov.my/registering-business/` — 200 — **Kumpulan B F&B kod 9902.01.2651, ambang RM1,500,000**
16. `https://mysst.customs.gov.my/faq-expansion-of-service-tax-scope-2025/` — 200 — sewa/leasing 8%, ambang RM500k, 1 Jul 2025
17. `https://www.hasil.gov.my/` — 200 (tidak digali lanjut)
18. `https://www.halal.gov.my/` — 200 — carta perkhidmatan 30 hari; MYeHALAL; pekeliling PPSHM Bil.1-2/2026, PLH MAC 2026
19. `https://myehalal.halal.gov.my/portal-halal/v1/pdf/pekeliling/PPSHMBIL1-2026.pdf` — 200 (kandungan HTML SPA, PDF tidak diperoleh)
20. `https://www.ssm.com.my/` — 200 (jadual yuran tidak diekstrak)
21. `https://hq.moh.gov.my/food-safety/` — 200 tapi challenge JS; `https://moh.gov.my/` — 000 timeout

**Gagal / disekat:**
22. `jakim.gov.my`, `ehalal.jakim.gov.my`, `fsq.moh.gov.my` — 000 DNS; `epf.gov.my`, `perkeso.gov.my`, `moh.gov.my` — 000 timeout; `kpdn.gov.my` — 000 TLS
23. `reddit.com/...json` — **403** (dengan browser-UA); ganti `https://hn.algolia.com/api/v1/search` — 200
24. `grab.com/my/merchant/` — 200 (tiada angka komisen); `foodpanda.my` — 200 generik; `shopeefood.com.my` — 000 DNS
25. `open.dosm.gov.my/` — 200; `/api/1.0/wretail`, `/wretail`, `/cpi` — 404
26. `http://127.0.0.1:4210/mcp` — 200 — 6 set data demo sahaja

---

## 10. SEPULUH (10) PENEMUAN PALING PENTING UNTUK PASUKAN BOT

1. **Saiz pasaran kini disahkan: RM83.0B (2025, +10.4%); Q1/Q2 2026 RM22.1B/RM22.4B per suku** — gunakan DOSM ST2 sebagai angka sandar bot.
2. **Dakwaan "SST 8% F&B" SALAH** — MySST rasmi: F&B = **6%**, ambang RM1.5M/12 bln (8% ialah kategori lain); sewa premis/peralatan = **8% dari 1 Jul 2025** (ambang RM500k) — bot mesti hardcode 6% utk F&B & beri amaran +8% sewa bila tuan premis berdaftar.
3. **Pasaran ekor panjang: 88% pertubuhan = milikan perseorangan (purata output RM420k); Sdn Bhd 8% tapi 44% output (purata RM4.0M)** — bot perlu dua mod: "enterprise murah" (Sheets+WhatsApp) & "syarikat" (SST/halal/P&L penuh).
4. **Selangor = 40% output F&B negara (RM39.9B)** — geo-prioriti bot: KL/Selangor dahulu.
5. **Inflasi makanan-luar-rumah sentiasa atas inflasi umum** (+6.7% '23, +3.6% '24, +4.0% '25; Sep-2026 +2.6% vs umum +2.4%) — pasaran terima repricing; bot boleh cadangkan semakan harga menu setiap suku mengikut CPI 001.
6. **Kekurangan tenaga struktur**: hasil +15% vs 2019 tapi pekerja (858k) masih < 2019 (895k) — pitch automasi (QR order, forecast stok, roster) paling kuat.
7. **Gaji sektor makanan: median RM2,013/bln (2025 DOSM); pekerja asas purata RM1,492/bln (banci 2022); gaji minimum RM1,700** — model kos tenaga bot: RM1,700-2,200 pekerja, RM2,600+ penyelia `[ANGGARAN]`.
8. **Pembayaran digital 18x (RM13B -> RM240B/bulan 2019->2026) & ATM -35%** — QR-ordering/e-wallet wajib dalam semua senario; bot perlu integrasi POS/e-wallet.
9. **Komisen delivery 25-35% belum disahkan rasmi** `[ANGGARAN]` tapi **SDK rasmi Grab Food (Python/Go) wujud** — integrasi merchant sah; margin-selepas-komisen = KPI penting senario (c).
10. **Tiada data rasmi kadar kegagalan restoran**; isyarat rasmi tunggal: pertubuhan 167k -> 136k (2015->2022) `[DISAHKAN]` — bot JANGAN klaim "30% tutup dalam X tahun" sebagai fakta; guna ANGGARAN + amaran awal BEP.

---
*Disediakan untuk tugas `fnb-research`. Laporan: /tmp/fnb_malaysia_research.md. Data mentah: /tmp/cpi3d.csv, /tmp/svc_q2.xlsx, /tmp/census_fnb.xlsx, /tmp/iowrt.csv, /tmp/wages.csv, /tmp/channels.csv, /tmp/hhi.csv, /tmp/mcoicop.csv.*
