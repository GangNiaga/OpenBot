/**
 * Pelayan MCP "malaysia" - Data & Organisasi Malaysia untuk OpenBot.
 *
 * StreamableHTTP (MCP rasmi) pada port 4210, endpoint /mcp, mod tanpa-keadaan (stateless)
 * dengan jawapan JSON. Setiap permintaan diberi satu McpServer baharu, jadi tiada sesi
 * yang dikongsi antara Bot.
 *
 * Alat yang ditawarkan (semua baca sahaja):
 *  - senarai_kementerian            senarai kementerian persekutuan Malaysia
 *  - carta_organisasi_persekutuan   hierarki kerajaan persekutuan + carta Mermaid
 *  - senarai_negeri                 13 negeri + 3 Wilayah Persekutuan, ibu kota, ketua negeri
 *  - struktur_organisasi_templat    templat carta organisasi (kementerian, kerajaan negeri,
 *                                   Sdn Bhd, Berhad, GLC, SME, koperasi)
 *  - gred_perkhidmatan              gred perkhidmatan awam Malaysia (SSM/jawatan)
 *  - carian_dataset                 carian katalog data.gov.my (proksi, degradasi jujur)
 *  - ambil_dataset                  ambil baris set data dari data.gov.my (proksi)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";

const PORT = Number.parseInt(process.env.MALAYSIA_MCP_PORT ?? "4210", 10);

const CATATAN_DATA =
  "Data kurasi tempatan (dikemas kini awal 2025). Susunan kabinet dan jawatan boleh berubah melalui rombakan - sahkan dengan laman rasmi PMO Malaysia (pmo.gov.my) untuk pelantikan terkini.";

// ---------------------------------------------------------------- Kementerian
type Kementerian = { singkatan: string; nama: string; portfolio: string };

const KEMENTERIAN: Kementerian[] = [
  { singkatan: "JPM", nama: "Jabatan Perdana Menteri", portfolio: "Penyelarasan dasar kerajaan, unit-unit di bawah PM, SSKM/NRECC, agensi di bawah PM" },
  { singkatan: "MOF", nama: "Kementerian Kewangan", portfolio: "Bajet negara, fiskal, Treasury, LHDN, cukai" },
  { singkatan: "KPM", nama: "Kementerian Pendidikan", portfolio: "Pendidikan prasekolah, sekolah rendah dan menengah" },
  { singkatan: "KPT", nama: "Kementerian Pendidikan Tinggi", portfolio: "Universiti awam/swasta, politeknik, MQA, pinjaman PTPTN" },
  { singkatan: "KKM", nama: "Kementerian Kesihatan", portfolio: "Hospital, klinik, kesihatan awam, perubatan" },
  { singkatan: "KDN", nama: "Kementerian Dalam Negeri", portfolio: "Imigresen, polis (PDRM), pendaftaran (JPN), PERKESO? tidak - keselamatan dalam negeri" },
  { singkatan: "MINDEF", nama: "Kementerian Pertahanan", portfolio: "ATM (Tentera Darat, TUDM, TLDM), pertahanan negara" },
  { singkatan: "MITI", nama: "Kementerian Perdagangan Antarabangsa dan Perindustrian", portfolio: "Perdagangan antarabangsa, pelaburan (MIDA), FTA" },
  { singkatan: "KPDN", nama: "Kementerian Perdagangan Dalam Negeri dan Kos Sara Hidup", portfolio: "Perdagangan dalam negeri, kawalan harga, pengguna" },
  { singkatan: "MOT", nama: "Kementerian Pengangkutan", portfolio: "JPJ, pengangkutan darat, udara dan laut, keselamatan jalan raya" },
  { singkatan: "KKR", nama: "Kementerian Kerja Raya", portfolio: "Jalan raya (JKR), infrastruktur awam, LLM" },
  { singkatan: "KPKT", nama: "Kementerian Perumahan dan Kerajaan Tempatan", portfolio: "Perumahan, pihak berkuasa tempatan, SWAT/persampahan" },
  { singkatan: "KPLB", nama: "Kementerian Pembangunan Luar Bandar dan Wilayah", portfolio: "Pembangunan luar bandar, KEMAS, RISDA, FELDA" },
  { singkatan: "KPKM", nama: "Kementerian Pertanian dan Keterjaminan Makanan", portfolio: "Pertanian, perikanan, keterjaminan makanan" },
  { singkatan: "MPPK", nama: "Kementerian Perusahaan Perladangan dan Komoditi", portfolio: "Sawit, getah, koko, komoditi (MPOB, MRB)" },
  { singkatan: "KSM", nama: "Kementerian Sumber Manusia", portfolio: "Perburuhan, JTK, SOCSO/PERKESO, KWSP (pemantauan), keselamatan pekerjaan (DOSH)" },
  { singkatan: "PETRA", nama: "Kementerian Peralihan Tenaga dan Transformasi Air", portfolio: "Tenaga, elektrik, TNB (pemantauan), transformasi air" },
  { singkatan: "NRES", nama: "Kementerian Sumber Asli dan Kelestarian Alam", portfolio: "Perhutanan, mineral, alam sekitar, hidrologi" },
  { singkatan: "KPWKM", nama: "Kementerian Pembangunan Wanita, Keluarga dan Masyarakat", portfolio: "Wanita, keluarga, kanak-kanak (SWP), JKM, LPPKN" },
  { singkatan: "KUSKOP", nama: "Kementerian Pembangunan Usahawan dan Koperasi", portfolio: "SME, usahawan, koperasi (SME Corp, TEKUN)" },
  { singkatan: "MOTAC", nama: "Kementerian Pelancongan, Seni dan Budaya", portfolio: "Pelancongan, seni, warisan, budaya" },
  { singkatan: "KOM", nama: "Kementerian Komunikasi", portfolio: "Penyiaran (RTM), maklumat, komunikasi awam, MCMC (pemantauan)" },
  { singkatan: "MOSTI", nama: "Kementerian Sains, Teknologi dan Inovasi", portfolio: "Sains, teknologi, R&D, komersial (MDEC? tidak - MOSTI)" },
  { singkatan: "KBS", nama: "Kementerian Belia dan Sukan", portfolio: "Pembangunan belia, sukan, IBSAM, MSN" },
  { singkatan: "KPN", nama: "Kementerian Perpaduan Negara", portfolio: "Perpaduan nasional, RUKUN Negara, ikon perpaduan" },
];

// ---------------------------------------------------------------- Struktur persekutuan
const STRUKTUR_PERSEKUTUAN = {
  tajuk: "Struktur Kerajaan Persekutuan Malaysia",
  hierarki: [
    "Yang di-Pertuan Agong - Ketua Negara (raja berperlembagaan; dipilih setiap 5 tahun daripada 9 Raja Melayu oleh Mesyuarat Raja-Raja)",
    "Perdana Menteri - Ketua Kerajaan (pimpinan majoriti Dewan Rakyat)",
    "Timbalan Perdana Menteri",
    "Jemaah Menteri (Kabinet) - Menteri-menteri yang mengetuai kementerian; dilantik oleh YDP Agong atas nasihat PM",
    "Timbalan Menteri dan Setiausaha Parlimen",
    "Ketua Setiausaha Negara (KSN) - ketua Perkhidmatan Awam Malaysia; Ketua Setiausaha (KSU) mengetuai setiap kementerian, dibantu Timbalan KSU",
    "Bahagian / Jabatan dalam kementerian - diketuai Setiausaha Bahagian / Ketua Pengarah",
    "Agensi dan jabatan di bawah kementerian (contoh: LHDN di bawah MOF, JPJ di bawah MOT)",
  ],
  parlimen:
    "Parlimen Malaysia dwi-dewan: Dewan Rakyat (222 ahli dipilih) dan Dewan Negara (70 ahli dilantik). Kuasa perundangan persekutuan di bawah Senarai Persekutuan (Senarai I, Jadual Sembilan, Perlembagaan Persekutuan).",
  catatan: CATATAN_DATA,
};

// ---------------------------------------------------------------- Negeri
type Negeri = { nama: string; ibu_kota: string; ketua_negeri: string; ketua_kerajaan: string };

const NEGERI: Negeri[] = [
  { nama: "Johor", ibu_kota: "Johor Bahru", ketua_negeri: "Sultan Johor", ketua_kerajaan: "Menteri Besar" },
  { nama: "Kedah", ibu_kota: "Alor Setar", ketua_negeri: "Sultan Kedah", ketua_kerajaan: "Menteri Besar" },
  { nama: "Kelantan", ibu_kota: "Kota Bharu", ketua_negeri: "Sultan Kelantan", ketua_kerajaan: "Menteri Besar" },
  { nama: "Negeri Sembilan", ibu_kota: "Seremban", ketua_negeri: "Yang di-Pertuan Besar Negeri Sembilan", ketua_kerajaan: "Menteri Besar" },
  { nama: "Pahang", ibu_kota: "Kuantan", ketua_negeri: "Sultan Pahang", ketua_kerajaan: "Menteri Besar" },
  { nama: "Perak", ibu_kota: "Ipoh", ketua_negeri: "Sultan Perak", ketua_kerajaan: "Menteri Besar" },
  { nama: "Perlis", ibu_kota: "Kangar", ketua_negeri: "Raja Perlis", ketua_kerajaan: "Menteri Besar" },
  { nama: "Selangor", ibu_kota: "Shah Alam", ketua_negeri: "Sultan Selangor", ketua_kerajaan: "Menteri Besar" },
  { nama: "Terengganu", ibu_kota: "Kuala Terengganu", ketua_negeri: "Sultan Terengganu", ketua_kerajaan: "Menteri Besar" },
  { nama: "Pulau Pinang", ibu_kota: "George Town", ketua_negeri: "Yang di-Pertua Negeri Pulau Pinang", ketua_kerajaan: "Ketua Menteri" },
  { nama: "Melaka", ibu_kota: "Melaka City (Bandaraya Melaka)", ketua_negeri: "Yang di-Pertua Negeri Melaka", ketua_kerajaan: "Ketua Menteri" },
  { nama: "Sabah", ibu_kota: "Kota Kinabalu", ketua_negeri: "Yang di-Pertua Negeri Sabah", ketua_kerajaan: "Ketua Menteri" },
  { nama: "Sarawak", ibu_kota: "Kuching", ketua_negeri: "Yang di-Pertua Negeri Sarawak", ketua_kerajaan: "Premier Sarawak (dahulu Ketua Menteri)" },
];

const WILAYAH_PERSEKUTUAN = [
  { nama: "Wilayah Persekutuan Kuala Lumpur", pentadbiran: "DBKL (Dewan Bandaraya Kuala Lumpur), di bawah JPM" },
  { nama: "Wilayah Persekutuan Putrajaya", pentadbiran: "Perbadanan Putrajaya, di bawah JPM" },
  { nama: "Wilayah Persekutuan Labuan", pentadbiran: "Korporasi Labuan / LPA, di bawah JPM" },
];

// ---------------------------------------------------------------- Gred perkhidmatan awam
const GRED = {
  tajuk: "Gred Perkhidmatan Awam Malaysia (Skim Saraan)",
  kumpulan: [
    {
      nama: "Kumpulan Pengurusan dan Profesyonal (Gred P)",
      gred: ["Gred 41 (permulaan profesional, cth. Pegawai Tadbir N41, Pegawai Sains Q41)", "Gred 43", "Gred 44 (kemahiran penuh)", "Gred 48 (pengurusan pertengahan)", "Gred 52 (pengurusan kanan)", "Gred 53", "Gred 54 (pengurusan tertinggi sebelum JUSA)"],
    },
    {
      nama: "Kumpulan Pengurusan Tertinggi (Gred Khas)",
      gred: ["JUSA C (Timbalan Ketua Pengarah / Timbalan KSU)", "JUSA B (Ketua Pengarah / Timbalan KSU)", "JUSA A (KSU / Ketua Pengarah kanan)", "JUSA Utama", "Gred Turus I / II / III (Pegawai Tadbir Diplomatik, PTD kanan)"],
    },
    {
      nama: "Kumpulan Pelaksana (Gred E)",
      gred: ["Gred 19 (cth. Pembantu Tadbir N19)", "Gred 27", "Gred 29"],
    },
  ],
  catatan:
    "Nama gred berbeza mengikut skim (N = Pentadbiran, Q = Sains, E = Kejuruteraan, W = Badan berkanun, dsb.). Kenaikan pangkat melalui Penilaian Kecekapan dan Tokokan (PTT) / laluan pantas. Sumber: PSD (jpa.gov.my).",
};

// ---------------------------------------------------------------- Templat organisasi
type Templat = {
  id: string;
  nama: string;
  perihal: string;
  mermaid: string;
  peranan: string[];
};

const TEMPLAT: Templat[] = [
  {
    id: "kementerian",
    nama: "Kementerian Persekutuan Malaysia",
    perihal: "Struktur umum sebuah kementerian persekutuan.",
    mermaid: [
      "flowchart TD",
      "  MENTERI[Menteri] --> TKSU1[Timbalan KSU - Dasar]",
      "  MENTERI --> TKSU2[Timbalan KSU - Operasi / Sistem Pengurusan]",
      "  MENTERI --> KSU[Ketua Setiausaha KSU]",
      "  KSU --> B1[Bahagian Dasar / Penyelarasan]",
      "  KSU --> B2[Bahagian Pengurusan / Perakaunan / Teknologi]",
      "  KSU --> AG1[Agensi / Jabatan di bawah kementerian]",
      "  AG1 --> KP[Ketua Pengarah / Pengarah Agensi]",
      "  KP --> Negeri[Pejabat / Cawangan Negeri]",
    ].join("\n"),
    peranan: [
      "Menteri - ketua politik kementerian, dasar dan jawatan awam di Parlimen",
      "KSU - ketua perkhidmatan kementerian, penasihat utama Menteri",
      "TKSU - bantu KSU mengawal dasar atau operasi",
      "Setiausaha Bahagian / Setiausaha Kanan - ketua bahagian dasar",
      "Penolong Pengarah / Pegawai - pelaksana dasar dan analisis",
      "Ketua Pengarah agensi - ketua eksekutif agensi di bawah kementerian",
    ],
  },
  {
    id: "kerajaan-negeri",
    nama: "Kerajaan Negeri Malaysia",
    perihal: "Struktur umum pentadbiran kerajaan negeri.",
    mermaid: [
      "flowchart TD",
      "  KN[Ketua Negeri - Sultan / YDP Agong / Yang di-Pertua Negeri] --> MB[Menteri Besar / Ketua Menteri]",
      "  MB --> TMB[Timbalan Menteri Besar / Timbalan Ketua Menteri]",
      "  MB --> EXCO[Majlis Mesyuarat Kerajaan Negeri EXCO]",
      "  EXCO --> SUK[Ketua Setiausaha Kerajaan Negeri SUK]",
      "  SUK --> J1[Jabatan negeri]",
      "  SUK --> PBT[Pihak Berkuasa Tempatan - Majlis Bandaraya / Perbandaran / Daerah]",
      "  MB --> DUN[Dewan Undangan Negeri DUN - penggubal undang-undang negeri]",
    ].join("\n"),
    peranan: [
      "Ketua Negeri - Sultan/YDP (9 negeri beraja) atau Yang di-Pertua Negeri (dilantik, 4 negeri + WP)",
      "Menteri Besar / Ketua Menteri - ketua kerajaan negeri",
      "EXCO - menteri negeri, setiap satu membawa portfolio",
      "SUK - ketua perkhidmatan negeri, selari dengan KSU persekutuan",
      "PBT - pentadbiran tempatan seperti MBPJ, DBKL, MBJB",
    ],
  },
  {
    id: "syarikat-sdn-bhd",
    nama: "Syarikat Sendirian Berhad (Sdn Bhd)",
    perihal: "Struktur umum syarikat persendirian kecil hingga sederhana di Malaysia.",
    mermaid: [
      "flowchart TD",
      "  LP[Lembaga Pengarah] --> CEO[Pengarah Urusan / Ketua Pegawai Eksekutif CEO]",
      "  CEO --> COO[Ketua Pegawai Operasi COO]",
      "  CEO --> CFO[Ketua Pegawai Kewangan CFO]",
      "  CEO --> CTO[Ketua Pegawai Teknologi CTO]",
      "  CEO --> HR[Ketua Sumber Manusia]",
      "  CEO --> CMO[Ketua Pemasaran / Jualan]",
      "  COO --> Ops[Jabatan Operasi]",
      "  CFO --> Fin[Jabatan Kewangan / Akaun]",
    ].join("\n"),
    peranan: [
      "Pemegang saham - pemilik syarikat (Akta Syarikat 2016)",
      "Lembaga Pengarah - pengurusan korporat dan fidusiari",
      "Pengarah Urusan / CEO - pelaksanaan strategi dan operasi harian",
      "CFO - kewangan, akaun, cukai (LHDN e-Invois)",
      "Ketua Sumber Manusia - PERKESO, KWSP, PCB, HRD Corp",
    ],
  },
  {
    id: "syarikat-berhad",
    nama: "Syarikat Awam Berhad (Berhad / Bursa Malaysia)",
    perihal: "Struktur syarikat tersenarai dengan keperluan pematuhan Bursa Malaysia.",
    mermaid: [
      "flowchart TD",
      "  AGM[Pemegang Saham - AGM] --> LP[Lembaga Pengarah]",
      "  LP --> AUD[Jawatankuasa Audit]",
      "  LP --> RISK[Jawatankuasa Risiko / Nominasi / Ganjaran]",
      "  LP --> SEC[Setiausaha Syarikat - wajib untuk Berhad]",
      "  LP --> CEO[Pengarah Urusan / CEO]",
      "  CEO --> COO[COO]",
      "  CEO --> CFO[CFO - Pelaporan Kewangan Bursa]",
      "  CEO --> IAD[Audit Dalaman]",
      "  CEO --> COMP[Ketua Pematuhan / IR]",
    ].join("\n"),
    peranan: [
      "Jawatankuasa Audit - wajib untuk syarikat tersenarai (Bursa Main Market)",
      "Setiausaha Syarikat - wajib di bawah Akta Syarikat 2016",
      "Audit Dalaman - melaporkan terus kepada Jawatankuasa Audit",
      "Pengarah Bebas - sekurang-kurangnya dua (Main Market), berkaitan CG Code",
    ],
  },
  {
    id: "glc",
    nama: "Syarikat GLC / Badan Berkanun",
    perihal: "Struktur GLC di bawah GLIC, dan badan berkanun persekutuan.",
    mermaid: [
      "flowchart TD",
      "  GOV[Kerajaan Malaysia - Menteri Rujukan] --> GLIC[GLIC - Khazanah Nasional, EPF, KWAP, LTAT, LTH]",
      "  GLIC --> BOD[Lembaga Pengarah GLC]",
      "  BOD --> MD[Pengarah Urusan / Group CEO]",
      "  MD --> BIZ[Divisyen Perniagaan / Subsidiari]",
      "  MD --> CORP[Korporat - Kewangan, HR, Strategi, Risiko]",
      "  BOD --> AC[Jawatankuasa Audit / Risiko]",
    ].join("\n"),
    peranan: [
      "GLIC - institusi dana kerajaan yang memegang ekuiti kawalan",
      "GLC - contoh: PETRONAS, Maybank, TM, Sime Darby, Tenaga Nasional",
      "Governance code - Garis Panduan PCG (Putrajaya Committee on GLC High Performance)",
      "Badan berkanun - ditubuhkan di bawah akta (cth. MPOB, JPJ), audit oleh AG (Audit Negara)",
    ],
  },
  {
    id: "sme",
    nama: "SME / Perniagaan Kecil",
    perihal: "Struktur rata untuk perniagaan kecil dan sederhana.",
    mermaid: [
      "flowchart TD",
      "  OWNER[Pemilik / Founder CEO] --> OPS[Operasi & Pengeluaran]",
      "  OWNER --> SALES[Jualan & Pemasaran]",
      "  OWNER --> ACC[Kewangan & Akaun / akauntant berbayar]",
      "  OWNER --> ADM[Admin & HR]",
    ].join("\n"),
    peranan: [
      "Pemilik - lengan semua fungsi pada peringkat awal",
      "SME Malaysia - definisi SME Corp: peruncitan <RM20 juta turnover atau <75 pekerja (sektor perkhidmatan), pembuatan <RM50 juta atau <200 pekerja",
      "Sokongan - SME Corp, MIDF, MDEC, geran kerajaan",
    ],
  },
  {
    id: "koperasi",
    nama: "Koperasi Malaysia",
    perihal: "Struktur organisasi koperasi di bawah SKM (Suruhanjaya Koperasi Malaysia).",
    mermaid: [
      "flowchart TD",
      "  AGM[Perhimpunan Agung Anggota] --> JC[Jawatankuasa Koperasi]",
      "  JC --> Pengerusi[Pengerusi]",
      "  JC --> Setiausaha[Setiausaha]",
      "  JC --> Bendahari[Bendahari]",
      "  JC --> PJ[Micara / Pengurusan Eksekutif]",
    ].join("\n"),
    peranan: [
      "Jawatankuasa Koperasi - dilantik oleh anggota, di bawah Akta Koperasi 1993",
      "Pendaftaran dan pemantauan - Suruhanjaya Koperasi Malaysia (SKM)",
    ],
  },
];

// ---------------------------------------------------------------- data.gov.my proksi
async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- Server MCP
type MalaysiaServer = McpServer;

/**
 * Satu pabrik: setiap permintaan /mcp mendapat McpServer baharu dengan semua alat
 * didaftarkan, jadi tiada keadaan dikongsi antara Bot (selari dengan pola klien OpenBot
 * yang membina klien baharu untuk setiap panggilan).
 */
function buildMalaysiaServer(): MalaysiaServer {
  const server = new McpServer(
    { name: "malaysia", version: "1.0.0" },
    { instructions: "Pelayan data organisasi dan kerajaan Malaysia. Semua alat baca sahaja dan dalam Bahasa Melayu." },
  );

// 1. senarai_kementerian
  server.registerTool(
  "senarai_kementerian",
  {
    title: "Senarai kementerian persekutuan",
    description:
      "Senarai kementerian dan jabatan persekutuan Malaysia beserta portfolio masing-masing. Gunakan untuk soalan tentang struktur kabinet, kementerian yang mengurus sesuatu perkara, atau sebagai titik mula carta organisasi kerajaan.",
    inputSchema: {
      carian: z
        .string()
        .optional()
        .describe("Penapis pilihan, cth. 'pendidikan', 'kewangan'. Kosong untuk semua."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ carian }: { carian?: string }) => {
    const q = (carian ?? "").toLowerCase().trim();
    const hasil = q
      ? KEMENTERIAN.filter((k) => `${k.singkatan} ${k.nama} ${k.portfolio}`.toLowerCase().includes(q))
      : KEMENTERIAN;
    const senarai = hasil
      .map((k) => `- ${k.singkatan} - ${k.nama}: ${k.portfolio}`)
      .join("\n");
    return {
      content: [
        {
          type: "text" as const,
          text: `${senarai || "Tiada kementerian sepadan dengan carian itu."}\n\n(${hasil.length} kementerian) ${CATATAN_DATA}`,
        },
      ],
    };
  },
);

// 2. carta_organisasi_persekutuan
  server.registerTool(
  "carta_organisasi_persekutuan",
  {
    title: "Carta organisasi kerajaan persekutuan",
    description:
      "Hierarki kerajaan persekutuan Malaysia lengkap: Yang di-Pertuan Agong, Perdana Menteri, Jemaah Menteri, KSU, kementerian dan agensi - dalam teks berstruktur DAN carta Mermaid sedia-lukis. Gunakan untuk mana-mana soalan struktur kerajaan.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const mermaid = [
      "flowchart TD",
      "  YDPA[Yang di-Pertuan Agong - Ketua Negara]",
      "  YDPA --> PM[Perdana Menteri]",
      "  PM --> TPM[Timbalan Perdana Menteri]",
      "  PM --> KAB[Jemaah Menteri - Kabinet]",
      "  KAB --> KM[Kementerian - diketuai Menteri]",
      "  KM --> KSU[Ketua Setiausaha - KSU]",
      "  KSU --> BHG[Bahagian / Jabatan]",
      "  KSU --> AG[Agensi di bawah kementerian]",
      "  KSN[Ketua Setiausaha Negara - KSN, ketua Perkhidmatan Awam] -.pengurusan.- KSU",
      "  PAR[Parlimen - Dewan Rakyat 222 + Dewan Negara 70] -.kawasan kuasa perundangan.- YDPA",
    ].join("\n");
    return {
      content: [
        {
          type: "text" as const,
          text: [
            STRUKTUR_PERSEKUTUAN.tajuk,
            "",
            ...STRUKTUR_PERSEKUTUAN.hierarki.map((h, i) => `${i + 1}. ${h}`),
            "",
            STRUKTUR_PERSEKUTUAN.parlimen,
            "",
            "Carta Mermaid:",
            "```mermaid",
            mermaid,
            "```",
            "",
            STRUKTUR_PERSEKUTUAN.catatan,
          ].join("\n"),
        },
      ],
    };
  },
);

// 3. senarai_negeri
  server.registerTool(
  "senarai_negeri",
  {
    title: "Senarai negeri dan Wilayah Persekutuan",
    description:
      "13 negeri dan 3 Wilayah Persekutuan Malaysia: ibu kota, ketua negeri (Sultan/Yang di-Pertua Negeri), dan gelaran ketua kerajaan negeri (Menteri Besar/Ketua Menteri/Premier).",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const negeriList = NEGERI.map(
      (n) => `- ${n.nama} (ibu kota: ${n.ibu_kota}) - ketua negeri: ${n.ketua_negeri}; ketua kerajaan: ${n.ketua_kerajaan}`,
    ).join("\n");
    const wpList = WILAYAH_PERSEKUTUAN.map((w) => `- ${w.nama} - ${w.pentadbiran}`).join("\n");
    return {
      content: [
        {
          type: "text" as const,
          text: `13 negeri:\n${negeriList}\n\n3 Wilayah Persekutuan:\n${wpList}\n\n${CATATAN_DATA}`,
        },
      ],
    };
  },
);

// 4. struktur_organisasi_templat
  server.registerTool(
  "struktur_organisasi_templat",
  {
    title: "Templat carta organisasi",
    description:
      "Templat struktur organisasi Malaysia sedia-lukis (Mermaid + penerangan peranan). Pilih jenis: kementerian, kerajaan-negeri, syarikat-sdn-bhd, syarikat-berhad, glc, sme, koperasi. Kosongkan id untuk senarai jenis yang ada.",
    inputSchema: {
      id: z
        .string()
        .optional()
        .describe("Jenis templat: kementerian | kerajaan-negeri | syarikat-sdn-bhd | syarikat-berhad | glc | sme | koperasi"),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ id }: { id?: string }) => {
    if (!id || !id.trim()) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Jenis templat yang ada:\n${TEMPLAT.map((t) => `- ${t.id}: ${t.nama}`).join("\n")}`,
          },
        ],
      };
    }
    const t = TEMPLAT.find((x) => x.id === id.trim().toLowerCase());
    if (!t) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Templat "${id}" tiada. Jenis yang ada: ${TEMPLAT.map((x) => x.id).join(", ")}.`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `# ${t.nama}`,
            "",
            t.perihal,
            "",
            "Carta Mermaid (templat umum - gantikan dengan nama/jawatan sebenar bila diketahui):",
            "```mermaid",
            t.mermaid,
            "```",
            "",
            "Peranan utama:",
            ...t.peranan.map((p) => `- ${p}`),
          ].join("\n"),
        },
      ],
    };
  },
);

// 5. gred_perkhidmatan
  server.registerTool(
  "gred_perkhidmatan",
  {
    title: "Gred perkhidmatan awam Malaysia",
    description:
      "Kumpulan dan gred perkhidmatan awam Malaysia: Kumpulan Pengurusan dan Profesyonal (Gred 41-54), JUSA, Gred Turus, Kumpulan Pelaksana. Berguna untuk carta organisasi sektor awam dan takrif peranan.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const bahagian = GRED.kumpulan
      .map((k) => `## ${k.nama}\n${k.gred.map((g) => `- ${g}`).join("\n")}`)
      .join("\n\n");
    return {
      content: [{ type: "text" as const, text: `# ${GRED.tajuk}\n\n${bahagian}\n\n${GRED.catatan}` }],
    };
  },
);

// 6. carian_dataset (katalog kurasi tempatan - sentiasa boleh diharap)
type SetData = { id: string; nama: string; perihal: string; lajur: string };

/**
 * Id-id yang TELAH DISAHKAN berfungsi pada api.data.gov.my/data-catalogue?id=<id>
 * pada masa kurasi (Nov 2025). Id baharu boleh ditemui di https://data.gov.my/data-catalogue.
 */
const KATALOG_SET_DATA: SetData[] = [
  { id: "births", nama: "Kelahiran harian Malaysia", perihal: "Bilangan kelahiran harian mengikut tarikh, sejak 1920.", lajur: "date, state, births" },
  { id: "deaths", nama: "Kematian Malaysia", perihal: "Angka kematian dan kadar kasar kematian, tahunan.", lajur: "date, abs, rate" },
  { id: "marriages", nama: "Perkahwinan Malaysia", perihal: "Angka perkahwinan dan kadar kasar, mengikut jantina.", lajur: "date, sex, abs, rate" },
  { id: "population_state", nama: "Populasi mengikut negeri", perihal: "Anggaran populasi mengikut negeri, umur, jantina dan etnik.", lajur: "date, state, age, sex, ethnicity, population" },
  { id: "life_expectancy", nama: "Harapan hayat", perihal: "Harapan hayat semasa lahir mengikut jantina dan etnik, sejak 1957.", lajur: "date, sex, ethnicity, life_expectancy" },
  { id: "electricity_consumption", nama: "Penggunaan elektrik", perihal: "Penggunaan elektrik mengikut sektor.", lajur: "date, sector, consumption" },
];

  server.registerTool(
  "carian_dataset",
  {
    title: "Katalog set data rasmi Malaysia",
    description:
      "Cari set data rasmi kerajaan Malaysia (DOSM / data.gov.my) yang tersedia melalui pelayan ini. Kembalikan id set data untuk digunakan dengan alat ambil_dataset. Katalog ini kurasi tempatan dan sentiasa boleh dijawab; untuk set data lain, layari https://data.gov.my/data-catalogue.",
    inputSchema: {
      carian: z.string().optional().describe("Perkataan kunci, cth. 'populasi', 'kelahiran', 'elektrik'. Kosong untuk senarai penuh."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ carian }: { carian?: string }) => {
    const q = (carian ?? "").toLowerCase().trim();
    const hasil = q
      ? KATALOG_SET_DATA.filter((s) => `${s.id} ${s.nama} ${s.perihal} ${s.lajur}`.toLowerCase().includes(q))
      : KATALOG_SET_DATA;
    if (hasil.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Tiada set data sepadan untuk "${carian}" dalam katalog pelayan ini. Set data yang tersedia: ${KATALOG_SET_DATA.map((s) => s.id).join(", ")}. Untuk set data lain, layari https://data.gov.my/data-catalogue - jangan meneka id atau angka.`,
          },
        ],
      };
    }
    const lines = hasil
      .map((s) => `- id: ${s.id} | ${s.nama} - ${s.perihal} Lajur: [${s.lajur}]`)
      .join("\n");
    return {
      content: [
        {
          type: "text" as const,
          text: `Katalog set data tersedia (guna id dengan alat ambil_dataset):\n${lines}\n\nSumber data sebenar: api.data.gov.my (DOSM). Katalog penuh kerajaan: https://data.gov.my/data-catalogue.`,
        },
      ],
    };
  },
);

// 7. ambil_dataset (proksi data.gov.my, degradasi jujur)
  server.registerTool(
  "ambil_dataset",
  {
    title: "Ambil baris set data data.gov.my",
    description:
      "Ambil beberapa baris data sebenar dari set data rasmi data.gov.my (DOSM) melalui API rasminya. Gunakan id dari alat carian_dataset. Id yang disahkan berfungsi: births, deaths, marriages, population_state, life_expectancy, electricity_consumption.",
    inputSchema: {
      id_set_data: z.string().describe("Id set data, cth. 'births', 'population_state' - lihat alat carian_dataset"),
      had: z.number().optional().describe("Bilangan baris terkini maksimum (1-20). Asal 10."),
      negeri: z.string().optional().describe("Penapis negeri bila set data ada lajur state, cth. 'Johor', 'Selangor'."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ id_set_data, had, negeri }: { id_set_data: string; had?: number; negeri?: string }) => {
    const limit = Math.min(Math.max(had ?? 10, 1), 20);
    try {
      // API memulangkan baris mengikut tarikh menaik; ambil sekali besar, urut turun,
      // dan beri baris TERKINI sahaja supaya model tidak dibebani sejarah penuh.
      const url = `https://api.data.gov.my/data-catalogue?id=${encodeURIComponent(id_set_data.trim())}&limit=100000`;
      const res = await fetchWithTimeout(url, 15000);
      if (!res.ok) {
        return {
          content: [
            {
              type: "text" as const,
              text: `data.gov.my memulangkan status ${res.status} untuk id "${id_set_data}". Saya tidak akan meneka data - semak id dengan alat carian_dataset.`,
            },
          ],
        };
      }
      const raw = (await res.json()) as unknown;
      let rows: unknown[] = Array.isArray(raw) ? raw : ((raw as { data?: unknown })?.data ?? []);
      if (!Array.isArray(rows) || rows.length === 0) {
        return {
          content: [{ type: "text" as const, text: `Set data "${id_set_data}" tiada atau kosong di data.gov.my. Semak id dengan alat carian_dataset.` }],
        };
      }
      const n = negeri?.trim().toLowerCase();
      if (n) {
        rows = rows.filter((r: any) => String(r?.state ?? "").toLowerCase().includes(n));
        if (rows.length === 0) {
          return {
            content: [{ type: "text" as const, text: `Tiada baris dengan negeri "${negeri}" dalam set data "${id_set_data}". Negeri mungkin bukan dimensi set data ini - semak lajur dengan alat carian_dataset.` }],
          };
        }
      }
      const berurut = [...(rows as Record<string, unknown>[])].sort((a, b) =>
        String(b?.date ?? "").localeCompare(String(a?.date ?? "")),
      );
      const terkini = berurut.slice(0, limit);
      return {
        content: [
          {
            type: "text" as const,
            text: `Baris terkini set data "${id_set_data}"${negeri ? ` (negeri: ${negeri})` : ""}:\n${JSON.stringify(terkini, null, 2).slice(0, 6000)}\n\nSumber: api.data.gov.my (DOSM) - ambil masa ${new Date().toISOString().slice(0, 10)}.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Gagal menghubungi data.gov.my (${err instanceof Error ? err.message : "ralat tidak diketahui"}). Saya tidak akan meneka data.`,
          },
        ],
      };
    }
  },
);

// ---------------------------------------------------------------- Kit Perang Alatan (6 alat baru)
// Ditambah oleh pakej upgrade "Bilik Perang" (examples/malaysia/war-pack). Semuanya baca
// sahaja, tanpa kunci API, dan beroperasi sepenuhnya tempatan.

const WP_STOPWORDS_BM = new Set([
  "dan","yang","di","ke","dari","pada","dengan","untuk","adalah","itu","ini","tidak","juga",
  "akan","ada","oleh","atau","bagi","dalam","sebagai","kerana","jika","bila","sudah","telah",
  "boleh","mana","apa","siapa","satu","kami","kita","saya","anda","dia","mereka","para","agar",
  "hingga","serta","antara","suatu","ia","ketika","semasa","lebih","paling","sangat","masih",
  "hanya","setiap","semua","beberapa","the","of","to","and","in","for","is","on","as",
]);

function wpSanitasiMermaid(label: string): string {
  return label.replace(/["`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function wpFormatRM(nilai: number): string {
  const fmt = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(nilai);
  const abs = Math.abs(nilai);
  let skala = "";
  if (abs >= 1e9) skala = ` (≈ RM${(nilai / 1e9).toFixed(2)} bilion)`;
  else if (abs >= 1e6) skala = ` (≈ RM${(nilai / 1e6).toFixed(2)} juta)`;
  else if (abs >= 1e3) skala = ` (≈ RM${(nilai / 1e3).toFixed(2)} ribu)`;
  return `${fmt}${skala}`;
}

const WP_GLOSARI = [
  { istilah: "Yang di-Pertuan Agong", english: "The King / Supreme Head of State", maksud: "Ketua negara Malaysia, dipilih bergilir bagi tempoh 5 tahun oleh Majlis Raja-Raja" },
  { istilah: "Perdana Menteri", english: "Prime Minister", maksud: "Ketua eksekutif kerajaan persekutuan, dilantik daripada Ahli Parlimen yang menyokongnya" },
  { istilah: "Jemaah Menteri", english: "Cabinet", maksud: "Majlis menteri yang mengetuai kementerian, bertanggungjawab kepada Parlimen" },
  { istilah: "Dewan Rakyat", english: "House of Representatives", maksud: "Ruang parlimen dipilih; 222 kerusi, anggota bergelar Ahli Parlimen (AP)" },
  { istilah: "Dewan Negara", english: "Senate", maksud: "Dewan parlimen dilantik/dipilih negeri; maksimum 70 anggota, bergelar Senator" },
  { istilah: "Menteri Besar / Ketua Menteri", english: "Menteri Besar / Chief Minister", maksud: "Ketua eksekutif kerajaan negeri; gelaran mengikut adat negeri" },
  { istilah: "EXCO Negeri", english: "State Executive Council", maksud: "Jemaah menteri peringkat negeri" },
  { istilah: "GLC", english: "Government-Linked Company", maksud: "Syarikat dengan kepentingan pemilikan kerajaan yang ketara" },
  { istilah: "GLIC", english: "Government-Linked Investment Company", maksud: "Institut pelaburan milik kerajaan (contoh: Khazanah, EPF, KWAP, LTAT)" },
  { istilah: "Sdn Bhd", english: "Private Limited Company (Sendirian Berhad)", maksud: "Syarikat swasta berhad terhad; tidak boleh menawarkan saham kepada umum" },
  { istilah: "Berhad", english: "Public Limited Company", maksud: "Syarikat awam; boleh disenaraikan di Bursa Malaysia" },
  { istilah: "Bursa Malaysia", english: "Bursa Malaysia (stock exchange)", maksud: "Bursa sekuriti negara" },
  { istilah: "SSM", english: "Companies Commission of Malaysia", maksud: "Suruhanjaya Syarikat Malaysia; pendaftaran syarikat per Akta Syarikat 2016" },
  { istilah: "Akta Syarikat 2016", english: "Companies Act 2016", maksud: "Perundangan utama pengurusan syarikat di Malaysia" },
  { istilah: "PDPA 2010", english: "Personal Data Protection Act 2010", maksud: "Akta perlindungan data peribadi bagi transaksi komersial" },
  { istilah: "BNM", english: "Bank Negara Malaysia", maksud: "Bank pusat negara" },
  { istilah: "OSA 1972", english: "Official Secrets Act 1972", maksud: "Akta rahsia rasmi; klasifikasi dokumen kerajaan" },
  { istilah: "JPA", english: "Public Service Department (Jabatan Perkhidmatan Awam)", maksud: "Pengurusan perkhidmatan awam, gred, lantikan" },
  { istilah: "SPA", english: "Public Service Commission (Suruhanjaya Perkhidmatan Awam)", maksud: "Lantikan pegawai perkhidmatan awam persekutuan" },
  { istilah: "JUSA", english: "Top Management Group", maksud: "Gred pengurusan tertinggi perkhidmatan awam (C, B, A, Tinggi)" },
  { istilah: "MA63", english: "Malaysia Agreement 1963", maksud: "Perjanjian penubuhan Malaysia; hak istimewa Sabah dan Sarawak" },
  { istilah: "SOP", english: "Standard Operating Procedure", maksud: "Prosedur operasi standard organisasi" },
  { istilah: "KPI", english: "Key Performance Indicator", maksud: "Petunjuk prestasi utama" },
  { istilah: "PBT", english: "Local Authority (Pihak Berkuasa Tempatan)", maksud: "Majlis bandaraya/majlis daerah" },
  { istilah: "YB", english: "Yang Berhormat", maksud: "Gelaran Ahli Parlimen dan EXCO negeri" },
  { istilah: "YBhg / YBrs", english: "Yang Berbahagia / Yang Berusaha", maksud: "Gelaran hormat bagi pegawai tinggi / pegawai" },
  { istilah: "Majlis Raja-Raja", english: "Conference of Rulers", maksud: "Majlis 9 Raja Melayu dan 4 Yang di-Pertua Negeri; memilih YDP Agong" },
  { istilah: "Badan berkanun", english: "Statutory body", maksud: "Badan ditubuhkan undang-undang (contoh: MCMC, SSM, LHDN)" },
  { istilah: "LHDN", english: "Inland Revenue Board (Lembaga Hasil Dalam Negeri)", maksud: "Pungutan cukai pendapatan" },
  { istilah: "EPF / KWSP", english: "Employees Provident Fund", maksud: "Kumpulan wang pencen pekerja swasta" },
  { istilah: "PERKESO / SOCSO", english: "Social Security Organisation", maksud: "Perlindungan sosial pekerja" },
  { istilah: "MCMC", english: "Malaysian Communications and Multimedia Commission", maksud: "Pengawal selia komunikasi dan multimedia" },
  { istilah: "Rancangan Malaysia", english: "Malaysia Plan (RMK)", maksud: "Rancangan pembangunan lima tahun (contoh: RMK-12)" },
  { istilah: "Belanjawan", english: "National Budget", maksud: "Belanjawan tahunan, dibentangkan MOF di Dewan Rakyat" },
  { istilah: "Data terbuka", english: "Open data", maksud: "Set data kerajaan terbuka di data.gov.my" },
  { istilah: "Ekonomi MADANI", english: "MADANI Economy", maksud: "Kerangka ekonomi kerajaan sejak 2023" },
  { istilah: "Span of control", english: "Span of control", maksud: "Bilangan bawahan langsung seorang pengurus; amalan terbaik 5-9" },
  { istilah: "Ahli Lembaga Bebas", english: "Independent Director", maksud: "Pengarah tiada kepentingan perniagaan yang menjejaskan kebebasannya" },
  { istilah: "Sekretari Syarikat", english: "Company Secretary", maksud: "Pegawai wajib per s.235 Akta Syarikat 2016" },
  { istilah: "Jawatankuasa Audit", english: "Audit Committee", maksud: "Jawatankuasa lembaga bagi pengawasan kewangan dan audit" },
];

const WP_CUTI_TETAP = [
  { nama: "Tahun Baru", tarikh: "1 Januari", sah: true, skop: "Persekutuan dan kebanyakan negeri" },
  { nama: "Hari Pekerja", tarikh: "1 Mei", sah: true, skop: "Persekutuan" },
  { nama: "Hari Malaysia", tarikh: "16 September", sah: true, skop: "Persekutuan" },
  { nama: "Hari Krismas", tarikh: "25 Disember", sah: true, skop: "Persekutuan" },
  { nama: "Hari Keputeraan Yang di-Pertuan Agong", tarikh: "Jun (sabtu pertama, kecuali diumumkan lain)", sah: false, skop: "Persekutuan" },
  { nama: "Hari Thaipusam", tarikh: "Januari/Februari (takwim lunar Tamil)", sah: false, skop: "Selangor, P.Pinang, Perak, N.Sembilan, Johor, KL, Putrajaya" },
  { nama: "Tahun Baru Cina", tarikh: "Januari/Februari (takwim lunar)", sah: false, skop: "Persekutuan" },
  { nama: "Hari Wesak", tarikh: "Mei (purnama bulan Vaisakha)", sah: false, skop: "Persekutuan" },
  { nama: "Hari Raya Aidilfitri", tarikh: "1-2 Syawal (takwim Hijrah)", sah: false, skop: "Persekutuan; tarikh ikut pengumuman rasmi" },
  { nama: "Hari Raya Aidiladha", tarikh: "10 Zulhijjah (takwim Hijrah)", sah: false, skop: "Persekutuan" },
  { nama: "Awal Muharram", tarikh: "1 Muharram (takwim Hijrah)", sah: false, skop: "Persekutuan" },
  { nama: "Maulidur Rasul", tarikh: "12 Rabiulawal (takwim Hijrah)", sah: false, skop: "Persekutuan" },
  { nama: "Hari Deepavali", tarikh: "Oktober/November (takwim lunar Tamil)", sah: false, skop: "Kebanyakan negeri kecuali Sarawak dan Labuan" },
];

// 8. analisis_teks_bm
  server.registerTool(
  "analisis_teks_bm",
  {
    title: "Analisis teks Bahasa Melayu",
    description:
      "Analisis statistik teks BM: aksara, patah perkataan, ayat, perenggan, anggaran masa bacaan, dan kata kunci paling kerap (kata henti ditapis). Berguna sebelum menyiapkan laporan, minit mesyuarat atau kandungan.",
    inputSchema: {
      teks: z.string().describe("Teks yang dianalisis."),
      kata_kunci_top: z.number().optional().describe("Bilangan kata kunci teratas (default 10, maksimum 20)."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ teks, kata_kunci_top }: { teks: string; kata_kunci_top?: number }) => {
    const bersih = (teks ?? "").trim();
    if (!bersih) {
      return { content: [{ type: "text" as const, text: "Berikan teks untuk dianalisis." }] };
    }
    const perkataan = bersih.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0);
    const ayat = bersih.split(/[.!?]+(?:\s|$)/).map((a) => a.trim()).filter((a) => a.length > 0);
    const perenggan = bersih.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
    const kekerapan = new Map<string, number>();
    for (const kata of perkataan) {
      const k = kata.toLowerCase();
      if (k.length < 3 || WP_STOPWORDS_BM.has(k)) continue;
      kekerapan.set(k, (kekerapan.get(k) ?? 0) + 1);
    }
    const topN = Math.max(1, Math.min(20, kata_kunci_top ?? 10));
    const atas = [...kekerapan.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([kata, bil], i) => `${i + 1}. ${kata} (${bil}x)`)
      .join("\n");
    const masaBaca = Math.max(1, Math.round(perkataan.length / 200));
    const teksHasil = [
      "## Analisis teks (Bahasa Melayu)",
      "",
      `- Aksara: ${bersih.length}`,
      `- Patah perkataan: ${perkataan.length}`,
      `- Ayat: ${ayat.length}`,
      `- Perenggan: ${perenggan.length}`,
      `- Anggaran masa bacaan: ~${masaBaca} minit (200 perkataan/minit)`,
      atas ? `\n### Kata kunci paling kerap\n${atas}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { content: [{ type: "text" as const, text: teksHasil }] };
  },
);

// 9. penukar_unit
  server.registerTool(
  "penukar_unit",
  {
    title: "Penukar unit dan format RM",
    description:
      "Penukar unit Malaysia: km/batu, m/kaki, kg/paun, Celsius/Fahrenheit, liter/gelen, hektar/ekar, dan pemformatan Ringgit Malaysia (RM dengan skala ribu/juta/bilion).",
    inputSchema: {
      nilai: z.number().describe("Nilai yang ditukar."),
      dari: z
        .enum(["km", "batu", "m", "kaki", "kg", "paun", "c", "f", "liter", "gelen", "hektar", "ekar", "rm"])
        .describe("Unit asal; guna 'rm' untuk format Ringgit Malaysia."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ nilai, dari }: { nilai: number; dari: string }) => {
    if (!Number.isFinite(nilai)) {
      return { content: [{ type: "text" as const, text: "Nilai mesti nombor." }] };
    }
    let hasil: string;
    if (dari === "rm") {
      hasil = wpFormatRM(nilai);
    } else {
      const konv: Record<string, { ke: string; faktor: (v: number) => number }> = {
        km: { ke: "batu", faktor: (v) => v / 1.609344 },
        batu: { ke: "km", faktor: (v) => v * 1.609344 },
        m: { ke: "kaki", faktor: (v) => v / 0.3048 },
        kaki: { ke: "m", faktor: (v) => v * 0.3048 },
        kg: { ke: "paun", faktor: (v) => v / 0.45359237 },
        paun: { ke: "kg", faktor: (v) => v * 0.45359237 },
        c: { ke: "f", faktor: (v) => (v * 9) / 5 + 32 },
        f: { ke: "c", faktor: (v) => ((v - 32) * 5) / 9 },
        liter: { ke: "gelen", faktor: (v) => v / 3.785411784 },
        gelen: { ke: "liter", faktor: (v) => v * 3.785411784 },
        hektar: { ke: "ekar", faktor: (v) => v * 2.47105381 },
        ekar: { ke: "hektar", faktor: (v) => v / 2.47105381 },
      };
      const pilihan = konv[dari];
      if (!pilihan) {
        hasil = `Unit "${dari}" tidak dikenali. Pilihan: ${Object.keys(konv).join(", ")}, rm.`;
      } else {
        const tukar = pilihan.faktor(nilai);
        hasil = `${nilai} ${dari} = ${tukar.toLocaleString("en-MY", { maximumFractionDigits: 4 })} ${pilihan.ke}`;
      }
    }
    return { content: [{ type: "text" as const, text: hasil }] };
  },
);

// 10. mermaid_carta
  server.registerTool(
  "mermaid_carta",
  {
    title: "Jana carta organisasi Mermaid",
    description:
      "Jana carta organisasi Mermaid yang sah daripada JSON hierarki (senarai nod dengan induk). Mengesahkan id unik, induk wujud dan had 40 nod. Guna untuk melukis carta organisasi yang kemas dan konsisten.",
    inputSchema: {
      tajuk: z.string().describe("Tajuk carta."),
      arah: z.enum(["TD", "LR"]).optional().describe("Arah carta (default TD)."),
      nod: z
        .array(
          z.object({
            id: z.string().describe("Id unik nod (huruf/nombor/sempang)."),
            label: z.string().describe("Label yang dipaparkan."),
            induk: z.string().optional().describe("Id nod induk (untuk nod bukan akar)."),
          }),
        )
        .describe("Senarai nod; nod pertama ialah akar (tanpa 'induk')."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ tajuk, arah, nod }: { tajuk: string; arah?: "TD" | "LR"; nod: Array<{ id: string; label: string; induk?: string }> }) => {
    const senarai = nod ?? [];
    if (!Array.isArray(senarai) || senarai.length === 0) {
      return { content: [{ type: "text" as const, text: "Senarai 'nod' diperlukan (sekurang-kurangnya satu nod akar)." }] };
    }
    if (senarai.length > 40) {
      return { content: [{ type: "text" as const, text: `Terlalu banyak nod (${senarai.length}). Had 40 nod supaya carta kekal mudah dibaca.` }] };
    }
    const ralat: string[] = [];
    const idSet = new Set<string>();
    const idsValid = /^[A-Za-z0-9_-]+$/;
    for (const nd of senarai) {
      const id = (nd?.id ?? "").trim();
      const label = (nd?.label ?? "").trim();
      if (!id || !idsValid.test(id)) ralat.push(`Id tidak sah: "${id}" (guna huruf, nombor, sempang).`);
      if (!label) ralat.push(`Nod "${id}" tiada label.`);
      if (idSet.has(id)) ralat.push(`Id "${id}" berulang.`);
      idSet.add(id);
    }
    for (const nd of senarai) {
      const induk = (nd?.induk ?? "").trim();
      if (induk && !idSet.has(induk)) {
        ralat.push(`Nod "${(nd?.id ?? "").trim()}" merujuk induk "${induk}" yang tidak wujud.`);
      }
    }
    const berinduk = senarai.filter((nd) => (nd?.induk ?? "").trim());
    const akar = senarai.filter((nd) => !(nd?.induk ?? "").trim());
    if (akar.length === 0) ralat.push("Tiada nod akar (nod tanpa 'induk').");
    if (ralat.length > 0) {
      return { content: [{ type: "text" as const, text: `**Carta tidak boleh dijana — ralat pengesahan:**\n${ralat.map((e) => `- ${e}`).join("\n")}` }] };
    }
    const mermaid = [
      "```mermaid",
      `flowchart ${arah === "LR" ? "LR" : "TD"}`,
      `  TITLE["${wpSanitasiMermaid(tajuk) || "Carta Organisasi"}"]`,
      ...senarai.map((nd) => `  ${(nd.id ?? "").trim()}["${wpSanitasiMermaid(nd.label)}"]`),
      ...akar.map((nd) => `  TITLE --- ${(nd.id ?? "").trim()}`),
      ...berinduk.map((nd) => `  ${(nd.induk ?? "").trim()} --> ${(nd.id ?? "").trim()}`),
      "```",
    ].join("\n");
    return { content: [{ type: "text" as const, text: `Carta sah: ${senarai.length} nod, ${akar.length} akar.\n\n${mermaid}` }] };
  },
);

// 11. templat_minit_mesyuarat
  server.registerTool(
  "templat_minit_mesyuarat",
  {
    title: "Templat minit mesyuarat Malaysia",
    description:
      "Templat minit mesyuarat gaya rasmi Malaysia: maklumat mesyuarat, kehadiran, perkara dibangkitkan, jadual tindakan (tindakan/pegawai/tarikh akhir/status). Sediakan butiran yang ada; yang tiada dibiarkan sebagai pemegang tempat.",
    inputSchema: {
      tajuk: z.string().optional().describe("Tajuk/nama mesyuarat."),
      tarikh: z.string().optional().describe("Tarikh mesyuarat."),
      masa: z.string().optional().describe("Masa mesyuarat."),
      tempat: z.string().optional().describe("Tempat/platform mesyuarat."),
      pengerusi: z.string().optional().describe("Nama/gelaran pengerusi."),
      nombor: z.string().optional().describe("Nombor mesyuarat (contoh: 'Bil. 3/2026')."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ tajuk, tarikh, masa, tempat, pengerusi, nombor }: Record<string, string | undefined>) => {
    const g = (v: string | undefined, def: string) => wpSanitasiMermaid((v ?? "").trim()) || def;
    const teks = [
      `# MINIT MESYUARAT ${g(tajuk, "(TAJUK MESYUARAT)").toUpperCase()}`,
      "",
      `**Mesyuarat:** ${g(nombor, "Bil. __/20__")}  `,
      `**Tarikh:** ${g(tarikh, "(TARIKH)")}  `,
      `**Masa:** ${g(masa, "(MASA)")}  `,
      `**Tempat:** ${g(tempat, "(TEMPAT)")}`,
      "",
      "## 1. Kehadiran",
      `- **Pengerusi:** ${g(pengerusi, "(PENGERUSI)")}`,
      "- **Ahli hadir:** (SENARAI NAMA / JAWATAN)",
      "- **Tidak hadir (dengan alasan / tanpa alasan):**",
      "- **Sekretariat:**",
      "",
      "## 2. Perkara Dibangkitkan",
      "### 2.1 (PERKARA 1)",
      "- **Isu:** ...",
      "- **Perbincangan:** ...",
      "- **Keputusan:** ...",
      "",
      "### 2.2 (PERKARA 2)",
      "- ...",
      "",
      "## 3. Jadual Tindakan",
      "",
      "| Bil | Tindakan | Pegawai Bertanggungjawab | Tarikh Akhir | Status |",
      "|---|---|---|---|---|",
      "| 1 | (TINDAKAN) | (NAMA/JABATAN) | (TARIKH) | Belum mula |",
      "",
      "## 4. Perkara Lain-Lain",
      "- ...",
      "",
      "## 5. Tarikh Mesyuarat Akan Datang",
      "- (TARIKH)",
      "",
      "---",
      "*Direkodkan oleh: __________  Disemak oleh Pengerusi: __________  Tarikh semakan: __________*",
      "",
      "> Minit mesyuarat rasmi kerajaan patut mengikut panduan urus setia jabatan masing-masing dan arahan pentadbiran yang berkuat kuasa.",
    ].join("\n");
    return { content: [{ type: "text" as const, text: teks }] };
  },
);

// 12. kalendar_cuti
  server.registerTool(
  "kalendar_cuti",
  {
    title: "Kalendar hari kelepasan am Malaysia",
    description:
      "Hari kelepasan am nasional Malaysia: cuti tetap kalendar Gregorian (DISAHKAN) dan cuti takwim (Islam/Cina/Tamil) bertanda PERLU DISAHKAN dengan anggaran. Sentiasa semak kalendar rasmi sebelum perancangan rasmi. Cuti khusus negeri tidak disertakan.",
    inputSchema: {
      tahun: z.number().optional().describe("Tahun (default: 2026)."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ tahun }: { tahun?: number }) => {
    const t = Math.max(2000, Math.min(2100, Math.trunc(tahun ?? 2026)));
    const anggaran2026: Record<string, string> = {
      "Hari Thaipusam": "~1 Februari 2026 (anggaran)",
      "Tahun Baru Cina": "~17-18 Februari 2026 (anggaran)",
      "Hari Wesak": "~1 Mei 2026 (anggaran)",
      "Hari Raya Aidilfitri": "~20-21 Mac 2026 (anggaran, ikut pengumuman rasmi)",
      "Hari Raya Aidiladha": "~27 Mei 2026 (anggaran)",
      "Awal Muharram": "~16 Jun 2026 (anggaran)",
      "Maulidur Rasul": "~26 Ogos 2026 (anggaran)",
      "Hari Deepavali": "~8 November 2026 (anggaran)",
      "Hari Keputeraan Yang di-Pertuan Agong": "Jun 2026 (sabtu pertama, kecuali diumumkan lain)",
    };
    const tetap = WP_CUTI_TETAP.map((c) => {
      const anggaran = anggaran2026[c.nama];
      const tarikh = t === 2026 && anggaran ? anggaran : `${c.tarikh} ${t}`;
      const tanda = c.sah ? "[DISAHKAN - tetap]" : "[PERLU DISAHKAN - takwim/umuman]";
      return `- **${c.nama}** — ${tarikh} ${tanda} (${c.skop})`;
    }).join("\n");
    const teks = [
      `# Hari Kelepasan Am Nasional Malaysia — ${t}`,
      "",
      tetap,
      "",
      "> **Peraturan penggunaan:** hanya cuti tetap bertanda DISAHKAN boleh dirancang terus. Cuti " +
        "takwim berubah setiap tahun dan tarikh rasmi diumumkan kerajaan. Cuti khusus negeri TIDAK disertakan.",
    ].join("\n");
    return { content: [{ type: "text" as const, text: teks }] };
  },
);

// 13. glosari_kerajaan
  server.registerTool(
  "glosari_kerajaan",
  {
    title: "Glosari kerajaan/korporat Malaysia (BM <-> EN)",
    description:
      "Glosari dwibahasa istilah kerajaan, pentadbiran dan korporat Malaysia: gelaran rasmi, akta utama, entiti GLC/GLIC, gred dan jargon organisasi. Guna untuk terjemahan rasmi dan penulisan dokumen yang konsisten.",
    inputSchema: {
      carian: z.string().optional().describe("Penapis kata kunci pilihan (istilah/Inggeris/maksud)."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ carian }: { carian?: string }) => {
    const q = (carian ?? "").toLowerCase().trim();
    const hasil = q
      ? WP_GLOSARI.filter((g) => `${g.istilah} ${g.english} ${g.maksud}`.toLowerCase().includes(q))
      : WP_GLOSARI;
    if (hasil.length === 0) {
      return { content: [{ type: "text" as const, text: `Tiada istilah sepadan dengan "${carian}". Cuba istilah lain (contoh: "GLC", "Agong", "EXCO").` }] };
    }
    const badan = hasil.map((g) => `- **${g.istilah}** (${g.english}) — ${g.maksud}`).join("\n");
    return { content: [{ type: "text" as const, text: `# Glosari Malaysia (${hasil.length}/${WP_GLOSARI.length} dipaparkan)\n\n${badan}` }] };
  },
);

// ---------------------------------------------------------------- Kit F&B (5 alat baru)
// Ditanam dengan data DISAHKAN daripada DOSM (storage.dosm.gov.my) & MySST (RMCD),
// November 2025. Semua angka julat modal/margin ditanda ANGGARAN di dalam teks alat.

const FNB_PASARAN = {
  hasil_2024: "RM75.2 bilion",
  hasil_2025: "RM83.0 bilion (+10.4% YoY)",
  suku_2026: "Q1 RM22.1B (+10.9%), Q2 RM22.4B (+9.8%)",
  pertubuhan: "136,453 pertubuhan (Banci Ekonomi 2022)",
  struktur:
    "88.3% milikan perseorangan (purata output RM420k); Sdn Bhd 8% tetapi 44% output (purata RM4.0M)",
  selangor: "Selangor 40% output negara (RM39.9B)",
  pekerja: "858,131 pekerja (2025); median gaji sektor RM2,013/bln",
  sst_fnb:
    "SST perkhidmatan F&B = 6% (BUKAN 8%), ambang RM1,500,000/12 bln, efektif 1 Mac 2024 (kod 9902.01.2651). Sewa/leasing = 8% ambang RM500k dari 1 Jul 2025.",
  inflasi:
    "CPI makanan di luar rumah: +6.7% (2023), +3.6% (2024), +4.0% (2025), +2.6% Sep 2026",
  sumber:
    "storage.dosm.gov.my (ST2 2026, Banci Ekonomi 2022, CPI); mysst.customs.gov.my; halal.gov.my",
};

const FNB_SENARIO = [
  {
    id: "kopitiam-24-jam",
    nama: "Kopitiam / Mamak 24 Jam",
    modal: "RM150k - RM400k",
    kakitangan: "8-15 orang (2-3 syif)",
    margin: "35-45% kasar",
    saluran: "Walk-in + pre-order WhatsApp + delivery (Grab/Foodpanda)",
    risiko: "Kos tenaga 24 jam, keletihan kakitangan, kebersihan, SST bila jualan > RM1.5M",
    kpi: "Jualan/jam, food-cost %, kadar pusingan meja (turn meja)",
    kesesuaian_bot:
      "TINGGI: roster syif, inventori, amaran stok, urusan pesanan WhatsApp, kalendar pematuhan",
    nota: "Modal ANGGARAN - semak dengan operator sebelum mengaku; pasaran mamak bukan ceruk kecil (Perkhidmatan makanan = 107,129 pertubuhan, DISAHKAN banci)",
  },
  {
    id: "kafe-khas",
    nama: "Kafe Khas / Kopi Rantai",
    modal: "RM300k - RM800k (francais + fit-out)",
    kakitangan: "5-10 orang",
    margin: "55-70% kasar (minuman kopi)",
    saluran: "Dine-in + delivery + loyalty QR",
    risiko: "Tepu pasaran bandar, sewa (SST 8% sewa dari 1 Jul 2025 bila tuan premis berdaftar), kos promo (CAC)",
    kpi: "Cawan/hari, % pelanggan berulang, rating Google Maps",
    kesesuaian_bot:
      "TINGGI: loyalty QR, balasan ulasan, ujian menu baharu, P&L mingguan",
    nota: "Rantai besar dilaporkan media: Tealive >800, ZUS >600, Mixue >1,500 cawangan [ANGGARAN - semak laporan tahunan syarikat]",
  },
  {
    id: "dapur-awan",
    nama: "Dapur Awan / Jenama Maya (Delivery-only)",
    modal: "RM50k - RM150k",
    kakitangan: "3-6 orang",
    margin: "50-60% kasar SEBELUM komisen",
    saluran: "100% platform: Grab/Foodpanda/ShopeeFood",
    risiko:
      "Komisen dilaporkan 25-35%/pesanan [ANGGARAN - tiada angka rasmi di muka merchant]; ranking algoritma; ingatan jenama rendah",
    kpi: "Margin sumbangan/pesanan SELEPAS komisen, kadar batal, masa penyediaan",
    kesesuaian_bot:
      "SANGAT TINGGI: segerak menu pelplatform, pengoptimum promo, ramalan permintaan; SDK rasmi Grab Food (Python/Go) wujud [DISAHKAN]",
    nota: "CAPEX lebih rendah ~40-60% vs kedai fizikal [ANGGARAN]",
  },
  {
    id: "restoran-keluarga",
    nama: "Restoran Keluarga / Steamboat / BBQ",
    modal: "RM200k - RM500k",
    kakitangan: "8-12 orang",
    margin: "45-55% kasar",
    saluran: "Dine-in + tempahan WhatsApp + korporat",
    risiko: "Bahan basah terbuang, musiman (CNY/Ramadhan), gas, deposit tempahan",
    kpi: "Turn meja, % sisa, tempahan awal mingguan",
    kesesuaian_bot:
      "TINGGI: tempahan+deposit, senarai beli automatik daripada ramalan, perancangan pre-cut dapur",
    nota: "SST 6% terpakai bila jualan tahunan melebihi RM1.5M [DISAHKAN MySST]",
  },
  {
    id: "katering-acara",
    nama: "Katering & Acara (B2B / Kahwin / Korporat)",
    modal: "RM30k - RM100k (aset-ringan)",
    kakitangan: "5-10 + krew acara sambilan",
    margin: "35-50% kasar",
    saluran: "Tender korporat, grup Facebook/WhatsApp, penganjur acara",
    risiko:
      "Aliran tunai deposit, kejar harga pesaing, deposit akhir gagal, pembatalan sementara",
    kpi: "Margin per pax, nilai pipeline prospek, kadar tutup (close rate)",
    kesesuaian_bot:
      "SANGAT TINGGI: jana sebut harga, siri susulan prospek, jadual acara, inventori per acara",
    nota: "Katering acara = RM6.7B output, 16,208 pertubuhan [DISAHKAN banci] - segmen besar bukan ceruk",
  },
  {
    id: "food-truck-bazar",
    nama: "Food Truck / Bazar Ramadhan / Pop-up",
    modal: "RM5k-20k (gerai); RM40k-80k (truck)",
    kakitangan: "2-5 orang",
    margin: "55-65% kasar",
    saluran: "Lokasi bazar/lot PBT, TikTok/IG lokasi harian, walk-in",
    risiko: "Permit & lot bazar, cuaca, halal bahan, stok terbuang harian",
    kpi: "Jualan/jam per lokasi, kos bahan/unit, untung bersih harian",
    kesesuaian_bot:
      "TINGGI: pengurusan lokasi & permit kalendar, senarai prep harian, kandungan TikTok automatik",
    nota: "Jualan bazar boleh capai 30-50% jualan bulan Ramadhan bagi sesetengah outlet [ANGGARAN]",
  },
];

// 14. scenari_fnb
  server.registerTool(
  "scenari_fnb",
  {
    title: "Senario perniagaan F&B Malaysia",
    description:
      "Enam senario perniagaan F&B Malaysia dengan data: kopitiam 24 jam, kafe khas, dapur awan, restoran keluarga, katering acara, food truck/bazar. Setiap senario: modal permulaan (anggaran), kakitangan, margin, saluran jualan, risiko, KPI dan kesesuaian bot. Serta data pasaran disahkan DOSM (RM83.0B 2025) dan peraturan SST/halal. Guna bila pelan kon perniagaan F&B, perbandingan senario atau rancangan kewangan.",
    inputSchema: {
      senario: z
        .enum(["kopitiam-24-jam", "kafe-khas", "dapur-awan", "restoran-keluarga", "katering-acara", "food-truck-bazar"])
        .optional()
        .describe("Tapis satu senario sahaja; kosong untuk semua 6."),
      aspek: z
        .enum(["semua", "pasaran", "kewangan", "pematuhan"])
        .optional()
        .describe("'pasaran' = data DOSM disahkan; 'kewangan' = SST/komisen/gaji; 'pematuhan' = SST/halal/lesen; default semua."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ senario, aspek }: { senario?: string; aspek?: string }) => {
    const pilih = senario ? FNB_SENARIO.filter((s) => s.id === senario) : FNB_SENARIO;
    if (pilih.length === 0) {
      return { content: [{ type: "text" as const, text: `Senario "${senario}" tidak wujud. Pilihan: ${FNB_SENARIO.map((s) => s.id).join(", ")}.` }] };
    }
    const jadualSenario = pilih
      .map(
        (s) =>
          `### ${s.nama}\n- Modal permulaan: ${s.modal} [ANGGARAN]\n- Kakitangan: ${s.kakitangan}\n- Margin kasar tipikal: ${s.margin} [ANGGARAN]\n- Saluran jualan: ${s.saluran}\n- Risiko utama: ${s.risiko}\n- KPI utama: ${s.kpi}\n- Kesesuaian bot AI: ${s.kesesuaian_bot}\n- Nota: ${s.nota}`,
      )
      .join("\n\n");
    const bahagian: string[] = [`# Senario Perniagaan F&B Malaysia`];
    if (aspek === undefined || aspek === "semua" || aspek === "pasaran") {
      bahagian.push(
        `## Data pasaran [DISAHKAN - DOSM]`,
        `- Hasil perkhidmatan F&B: ${FNB_PASARAN.hasil_2024} (2024) -> ${FNB_PASARAN.hasil_2025}; ${FNB_PASARAN.suku_2026}`,
        `- ${FNB_PASARAN.pertubuhan}: ${FNB_PASARAN.struktur}`,
        `- ${FNB_PASARAN.selangor}; ${FNB_PASARAN.pekerja}`,
        `- Inflasi makanan di luar rumah: ${FNB_PASARAN.inflasi}`,
      );
    }
    bahagian.push(`## Senario\n\n${jadualSenario}`);
    if (aspek === undefined || aspek === "semua" || aspek === "kewangan" || aspek === "pematuhan") {
      bahagian.push(
        `## Peraturan kunci [DISAHKAN - MySST/halal.gov.my]`,
        `- ${FNB_PASARAN.sst_fnb}`,
        `- Halal JAKIM: sijil dalam 30 hari selepas bayaran & prosedur lengkap; sah 2 tahun; permohonan via MYeHALAL; syarat utama: panel halal dalaman, sumber mentah halal, SSM aktif, kebersihan`,
        `- Akta Makanan 1983 & Peraturan Kebersihan Makanan 2009: kursus pengendalian makanan wajib [~RM50-70, sah 5 tahun, ANGGARAN]; vaksin antitifoid pengendali makanan [ANGGARAN]`,
        `- Gaji sektor: median RM2,013/bln (2025, DISAHKAN); gaji minimum RM1,700 [ANGGARAN - semakan]; EPF majikan 13%/12%, SOCSO+EIS ~1.75% [ANGGARAN]`,
      );
    }
    bahagian.push(`> Sumber: ${FNB_PASARAN.sumber}. Julat modal/margin ialah ANGGARAN industri - sentiasa sahkan dengan operator sebenar sebelum mengaku sebagai fakta.`);
    return { content: [{ type: "text" as const, text: bahagian.join("\n\n") }] };
  },
);

// 15. kalkulator_harga_jual
  server.registerTool(
  "kalkulator_harga_jual",
  {
    title: "Kalkulator harga jual F&B (food costing)",
    description:
      "Kira harga jual menu daripada kos bahan: kos bahan per hidangan + sasaran food-cost % (piawaian 28-35%) -> harga jual, dan semak semula food-cost % bagi harga sedia ada. Termasuk nota SST 6% (ambang RM1.5M) dan harga psikologi (.90/.95). Guna bila tetapkan harga menu baru atau semak semula harga lama.",
    inputSchema: {
      kos_bahan: z.number().describe("Kos bahan (RM) per hidangan, contoh 4.20."),
      harga_sedia_ada: z.number().optional().describe("Harga jual sedia ada (RM) untuk semak food-cost %."),
      food_cost_target: z.number().optional().describe("Sasaran food-cost % (default 30, piawaian 28-35)."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ kos_bahan, harga_sedia_ada, food_cost_target }: { kos_bahan: number; harga_sedia_ada?: number; food_cost_target?: number }) => {
    if (!Number.isFinite(kos_bahan) || kos_bahan <= 0) {
      return { content: [{ type: "text" as const, text: "kos_bahan mesti nombor positif (RM)." }] };
    }
    const sasaran = Math.max(10, Math.min(60, food_cost_target ?? 30));
    const hargaTetap = kos_bahan / (sasaran / 100);
    const psikologi = (x: number) => (x < 10 ? Math.floor(x) + 0.9 : Math.floor(x) + 0.9);
    const hargaCadang = Math.max(psikologi(hargaTetap), kos_bahan + 0.9);
    const baris: string[] = [
      "# Kalkulator Harga Jual (Food Costing)",
      "",
      `- Kos bahan: RM${kos_bahan.toFixed(2)} / hidangan`,
      `- Sasaran food-cost: ${sasaran}% [piawaian industri 28-35%, ANGGARAN]`,
      `- Harga jual sasaran (teori): RM${hargaTetap.toFixed(2)}`,
      `- Cadangan harga (psikologi RM0.90): RM${hargaCadang.toFixed(2)} -> food-cost sebenar ${((kos_bahan / hargaCadang) * 100).toFixed(1)}%`,
    ];
    if (Number.isFinite(harga_sedia_ada) && harga_sedia_ada! > 0) {
      const fc = ((kos_bahan / harga_sedia_ada!) * 100).toFixed(1);
      const sihat = kos_bahan / harga_sedia_ada! <= 0.35;
      baris.push(
        `- Harga sedia ada RM${harga_sedia_ada!.toFixed(2)} -> food-cost ${fc}% ${sihat ? "DALAM julat sihat (<=35%)" : "DI LUAR julat sihat (>35%) - semak porsi atau kos pembekal"}`,
      );
    }
    baris.push(
      "",
      "## Peringatan kewangan [DISAHKAN - MySST]",
      "- Jika jualan tahunan > RM1,500,000: daftar SST, kadar perkhidmatan F&B = 6% (bukan 8%). Harga menu dipaparkan sebelum SST.",
      "- Sewa premis/peralatan: SST 8% bila tuan premis berdaftar (ambang RM500k, 1 Jul 2025) - faktorkan ke kos tetap.",
      "- Komisen platform delivery dilaporkan 25-35% [ANGGARAN]: untuk jualan platform, sasaran food-cost lebih rendah atau harga menu platform lebih tinggi.",
      "",
      "> Julat piawaian ialah amalan industri [ANGGARAN], bukan angka rasmi kerajaan. Kos buruh (25-35%), sewa (10-15%), utiliti (8-12%) perlu diasingkan daripada food-cost.",
    );
    return { content: [{ type: "text" as const, text: baris.join("\n") }] };
  },
);

// 16. kira_bep
  server.registerTool(
  "kira_bep",
  {
    title: "Kira titik pulang modal (BEP) F&B",
    description:
      "Kira titik pulang modal (break-even point) perniagaan F&B: kos tetap bulanan, purata harga pesanan, kos pembolehubah % -> BEP dalam pesanan/bulan, pesanan/hari (30 hari) dan RM bulanan, dengan amaran kesihatan (jualan < 1.1x BEP = zon bahaya). Guna bila uji kelayakan idea, rancang sasaran harian atau nilai lokasi baharu.",
    inputSchema: {
      kos_tetap_bulanan: z.number().describe("Jumlah kos tetap sebulan (RM): sewa, gaji tetap, utiliti, installment peralatan, lesen."),
      purata_harga_pesanan: z.number().describe("Purata nilai sepesanan/sebil (RM), contoh 12.50."),
      kos_pembolehubah_peratus: z.number().optional().describe("Kos pembolehubah % jualan: bahan + pembungkus + komisen platform (default 45)."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ kos_tetap_bulanan, purata_harga_pesanan, kos_pembolehubah_peratus }: { kos_tetap_bulanan: number; purata_harga_pesanan: number; kos_pembolehubah_peratus?: number }) => {
    const kt = Number(kos_tetap_bulanan);
    const hp = Number(purata_harga_pesanan);
    const kp = Math.max(5, Math.min(95, kos_pembolehubah_peratus ?? 45));
    if (!Number.isFinite(kt) || kt <= 0 || !Number.isFinite(hp) || hp <= 0) {
      return { content: [{ type: "text" as const, text: "kos_tetap_bulanan dan purata_harga_pesanan mesti nombor positif (RM)." }] };
    }
    const marginSumbangan = 1 - kp / 100;
    const bepRm = kt / marginSumbangan;
    const bepPesanan = bepRm / hp;
    const bepHarian = bepPesanan / 30;
    const bahaya = bepRm > 0 ? "" : "";
    const baris = [
      "# Titik Pulang Modal (Break-Even Point)",
      "",
      `- Kos tetap bulanan: RM${kt.toLocaleString("en-MY")}`,
      `- Purata harga pesanan: RM${hp.toFixed(2)}; kos pembolehubah: ${kp}%`,
      `- Margin sumbangan: ${(marginSumbangan * 100).toFixed(1)}%`,
      "",
      `## Keputusan`,
      `- **BEP: RM${bepRm.toLocaleString("en-MY", { maximumFractionDigits: 0 })} / bulan**`,
      `- BEP: ${Math.ceil(bepPesanan).toLocaleString("en-MY")} pesanan / bulan`,
      `- BEP: ~${Math.ceil(bepHarian)} pesanan / hari (anggaran 30 hari/bulan)`,
      `- Sasaran selamat (1.3x BEP): ~${Math.ceil(bepHarian * 1.3)} pesanan / hari, RM${(bepRm * 1.3).toLocaleString("en-MY", { maximumFractionDigits: 0 })}/bulan`,
      "",
      `## Amaran automatik`,
      `- Jualan bulanan di bawah RM${(bepRm * 1.1).toLocaleString("en-MY", { maximumFractionDigits: 0 })} (<1.1x BEP) = **zon bahaya** - tindakan: semak harga menu (kalkulator_harga_jual), kurang sisa, renegosiasi sewa, tolak promo didanai berlebihan.`,
      bahaya,
      "",
      "> Rujukan struktur kos [ANGGARAN]: bahan 28-35%, buruh 25-35%, sewa 10-15%, utiliti 8-12%. Kos tetap SEMUA perlu dimasukkan termasuk SST sewa 8% bila tuan premis berdaftar (DISAHKAN MySST, 1 Jul 2025).",
    ].filter(Boolean);
    return { content: [{ type: "text" as const, text: baris.join("\n") }] };
  },
);

// 17. pelan_kandungan_fnb
  server.registerTool(
  "pelan_kandungan_fnb",
  {
    title: "Pelan kandungan mingguan F&B (TikTok/IG/WhatsApp)",
    description:
      "Jana pelan kandungan 7 hari untuk jenama F&B Malaysia: idea TikTok/IG Reels, WhatsApp broadcast, tindakan Google Maps, tema musim (Ramadhan/Raya/CNY/Merdeka). Berasaskan funnel tempatan: Kesedaran -> Percubaan -> Berulang -> Advokasi. Guna bila merancang minggu pemasaran jenama makanan/minuman.",
    inputSchema: {
      jenama: z.string().describe("Nama jenama / kedai."),
      senario: z
        .enum(["kopitiam-24-jam", "kafe-khas", "dapur-awan", "restoran-keluarga", "katering-acara", "food-truck-bazar"])
        .optional()
        .describe("Senario F&B (dari alat scenari_fnb) untuk suaikan tema; default kafe-khas."),
      tema_musim: z.string().optional().describe("Tema musim pilihan, contoh 'Bazar Ramadhan', 'Promo Merdeka', 'Raya Haji'."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ jenama, senario, tema_musim }: { jenama: string; senario?: string; tema_musim?: string }) => {
    const nama = wpSanitasiMermaid(jenama) || "Jenama F&B";
    const s = FNB_SENARIO.find((x) => x.id === (senario ?? "kafe-khas")) ?? FNB_SENARIO[1];
    const tema = wpSanitasiMermaid(tema_musim ?? "") || null;
    const hari = [
      { hari: "Isnin", jenis: "Kesedaran", idea: `TikTok: "POV: ${nama} ${s.id === "kopitiam-24-jam" ? "buka 24 jam dan roti bakar masih panas jam 2 pagi" : "sedang siapkan hidangan paling laris"}" - video pendek dapur, muzik tren.` },
      { hari: "Selasa", jenis: "Kesedaran", idea: `IG Reels: "Hidden gem ${tema ? tema : "di kawasan anda"}" - tunjuk lokasi + harga jujuk 1 item terlaris.` },
      { hari: "Rabu", jenis: "Percubaan", idea: `WhatsApp broadcast: kupon percubaan "beli 1 free 1" untuk pelanggan lama (senarai broadcast); hadkan tempoh.` },
      { hari: "Khamis", jenis: "Percubaan", idea: `TikTok/IG: teaser menu baharu/musiman ${tema ? `(${tema})` : ""} - minta komen "MAU" untuk catu minat.` },
      { hari: "Jumaat", jenis: "Berulang", idea: `TikTok hujung minggu: jualan hujung minggu + solat Jumaat menu cepat; pinned IG story menu.` },
      { hari: "Sabtu", jenis: "Berulang", idea: `Google Maps: tanya 5 pelanggan puas hati untuk review; balas SEMUA review lama yang belum dibalas.` },
      { hari: "Ahad", jenis: "Advokasi", idea: `IG: kandungan UGC/re-share pelanggan + sneak peek minggu depan; kemas kini linktree (menu -> WhatsApp -> Maps).` },
    ];
    const baris = [
      `# Pelan Kandungan Mingguan — ${nama}`,
      `- Senario: ${s.nama} (margin ${s.margin})`,
      tema ? `- Tema musim: ${tema}` : "",
      "",
      `## Funnel tempatan: Kesedaran -> Percubaan -> Berulang -> Advokasi`,
      `> Anchor digital [DISAHKAN BNM]: perbankan mudah alih RM240B/bulan (2026) & pengeluaran ATM -35% - QR/e-wallet tiada halangan.`,
      "",
      ...hari.map((h) => `### ${h.hari} — ${h.jenis}\n- ${h.idea}`),
      "",
      `## Metrik pantau (bot lapor mingguan)`,
      `- % pelanggan berulang 30-hari; kadar buka/klik broadcast WhatsApp; rating & jumlah review Google Maps; jualan/jam per slot promo; ${s.kpi}`,
      "",
      `## Peraturan`,
      `- Semua salinan Bahasa Melayu mesra; hormati sensitiviti budaya (halal, puasa, perayaan pelbagai kaum).`,
      `- Jangan janji diskaun palsu atau had masa palsu; harga akhir patut sahkan dengan pemilik.`,
      `- Ramadhan: elak kandungan makanan siang hari untuk khalayak berpuasa; alih ke kandungan prep/pre-order petang.`,
    ].filter(Boolean);
    return { content: [{ type: "text" as const, text: baris.join("\n") }] };
  },
);

// 18. jawab_ulasan
  server.registerTool(
  "jawab_ulasan",
  {
    title: "Jana balasan ulasan Google Maps (BM/EN)",
    description:
      "Jana balasan ulasan pelanggan untuk Google Maps/delivery platform dalam Bahasa Melayu dan Inggeris: ulasan positif (ucapan terima kasih + jemput kembali) dan negatif (minta maaf ikhlas + tindakan konkrit + saluran luar talian), tanpa janji bayaran balik automatik. Guna bila perlu balas ulasan dengan nada jenama yang konsisten.",
    inputSchema: {
      ulasan: z.string().describe("Teks ulasan pelanggan (salin apa yang ditaip)."),
      penilaian: z.number().optional().describe("Bintang 1-5 (jika tahu)."),
      jenama: z.string().optional().describe("Nama jenama/kedai (default 'kedai kami')."),
      konteks: z.string().optional().describe("Konteks tindakan sebenar yang boleh ditawarkan, contoh ' voucher RM5', 'latihan semula krew'."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ ulasan, penilaian, jenama, konteks }: { ulasan: string; penilaian?: number; jenama?: string; konteks?: string }) => {
    const nama = wpSanitasiMermaid(jenama ?? "") || "kedai kami";
    const teks = wpSanitasiMermaid(ulasan ?? "");
    if (!teks) return { content: [{ type: "text" as const, text: "Berikan teks ulasan pelanggan." }] };
    const bintang = Math.max(1, Math.min(5, Math.trunc(penilaian ?? 0)));
    const negatif = teks.length > 0 && (bintang <= 3 || /(buruk|lambat|kotor|mahal|dissapoint|slow|dirty|rusak|lewat|salah|hampeh|kecewa|sucks|worst)/i.test(teks));
    const tindakan = wpSanitasiMermaid(konteks ?? "") || "sila terima maaf kami dan beri kami peluang menaikkan semula pengalaman anda";
    const bm = negatif
      ? `Terima kasih atas maklum balas anda, dan kami mohon maaf atas pengalaman yang kurang memuaskan di ${nama}. Apa yang anda kongsi sudah kami teruskan kepada pasukan kami dan tindakan pembaikan sedang diambil: ${tindakan}. Kami berharap boleh beri peluang kepada kami untuk menaikkan semula pengalaman anda - sila hubungi kami terus di WhatsApp agar kami boleh selesaikannya dengan segera.`
      : `Terima kasih banyak atas sokongan anda kepada ${nama}! Kami gembira anda berpuas hati dan maklum balas ini akan kami kongsi dengan krew kami. Kami menanti kedatangan anda lagi - jumpa lagi tak lama lagi!`;
    const en = negatif
      ? `Thank you for your feedback, and we sincerely apologise for the disappointing experience at ${nama}. We have shared it with our team and corrective action is underway: ${tindakan}. We would appreciate another chance to make it right - please reach out to us directly on WhatsApp so we can resolve it quickly.`
      : `Thank you so much for supporting ${nama}! We are glad you enjoyed your visit and will share this with our crew. See you again soon!`;
    const baris = [
      "# Balasan Ulasan",
      `- Penilaian: ${bintang > 0 ? `${bintang} bintang` : "(tidak diberi)"} | Klasifikasi: ${negatif ? "NEGATIF/PERLU PEMBETULAN" : "POSITIF"}`,
      "",
      `## Bahasa Melayu`,
      bm,
      "",
      `## English`,
      en,
      "",
      "## Peraturan jenama",
      "- JANGAN pernah janji bayaran balik/percuma secara automatik - sahkan dengan pemilik dahulu.",
      "- Elak pertengkaran awam; alihkan resolusi ke WhatsApp/DM (saluran luar talian).",
      "- Balas SEMUA ulasan dalam 24-48 jam; ulasan Google mempengaruhi trafik 'kedai makan dekat sini'.",
    ];
    return { content: [{ type: "text" as const, text: baris.join("\n") }] };
  },
);

  return server;
}

// ---------------------------------------------------------------- HTTP
const app = express();
app.use(express.json({ limit: "2mb" }));

const stateless = { sessionIdGenerator: undefined, enableJsonResponse: true } as const;

app.post("/mcp", async (req, res) => {
  try {
    const httpTransport = new StreamableHTTPServerTransport(stateless as never);
    const mcpServer = buildMalaysiaServer();
    await mcpServer.connect(httpTransport);
    res.on("close", () => {
      void httpTransport.close();
      void mcpServer.close();
    });
    await httpTransport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Ralat /mcp:", error);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Ralat dalaman" }, id: null });
    }
  }
});

// Mod tanpa-keadaan tanpa aliran SSE: GET/DELETE ditolak dengan jelas.
app.get("/mcp", (_req, res) => {
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Kaedah tidak dibenarkan" }, id: null });
});
app.delete("/mcp", (_req, res) => {
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Kaedah tidak dibenarkan" }, id: null });
});

app.get("/health", (_req, res) => {
  res.json({ service: "malaysia-mcp", tools: 18, status: "ok" });
});

app.listen(PORT, () => {
  console.info(JSON.stringify({ type: "malaysia-mcp", url: `http://127.0.0.1:${PORT}/mcp`, tools: 18 }));
});
