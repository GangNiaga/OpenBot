/**
 * Pelayan MCP "memori" - memori jangka panjang + RAG dokumen untuk OpenBot (pgvector di Supabase).
 *
 * StreamableHTTP (MCP rasmi) pada port 4211, endpoint /mcp, mod tanpa-keadaan (stateless)
 * dengan jawapan JSON - cermin kepada pelayan "malaysia" (port 4210). Setiap permintaan
 * diberi satu McpServer baharu, jadi tiada sesi yang dikongsi antara Bot.
 *
 * Simpanan: jadual `memori_malaysia` pada DATABASE_URL (Supabase, sambungan pooler,
 * max=2 supaya kolam kecil tidak menelan kuota sambungan pelayan utama). Vektor
 * disimpan sebagai pgvector `vector(1024)` dengan indeks HNSW (vector_cosine_ops).
 *
 * Skema: server mem-bootstrap jadual dengan CREATE TABLE IF NOT EXISTS + ALTER TABLE
 * ADD COLUMN IF NOT EXISTS (larian pertama alat apa-apa), jadi deployment lama naik taraf
 * di tempat tanpa migrasi manual. Kolum temporal: `valid_at` (bila fakta mula/akan menjadi
 * benar; default now()) dan `superseded_at` (padam lembut - lupa = ditanda, bukan dihapus,
 * supaya pertanyaan "as-of" masa lampau masih nampak rekod itu). Kolum dokumen: `tajuk`
 * dan `no_cebisan`. `kind` (sedia ada sejak DDL asal) memegang 'fakta'/'keutamaan'/
 * 'peristiwa' untuk memori dan 'doc'/'doc_chunk' untuk dokumen RAG.
 *
 * Carian: hibrid dua pangkalan kedudukan yang digabungkan dengan Reciprocal Rank Fusion
 * (RRF, k=60) - pangkalan vektor (cosine `<=>`, 50 kandidat teratas) dan pangkalan leksikal
 * (BM25 k1=1.2 b=0.75, dihitung dalam TypeScript ke atas gabungan kandidat; kandidat leksikal
 * diambil dengan ILIKE bagi setiap token pertanyaan, maks 100 baris). BM25 + RRF menggantikan
 * pengadun berpemberat lama (0.70/0.20/0.10) kerana RRF tidak perlu penormalan skor merentas
 * dua skala yang berbeza.
 *
 * Embedding: API NVIDIA yang sama dengan pelayan utama (OPENAI_BASE_URL/OPENAI_API_KEY,
 * atau MEMORI_EMBED_BASE_URL/MEMORI_EMBED_API_KEY). Model lalai nvidia/nemotron-3.5-embed-1b
 * (asimetrik - input_type "query"/"passage" wajib; dimensions=1024 kerana pemangkasan
 * Matryoshka, dan HNSW pgvector menolak lajur melebihi 2000 dim). Jika tiada kunci atau
 * API gagal, embedding hash tempatan yang deterministik (bag-of-token-hashes, L2) digunakan
 * - jarak antara model berbeza tidak bermakna, jadi nama model dipulangkan bersama hasil.
 *
 * Alat yang ditawarkan:
 *  - simpan_memori   embed kandungan + INSERT (valid_at opsyen), pulangkan id
 *  - cari_memori     carian hibrid RRF (vektor + BM25) dengan penapis temporal valid_at
 *  - lupa_memori     padam lembut: superseded_at = now()
 *  - bilang_memori   kiraan memori hidup per kind (+ cebisan dokumen, + dilupakan)
 *  - simpan_dokumen  pecah teks kepada cebisan ~700-900 aksara pada sempadan perenggan,
 *                    embed setiap cebisan, simpan kind='doc_chunk' (RAG)
 *  - cari_dokumen    carian hibrid sama, ditapis kepada cebisan dokumen; pulangkan tajuk
 *  - padam_dokumen   lupakan semua cebisan sesuatu dokumen mengikut tajuk
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import postgres from "postgres";
import { z } from "zod";

const PORT = Number.parseInt(process.env.MALAYSIA_MEMORI_PORT ?? "4211", 10);

// ---------------------------------------------------------------- Konfigurasi
// Shell tempatan boleh menetapkan DATABASE_URL yang bukan Postgres (cth. sandbox file:),
// jadi URL database hanya diterima jika bermula dengan postgres://.
const DB_URL =
  typeof process.env.DATABASE_URL === "string" &&
  process.env.DATABASE_URL.startsWith("postgres://")
    ? process.env.DATABASE_URL
    : "";

const EMBED_BASE =
  process.env.MEMORI_EMBED_BASE_URL?.replace(/\/$/, "") ||
  process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ||
  "https://integrate.api.nvidia.com/v1";
const EMBED_KEY =
  process.env.MEMORI_EMBED_API_KEY || process.env.OPENAI_API_KEY || "";
const EMBED_MODEL =
  process.env.MEMORI_EMBED_MODEL || "nvidia/nemotron-3.5-embed-1b";
const EMBED_DIM =
  Number.parseInt(process.env.MEMORI_EMBED_DIM ?? "1024", 10) || 1024;
const HAD_LALAI = 5;
const KINDS = ["fakta", "keutamaan", "peristiwa"] as const;
type Kind = (typeof KINDS)[number];

// Carian hibrid (RRF + BM25) - semua pemalar di sini adalah pilihan reka bentuk yang
// sengaja diletakkan sebagai pemalar, bukan penyelesaian persekitaran.
/** Kandidat vektor per pertanyaan (teratas cosine) sebelum penggabungan RRF. */
const KANDIDAT_VEKTOR = 50;
/** Kandidat leksikal per pertanyaan (baris ILIKE sepadan mana-mana token). */
const KANDIDAT_LEKSIKAL = 100;
/** Pemalar RRF (pilihan papper asal); 60 menghalang pangkalan teratas mendominasi. */
const RRF_K = 60;
/** BM25: penambah frekuensi dan pengehad pemonotonan panjang dokumen. */
const BM25_K1 = 1.2;
const BM25_B = 0.75;
/** Bilangan maksimum token pertanyaan yang dituang ke dalam OR ILIKE (kawalan saiz SQL). */
const MAKS_ISTILAH_SQL = 8;

// Cebisan dokumen (RAG): sasaran ~700 aksara, siling 900, pada sempadan perenggan.
const CEBISAN_SASARAN = 700;
const CEBISAN_MAKS = 900;
/** Ekor terlalu pendek digabungkan ke cebisan sebelumnya jika muat dalam siling. */
const CEBISAN_EKOR_MIN = 120;
/** Kawalan larian: satu dokumen tidak boleh menghasilkan lebih cebisan daripada ini. */
const MAKS_CEBISAN_DOKUMEN = 200;

// ---------------------------------------------------------------- Database
let sql: postgres.Sql | null = null;

/** Kolam sambungan lambat - hanya dibuka bila alat pertama benar-benar digunakan. */
function db(): postgres.Sql {
  if (!DB_URL)
    throw new Error("DATABASE_URL tidak ditetapkan (postgres:// diperlukan)");
  if (!sql) {
    sql = postgres(DB_URL, {
      max: 2, // pooler sesi Supabase - simpan kolam kecil
      idle_timeout: 30,
      max_lifetime: 60 * 30,
      ssl:
        DB_URL.includes("sslmode=require") || DB_URL.includes("sslmode=prefer")
          ? "require"
          : undefined,
    });
  }
  return sql;
}

/**
 * Bootstrap skema (sekali per proses): CREATE TABLE IF NOT EXISTS + ALTER TABLE
 * ADD COLUMN IF NOT EXISTS supaya deployment lama yang jadualnya dibuat di luar kod
 * naik taraf di tempat. Gagal (cth. tiada kebenaran) tidak dimemo-kan - panggilan alat
 * berikutnya cuba semula. Dim diinterpolasi sebagai integer disahkan, bukan parameter,
 * kerana typmod `vector(N)` menolak placeholder.
 */
let skemaPromise: Promise<void> | null = null;

function pastikanSkema(): Promise<void> {
  if (!skemaPromise) {
    skemaPromise = (async () => {
      const s = db();
      const dim =
        Number.isInteger(EMBED_DIM) && EMBED_DIM > 0 && EMBED_DIM <= 2000
          ? EMBED_DIM
          : 1024;
      // Sambungan pgvector - cuba, tetapi jangan matikan jika peranan pooler tiada kebenaran.
      await s.unsafe("create extension if not exists vector").catch(() => null);
      await s.unsafe(`
        create table if not exists memori_malaysia (
          id bigserial primary key,
          thread_id text,
          agent_id text,
          kind text not null default 'fakta',
          kandungan text not null,
          tajuk text,
          no_cebisan integer,
          embedding vector(${dim}),
          model text,
          created_at timestamptz not null default now(),
          valid_at timestamptz not null default now(),
          superseded_at timestamptz
        )`);
      // Naik taraf di tempat untuk jadual yang sudah sedia (semua no-op jika kolum ada).
      await s.unsafe(
        "alter table memori_malaysia add column if not exists kind text not null default 'fakta'",
      );
      await s.unsafe(
        "alter table memori_malaysia add column if not exists valid_at timestamptz not null default now()",
      );
      await s.unsafe(
        "alter table memori_malaysia add column if not exists superseded_at timestamptz",
      );
      await s.unsafe(
        "alter table memori_malaysia add column if not exists tajuk text",
      );
      await s.unsafe(
        "alter table memori_malaysia add column if not exists no_cebisan integer",
      );
      // Indeks HNSW hanya dibuat jika jadual belum ada indeks HNSW - `if not exists`
      // hanya menyemak nama, jadi semak definisinya supaya tiada indeks pendua.
      const hnsw = await s`
        select indexname from pg_indexes
        where tablename = 'memori_malaysia' and indexdef ilike '%hnsw%'`;
      if (hnsw.length === 0) {
        await s.unsafe(
          "create index if not exists memori_malaysia_hnsw on memori_malaysia using hnsw (embedding vector_cosine_ops)",
        );
      }
    })().catch((e) => {
      skemaPromise = null; // cuba semula pada panggilan alat berikutnya
      throw e;
    });
  }
  return skemaPromise;
}

// ---------------------------------------------------------------- Embedding
function normaL2(v: number[]): number[] {
  let jumlah = 0;
  for (const x of v) jumlah += x * x;
  const n = Math.sqrt(jumlah);
  if (!Number.isFinite(n) || n === 0) {
    v[0] = 1; // vektor sifar menjadikan jarak cosine NaN - elakkan
    return v;
  }
  return v.map((x) => x / n);
}

/** FNV-1a 32-bit - deterministik merentas jangka dan proses. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Fallback tanpa API: bag-of-token-hashes deterministik. Kualiti semantik jauh lebih rendah
 * daripada embedding NVIDIA (tiada sinonim/parafraza), tetapi bulat-trip simpan/cari tetap berfungsi.
 */
function embedHash(teks: string): number[] {
  const v = new Array<number>(EMBED_DIM).fill(0);
  const tokens = teks
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u024f]+/)
    .filter((t) => t.length > 1);
  for (const t of tokens) {
    v[fnv1a(t) % EMBED_DIM] += 1;
    v[fnv1a(`${t}~`) % EMBED_DIM] += 0.5;
  }
  return normaL2(v);
}

/**
 * Panggil API embedding NVIDIA. Pulangkan null bila tidak boleh (tiada kunci, ralat rangkaian,
 * bentuk jawapan aneh) supaya pemanggil boleh jatuh ke hash tempatan. Parameter yang model
 * tolak (input_type / dimensions) dibuang dan cuba sekali lagi.
 */
async function embedNvidia(
  teks: string,
  jenis: "query" | "passage",
): Promise<number[] | null> {
  if (!EMBED_KEY) return null;
  const badan: Record<string, unknown> = { model: EMBED_MODEL, input: [teks] };
  if (jenis) badan.input_type = jenis;
  if (EMBED_DIM) badan.dimensions = EMBED_DIM;
  for (let cuba = 0; cuba < 2; cuba++) {
    let res: Response | null = null;
    try {
      res = await fetch(`${EMBED_BASE}/embeddings`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${EMBED_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(badan),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      return null;
    }
    if (res.status === 400) {
      const b = (await res.json().catch(() => null)) as {
        message?: string;
        detail?: string;
      } | null;
      const msg = `${b?.message ?? ""} ${b?.detail ?? ""}`.toLowerCase();
      if ("input_type" in badan && msg.includes("input_type")) {
        delete badan.input_type;
        continue;
      }
      if ("dimensions" in badan && msg.includes("dimension")) {
        delete badan.dimensions;
        continue;
      }
      return null;
    }
    if (!res.ok) return null;
    const j = (await res.json().catch(() => null)) as {
      data?: Array<{ embedding?: number[] }>;
    } | null;
    const vec = j?.data?.[0]?.embedding;
    if (
      !Array.isArray(vec) ||
      vec.length === 0 ||
      !vec.every((x) => Number.isFinite(x))
    )
      return null;
    if (vec.length === EMBED_DIM) return vec;
    if (vec.length > EMBED_DIM) return normaL2(vec.slice(0, EMBED_DIM)); // MRL: pangkas + normal semula
    return null; // lebih pendek daripada lajur vector(EMBED_DIM) - tidak boleh disimpan
  }
  return null;
}

/** Embed dengan pilihan terbaik yang ada; nama model dilaporkan supaya jarak boleh ditafsir. */
async function embed(
  teks: string,
  jenis: "query" | "passage",
): Promise<{ vec: number[]; model: string }> {
  const nv = await embedNvidia(teks, jenis);
  if (nv) return { vec: nv, model: EMBED_MODEL };
  return { vec: embedHash(teks), model: "hash-lokal" };
}

// ------------------------------------------------------------- Carian hibrid
/**
 * Tokenizer dikongsi oleh BM25 dan senarai istilah ILIKE. Kata henti BM/EN dibuang -
 * sama seperti tokenizer lama, supaya tingkah laku leksikal kekal konsisten.
 */
function tokenizeTeks(teks: string): string[] {
  const stopwords = new Set([
    "yang", "dan", "atau", "di", "ke", "dari", "pada", "untuk", "dengan", "apa",
    "ada", "saya", "kami", "anda", "itu", "ini", "the", "of", "to", "in", "and",
    "is", "my", "our", "your", "a", "an",
  ]);
  return teks
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1 && !stopwords.has(t));
}

/**
 * BM25 (k1=1.2, b=0.75) dihitung DALAM TypeScript ke atas gabungan kandidat
 * (vektor + leksikal), bukan di SQL - jadual ini kecil dan IDF tempatan-kandidat
 * sudah cukup untuk menyusun semula. IDF memguna varian tak-negatif
 * ln(1 + (N - df + 0.5)/(df + 0.5)) supaya istilah yang ada di semua kandidat
 * tidak memberi skor negatif. Pulangkan skor mengikut id kandidat (kunci string).
 */
function bm25Skor(
  istilah: string[],
  kandidat: Array<{ id: string; kandungan: string }>,
): Map<string, number> {
  const skor = new Map<string, number>();
  const unik = [...new Set(istilah)];
  if (kandidat.length === 0 || unik.length === 0) return skor;
  const N = kandidat.length;
  const tokenDok = kandidat.map((k) => tokenizeTeks(k.kandungan));
  const avgdl = tokenDok.reduce((a, t) => a + t.length, 0) / N || 1;
  const tf = tokenDok.map((tokens) => {
    const m = new Map<string, number>();
    for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  });
  for (const t of unik) {
    const df = tf.filter((m) => (m.get(t) ?? 0) > 0).length;
    if (df === 0) continue;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    tf.forEach((m, i) => {
      const f = m.get(t) ?? 0;
      if (f === 0) return;
      const dl = tokenDok[i].length || 1;
      const tambah =
        idf *
        ((f * (BM25_K1 + 1)) /
          (f + BM25_K1 * (1 - BM25_B + (BM25_B * dl) / avgdl)));
      skor.set(kandidat[i].id, (skor.get(kandidat[i].id) ?? 0) + tambah);
    });
  }
  return skor;
}

/**
 * Reciprocal Rank Fusion: skor = 1/(k + rank_vektor) + 1/(k + rank_leksikal),
 * rank bermula 1. Baris yang wujud dalam satu pangkalan sahaja menerima komponen
 * pangkalan itu sahaja (praktis RRF piawai). k=60 menghalang pangkalan teratas
 * mendominasi penuh, jadi persetujuan kedua-dua pangkalan yang menang.
 */
function rrfSkor(urutanVektor: string[], urutanLeksikal: string[]): Map<string, number> {
  const skor = new Map<string, number>();
  urutanVektor.forEach((id, i) =>
    skor.set(id, (skor.get(id) ?? 0) + 1 / (RRF_K + i + 1)),
  );
  urutanLeksikal.forEach((id, i) =>
    skor.set(id, (skor.get(id) ?? 0) + 1 / (RRF_K + i + 1)),
  );
  return skor;
}

// ---------------------------------------------------------------- Alat bantuan
function barisMemori(b: {
  id: number | string;
  kandungan: string;
  kind?: string | null;
  jarak?: number | null;
  created_at?: Date | string | null;
  rrf?: number | null;
  bm25?: number | null;
  tajuk?: string | null;
  no_cebisan?: number | null;
}): string {
  const masa = b.created_at
    ? new Date(b.created_at).toISOString().replace("T", " ").slice(0, 16) +
      " UTC"
    : "";
  const kind = b.kind ? ` [${b.kind}]` : "";
  const dok = b.tajuk
    ? ` «${b.tajuk}»${typeof b.no_cebisan === "number" ? ` cebisan ${b.no_cebisan}` : ""}`
    : "";
  const jarak =
    typeof b.jarak === "number" ? ` | jarak ${b.jarak.toFixed(4)}` : "";
  const hibrid =
    typeof b.rrf === "number"
      ? ` | RRF ${b.rrf.toFixed(4)}${
          typeof b.bm25 === "number" && b.bm25 > 0
            ? ` (BM25 ${b.bm25.toFixed(2)})`
            : ""
        }`
      : "";
  return `- #${b.id}${kind}${dok}${jarak}${hibrid}${masa ? ` | ${masa}` : ""}\n  ${b.kandungan}`;
}

type BarisDb = {
  id: number | string;
  kandungan: string;
  kind: string | null;
  created_at: Date | string | null;
  tajuk: string | null;
  no_cebisan: number | null;
  jarak?: number | string | null;
};

type HasilHibrid = {
  baris: Array<BarisDb & { jarak: number | null; rrf: number; bm25: number }>;
  model: string;
};

/**
 * Teras carian hibrid yang dikongsi oleh cari_memori dan cari_dokumen:
 *   1. kandidat vektor: teratas cosine `<=>` (KANDIDAT_VEKTOR);
 *   2. kandidat leksikal: ILIKE mana-mana token pertanyaan (KANDIDAT_LEKSIKAL);
 *   3. gabungkan (dedup ikut id), hitung BM25 ke atas gabungan itu, susun rank;
 *   4. RRF kedua-dua pangkalan, potong kepada had.
 * Tapis temporal: sah pada cutoff (valid_at <= cutoff) dan belum dilupakan semasa
 * itu (superseded_at null atau > cutoff) - memberi semantik "sebagaimana pada masa".
 */
async function carianHibrid(
  jenis: "memori" | "dokumen",
  teks: string,
  had: number,
  pilihan: { agentId?: string; cutoff: Date },
): Promise<HasilHibrid> {
  await pastikanSkema();
  const { vec, model } = await embed(teks, "query");
  const s = db();
  const syarat = [
    s`(superseded_at is null or superseded_at > ${pilihan.cutoff})`,
    jenis === "dokumen"
      ? s`kind in ('doc', 'doc_chunk')`
      : s`(kind is null or kind not in ('doc', 'doc_chunk'))`,
  ];
  if (pilihan.agentId)
    syarat.push(s`(agent_id = ${pilihan.agentId} or agent_id is null)`);
  // Fragmen digabung dengan sarangan (postgres.js tiada sql.join); sarangan
  // di-flatten menjadi satu SQL dengan parameter berurutan semasa pelaksanaan.
  let tapis = s`where ${syarat[0]}`;
  for (const f of syarat.slice(1)) tapis = s`${tapis} and ${f}`;

  const barisVektor = (await s`
    select id, kandungan, kind, created_at, tajuk, no_cebisan,
           (embedding <=> ${JSON.stringify(vec)}::vector) as jarak
    from memori_malaysia
    ${tapis}
    order by embedding <=> ${JSON.stringify(vec)}::vector
    limit ${KANDIDAT_VEKTOR}`) as BarisDb[];

  const istilah = [...new Set(tokenizeTeks(teks))].slice(0, MAKS_ISTILAH_SQL);
  let barisLeksikal: BarisDb[] = [];
  if (istilah.length > 0) {
    // OR-chain dibina sebagai fragmen bersarang (postgres.js tiada sql.join);
    // token datang daripada tokenizer (\p{L}\p{N} sahaja) jadi tidak ada wildcard SQL.
    let padanan = s`kandungan ilike ${`%${istilah[0]}%`}`;
    for (const t of istilah.slice(1))
      padanan = s`(${padanan} or kandungan ilike ${`%${t}%`})`;
    barisLeksikal = (await s`
      select id, kandungan, kind, created_at, tajuk, no_cebisan
      from memori_malaysia
      ${tapis}
      and (${padanan})
      order by id
      limit ${KANDIDAT_LEKSIKAL}`) as BarisDb[];
  }

  // Gabungkan kandidat (dedup ikut id; vektor dahulu supaya jaraknya dipelihara).
  const kandidat = new Map<
    string,
    BarisDb & { jarak: number | null; rrf: number; bm25: number }
  >();
  const urutanVektor: string[] = [];
  for (const b of barisVektor) {
    const kunci = String(b.id);
    urutanVektor.push(kunci);
    kandidat.set(kunci, {
      ...b,
      jarak: typeof b.jarak === "number" ? b.jarak : Number(b.jarak ?? 1),
      rrf: 0,
      bm25: 0,
    });
  }
  // Kandidat leksikal ditambah ke gabungan; rank leksikal datang daripada
  // susunan BM25 (urutanBm25 di bawah), bukan daripada susunan SQL ILIKE.
  for (const b of barisLeksikal) {
    const kunci = String(b.id);
    if (!kandidat.has(kunci))
      kandidat.set(kunci, { ...b, jarak: null, rrf: 0, bm25: 0 });
  }

  const skorBm25 = bm25Skor(
    istilah,
    [...kandidat.values()].map((k) => ({ id: String(k.id), kandungan: k.kandungan })),
  );
  for (const [id, skor] of skorBm25) {
    const k = kandidat.get(id);
    if (k) k.bm25 = skor;
  }
  const urutanBm25 = [...skorBm25.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  for (const [id, skor] of rrfSkor(urutanVektor, urutanBm25)) {
    const k = kandidat.get(id);
    if (k) k.rrf = skor;
  }

  const baris = [...kandidat.values()]
    .sort((a, b) => b.rrf - a.rrf || (a.jarak ?? 2) - (b.jarak ?? 2))
    .slice(0, had);
  return { baris, model };
}

/** Tafsir medan tarikh opsyen (ISO 8601); undefined = tidak diberi. */
function parseTarikh(
  iso: string | undefined,
  namaMedan: string,
): { tarikh?: Date; ralat?: string } {
  if (iso === undefined || iso.trim() === "") return {};
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()))
    return {
      ralat: `${namaMedan} bukan tarikh ISO 8601 yang sah: "${iso}".`,
    };
  return { tarikh: d };
}

function ralatKeObject(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---------------------------------------------------------------- Pelayan MCP
function buildMemoriServer(): McpServer {
  const server = new McpServer({ name: "memori", version: "1.1.0" });

  // 1. simpan_memori
  server.registerTool(
    "simpan_memori",
    {
      title: "Simpan memori jangka panjang",
      description:
        "Simpan satu fakta, keutamaan atau peristiwa ke memori jangka panjang (pgvector) supaya " +
        "boleh diingati merentas thread: 'perusahaan saya bernama X', 'pelanggan encik Ali suka Y', " +
        "'kami berjanji hantar sampel Jumaat'. Guna SELEPAS pengguna memberi maklumat tentang dirinya, " +
        "perniagaannya, keputusannya atau janji anda. Jangan simpan kenyataan sementara yang luput hari ini. " +
        "Untuk dokumen panjang, guna simpan_dokumen.",
      inputSchema: {
        kandungan: z
          .string()
          .min(1)
          .describe(
            "Teks memori, satu fakta lengkap dalam satu ayat. Contoh: 'Perusahaan pengguna bernama Kota Kinabalu Trading.'",
          ),
        kind: z
          .enum(["fakta", "keutamaan", "peristiwa"])
          .optional()
          .describe(
            "Jenis memori: fakta (maklumat tetap), keutamaan (apa pengguna mahu), peristiwa (janji/temu janji). Default fakta.",
          ),
        valid_at: z
          .string()
          .optional()
          .describe(
            "Opsyen: momen fakta ini mula/akan menjadi benar (ISO 8601, cth. '2026-01-15T09:00:00Z'). " +
              "Default masa sekarang. Guna untuk menanda fakta masa depan atau mengundur fakta lampau.",
          ),
        agent_id: z
          .string()
          .optional()
          .describe(
            "Id Bot yang memiliki memori ini (kosongkan jika tidak pasti).",
          ),
        thread_id: z
          .string()
          .optional()
          .describe("Id thread tempat memori ini lahir (untuk jejak asal)."),
      },
    },
    async ({
      kandungan,
      kind,
      valid_at,
      agent_id,
      thread_id,
    }: {
      kandungan: string;
      kind?: Kind;
      valid_at?: string;
      agent_id?: string;
      thread_id?: string;
    }) => {
      const teks = kandungan.trim();
      if (!teks)
        return {
          content: [
            { type: "text" as const, text: "kandungan tidak boleh kosong." },
          ],
        };
      const tarikh = parseTarikh(valid_at, "valid_at");
      if (tarikh.ralat)
        return {
          content: [{ type: "text" as const, text: tarikh.ralat }],
        };
      const jenis = KINDS.includes(kind as Kind) ? (kind as Kind) : "fakta";
      try {
        const { vec, model } = await embed(teks, "passage");
        await pastikanSkema();
        const s = db();
        const baris = await s`
          insert into memori_malaysia (thread_id, agent_id, kind, kandungan, embedding, model, valid_at)
          values (${thread_id ?? null}, ${agent_id ?? null}, ${jenis}, ${teks}, ${JSON.stringify(vec)}::vector, ${model}, ${tarikh.tarikh ?? new Date()})
          returning id`;
        return {
          content: [
            {
              type: "text" as const,
              text: `Memori disimpan: #${baris[0].id} [${jenis}] (model: ${model}).\n"${teks}"`,
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Gagal simpan memori: ${ralatKeObject(e)}`,
            },
          ],
        };
      }
    },
  );

  // 2. cari_memori
  server.registerTool(
    "cari_memori",
    {
      title: "Cari memori tersimpan",
      description:
        "Cari memori jangka panjang yang tersimpan dengan carian hibrid RRF: kedudukan vektor (cosine " +
        "pgvector, 50 kandidat teratas) digabungkan dengan kedudukan leksikal BM25 (k1=1.2, b=0.75 ke atas " +
        "kandidat gabungan) - skor = 1/(60+rank_vektor) + 1/(60+rank_leksikal). Guna bila pengguna bertanya " +
        "apa yang anda sudah tahu tentang dirinya/perniagaannya, atau sebelum menjawab soalan yang jawapannya " +
        "mungkin pernah diberi: 'apa nama perusahaan saya?', 'apa janji saya minggu lepas?'. Medan valid_at " +
        "opsyen memberi semantik 'sebagaimana pada masa itu' (memori yang sudah sah dan belum dilupakan semasa itu).",
      inputSchema: {
        pertanyaan: z
          .string()
          .min(1)
          .describe(
            "Soalan/frasa carian dalam apa jua bahasa, cth. 'nama perusahaan saya'.",
          ),
        had: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Bilangan memori dipulangkan (default 5)."),
        valid_at: z
          .string()
          .optional()
          .describe(
            "Opsyen: momen masa (ISO 8601, cth. '2026-01-15T09:00:00Z') untuk pertanyaan temporal - " +
              "hanya memori yang sudah sah (valid_at <= momen) dan belum dilupakan pada momen itu " +
              "(superseded_at null atau selepas momen) dipulangkan. Tiada = masa sekarang.",
          ),
        agent_id: z
          .string()
          .optional()
          .describe(
            "Batas kepada memori Bot ini (memori tanpa agent_id turut disertakan).",
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({
      pertanyaan,
      had,
      valid_at,
      agent_id,
    }: {
      pertanyaan: string;
      had?: number;
      valid_at?: string;
      agent_id?: string;
    }) => {
      const teks = pertanyaan.trim();
      if (!teks)
        return {
          content: [
            { type: "text" as const, text: "pertanyaan tidak boleh kosong." },
          ],
        };
      const tarikh = parseTarikh(valid_at, "valid_at");
      if (tarikh.ralat)
        return {
          content: [{ type: "text" as const, text: tarikh.ralat }],
        };
      const hadSelamat = Math.max(
        1,
        Math.min(50, Math.trunc(had ?? HAD_LALAI)),
      );
      try {
        const { baris, model } = await carianHibrid("memori", teks, hadSelamat, {
          agentId: agent_id,
          cutoff: tarikh.tarikh ?? new Date(),
        });
        if (baris.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Tiada memori ditemui untuk "${teks}" (model pertanyaan: ${model}).`,
              },
            ],
          };
        }
        const amaran =
          model === "hash-lokal"
            ? "\n\nNOTA: embedding fallback hash tempatan sedang digunakan (API NVIDIA tidak sampai) - susunan mungkin kurang tepat."
            : "";
        return {
          content: [
            {
              type: "text" as const,
              text:
                `${baris.length} memori terbaik untuk "${teks}" (model: ${model}, hibrid RRF vektor+BM25):\n\n` +
                baris.map((b) => barisMemori(b)).join("\n") +
                amaran,
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Gagal cari memori: ${ralatKeObject(e)}`,
            },
          ],
        };
      }
    },
  );

  // 3. lupa_memori (padam lembut)
  server.registerTool(
    "lupa_memori",
    {
      title: "Lupa satu memori",
      description:
        "Lupakan satu memori jangka panjang mengikut id (id diterima daripada cari_memori). Padam lembut: " +
        "superseded_at ditetapkan, jadi memori itu tidak lagi dipulangkan oleh carian dari sekarang, tetapi " +
        "kekal dalam jadual - pertanyaan 'as-of' masa lampau masih nampaknya. Guna bila memori salah, lapuk, " +
        "atau pengguna minta ia dilupakan. Satu id setiap panggilan.",
      inputSchema: {
        id: z
          .number()
          .int()
          .positive()
          .describe(
            "Id memori yang hendak dilupakan (daripada cari_memori, cth. 42).",
          ),
      },
    },
    async ({ id }: { id: number }) => {
      const idSelamat = Math.trunc(id);
      if (!Number.isFinite(idSelamat) || idSelamat <= 0) {
        return {
          content: [
            { type: "text" as const, text: "id mesti integer positif." },
          ],
        };
      }
      try {
        await pastikanSkema();
        const s = db();
        const baris = await s`
          update memori_malaysia set superseded_at = now()
          where id = ${idSelamat} and superseded_at is null
          returning id`;
        if (baris.length === 0) {
          const dahAda = await s`
            select id from memori_malaysia
            where id = ${idSelamat} and superseded_at is not null`;
          return {
            content: [
              {
                type: "text" as const,
                text: dahAda.length
                  ? `Memori #${idSelamat} sudah dilupakan sebelum ini.`
                  : `Memori #${idSelamat} tidak ditemui - tiada yang dilupakan.`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Memori #${baris[0].id} dilupakan (superseded_at ditetapkan - carian tidak akan memulangkannya lagi).`,
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Gagal lupa memori: ${ralatKeObject(e)}`,
            },
          ],
        };
      }
    },
  );

  // 4. bilang_memori
  server.registerTool(
    "bilang_memori",
    {
      title: "Kiraan memori tersimpan",
      description:
        "Kira berapa memori jangka panjang yang hidup (belum dilupakan), dipecahkan mengikut kind " +
        "(fakta/keutamaan/peristiwa), beserta kiraan cebisan dokumen dan kiraan yang sudah dilupakan. " +
        "Guna untuk menyemak kesihatan memori atau menjawab 'apa yang anda ingat tentang saya?'.",
      inputSchema: {
        agent_id: z
          .string()
          .optional()
          .describe(
            "Batas kepada memori Bot ini (memori tanpa agent_id turut dikira).",
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ agent_id }: { agent_id?: string }) => {
      try {
        await pastikanSkema();
        const s = db();
        // Syarat agen sentiasa ada supaya `where ...` sah walau agent_id tiada.
        const agensi = agent_id
          ? s`(agent_id = ${agent_id} or agent_id is null)`
          : s`true`;
        const hidup = await s`
          select kind, count(*)::int as bilangan
          from memori_malaysia
          where ${agensi} and superseded_at is null
            and (kind is null or kind not in ('doc', 'doc_chunk'))
          group by kind
          order by bilangan desc`;
        const dokumen = await s`
          select count(*)::int as cebisan, count(distinct tajuk)::int as tajuk
          from memori_malaysia
          where ${agensi} and superseded_at is null and kind = 'doc_chunk'`;
        const lupa = await s`
          select count(*)::int as bilangan
          from memori_malaysia
          where ${agensi} and superseded_at is not null`;
        const jumlah = hidup.reduce((n, b) => n + b.bilangan, 0);
        const cebisan = dokumen[0]?.cebisan ?? 0;
        const dilupakan = lupa[0]?.bilangan ?? 0;
        if (jumlah === 0 && cebisan === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  dilupakan > 0
                    ? `Memori kosong (yang hidup) - ${dilupakan} rekod sudah dilupakan.`
                    : "Memori kosong - belum ada apa-apa disimpan.",
              },
            ],
          };
        }
        const barisKind = hidup
          .map((b) => `- ${b.kind ?? "(tiada kind)"}: ${b.bilangan}`)
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Jumlah memori hidup: ${jumlah}\n` +
                (barisKind ? `${barisKind}\n` : "") +
                `Cebisan dokumen hidup: ${cebisan}` +
                (dokumen[0]?.tajuk ? ` (${dokumen[0].tajuk} dokumen)` : "") +
                (dilupakan > 0 ? `\nDilupakan (superseded): ${dilupakan}` : ""),
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Gagal bilang memori: ${ralatKeObject(e)}`,
            },
          ],
        };
      }
    },
  );

  // 5. simpan_dokumen (RAG)
  server.registerTool(
    "simpan_dokumen",
    {
      title: "Simpan dokumen ke memori RAG",
      description:
        "Simpan satu dokumen untuk carian RAG: teks dibahagikan kepada cebisan ~700-900 aksara pada " +
        "sempadan perenggan, setiap cebisan di-embed dan disimpan sebagai kind='doc_chunk' dengan tajuk " +
        "dokumen, nombor cebisan dan valid_at semasa. Guna untuk bahan rujukan panjang (polisi, SOP, " +
        "laporan, garis panduan) supaya cari_dokumen boleh mendapatkan cebisan relevan nanti. Untuk fakta " +
        "ringkas satu ayat, guna simpan_memori.",
      inputSchema: {
        tajuk: z
          .string()
          .min(1)
          .describe(
            "Tajuk dokumen, unik untuk dokumen ini - padam_dokumen gunanya untuk membuang kesemuanya. Cth. 'SOP Penghantaran Sampel'.",
          ),
        teks: z
          .string()
          .min(1)
          .describe(
            "Kandungan dokumen penuh (plaintext). Perenggan dipisahkan dengan baris kosong supaya cebisan mengekori sempadan semula jadi.",
          ),
        agent_id: z
          .string()
          .optional()
          .describe(
            "Id Bot yang memiliki dokumen ini (kosongkan jika tidak pasti).",
          ),
        thread_id: z
          .string()
          .optional()
          .describe("Id thread tempat dokumen ini diberi (untuk jejak asal)."),
      },
    },
    async ({
      tajuk,
      teks,
      agent_id,
      thread_id,
    }: {
      tajuk: string;
      teks: string;
      agent_id?: string;
      thread_id?: string;
    }) => {
      const judul = tajuk.trim();
      const badan = teks.trim();
      if (!judul || !badan)
        return {
          content: [
            {
              type: "text" as const,
              text: "tajuk dan teks tidak boleh kosong.",
            },
          ],
        };
      let cebisan = pecahCebisan(badan);
      let notaPotong = "";
      if (cebisan.length > MAKS_CEBISAN_DOKUMEN) {
        notaPotong =
          `\nNOTA: dokumen menghasilkan ${cebisan.length} cebisan - hanya ${MAKS_CEBISAN_DOKUMEN} pertama disimpan.`;
        cebisan = cebisan.slice(0, MAKS_CEBISAN_DOKUMEN);
      }
      try {
        await pastikanSkema();
        const s = db();
        const idSimpan: Array<number | string> = [];
        let model = "";
        for (let i = 0; i < cebisan.length; i++) {
          const { vec, model: m } = await embed(cebisan[i], "passage");
          model = m;
          const baris = await s`
            insert into memori_malaysia
              (thread_id, agent_id, kind, kandungan, tajuk, no_cebisan, embedding, model, valid_at)
            values
              (${thread_id ?? null}, ${agent_id ?? null}, 'doc_chunk', ${cebisan[i]},
               ${judul}, ${i + 1}, ${JSON.stringify(vec)}::vector, ${m}, now())
            returning id`;
          idSimpan.push(baris[0].id);
        }
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Dokumen «${judul}» disimpan: ${idSimpan.length} cebisan ` +
                `(#${idSimpan[0]} - #${idSimpan[idSimpan.length - 1]}, model: ${model}). ` +
                `Guna cari_dokumen untuk mendapatkan cebisan, padam_dokumen (tajuk "${judul}") untuk membuang.` +
                notaPotong,
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Gagal simpan dokumen: ${ralatKeObject(e)}`,
            },
          ],
        };
      }
    },
  );

  // 6. cari_dokumen (RAG)
  server.registerTool(
    "cari_dokumen",
    {
      title: "Cari cebisan dokumen (RAG)",
      description:
        "Cari cebisan dokumen tersimpan (kind='doc_chunk') dengan carian hibrid sama seperti cari_memori: " +
        "vektor cosine + BM25, digabungkan dengan RRF. Pulangkan cebisan terbaik bersama tajuk dokumen dan " +
        "nombor cebisan - guna cebisan itu sebagai konteks untuk menjawab, dan sebut sumbernya (tajuk dokumen). " +
        "Hanya cebisan dokumen hidup (belum dilupakan) dikira.",
      inputSchema: {
        pertanyaan: z
          .string()
          .min(1)
          .describe(
            "Soalan/frasa carian dalam apa jua bahasa, cth. 'prosedur penghantaran sampel'.",
          ),
        had: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Bilangan cebisan dipulangkan (default 5)."),
        agent_id: z
          .string()
          .optional()
          .describe(
            "Batas kepada dokumen Bot ini (dokumen tanpa agent_id turut disertakan).",
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({
      pertanyaan,
      had,
      agent_id,
    }: {
      pertanyaan: string;
      had?: number;
      agent_id?: string;
    }) => {
      const teks = pertanyaan.trim();
      if (!teks)
        return {
          content: [
            { type: "text" as const, text: "pertanyaan tidak boleh kosong." },
          ],
        };
      const hadSelamat = Math.max(
        1,
        Math.min(50, Math.trunc(had ?? HAD_LALAI)),
      );
      try {
        const { baris, model } = await carianHibrid("dokumen", teks, hadSelamat, {
          agentId: agent_id,
          cutoff: new Date(),
        });
        if (baris.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Tiada cebisan dokumen ditemui untuk "${teks}" (model pertanyaan: ${model}).`,
              },
            ],
          };
        }
        const amaran =
          model === "hash-lokal"
            ? "\n\nNOTA: embedding fallback hash tempatan sedang digunakan (API NVIDIA tidak sampai) - susunan mungkin kurang tepat."
            : "";
        return {
          content: [
            {
              type: "text" as const,
              text:
                `${baris.length} cebisan dokumen terbaik untuk "${teks}" (model: ${model}, hibrid RRF vektor+BM25):\n\n` +
                baris.map((b) => barisMemori(b)).join("\n") +
                amaran,
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Gagal cari dokumen: ${ralatKeObject(e)}`,
            },
          ],
        };
      }
    },
  );

  // 7. padam_dokumen
  server.registerTool(
    "padam_dokumen",
    {
      title: "Padam dokumen daripada memori",
      description:
        "Lupakan semua cebisan sesuatu dokumen mengikut tajuk (tajuk sebagaimana diberi kepada simpan_dokumen; " +
        "padanan tidak kira huruf besar/kecil). Padam lembut: superseded_at ditetapkan pada semua cebisan, jadi " +
        "cari_dokumen tidak memulangkannya lagi. Guna bila dokumen lapuk, digantikan versi baharu, atau salah.",
      inputSchema: {
        tajuk: z
          .string()
          .min(1)
          .describe(
            "Tajuk dokumen yang hendak dipadam (sebagaimana diberi kepada simpan_dokumen).",
          ),
      },
    },
    async ({ tajuk }: { tajuk: string }) => {
      const judul = tajuk.trim();
      if (!judul)
        return {
          content: [{ type: "text" as const, text: "tajuk tidak boleh kosong." }],
        };
      try {
        await pastikanSkema();
        const s = db();
        const baris = await s`
          update memori_malaysia set superseded_at = now()
          where kind = 'doc_chunk' and superseded_at is null
            and lower(tajuk) = lower(${judul})
          returning id`;
        if (baris.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Tiada cebisan dokumen «${judul}» yang hidup - tiada yang dipadam.`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Dokumen «${judul}» dilupakan: ${baris.length} cebisan ditanda superseded_at.`,
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Gagal padam dokumen: ${ralatKeObject(e)}`,
            },
          ],
        };
      }
    },
  );

  return server;
}

// ------------------------------------------------------------- Pecahan cebisan
/** Perenggan lebih panjang daripada siling dipotong pada jarak aksara terdekat. */
function potongPanjang(perenggan: string, maksimum: number): string[] {
  const cebisan: string[] = [];
  let baki = perenggan;
  while (baki.length > maksimum) {
    let potong = baki.lastIndexOf(" ", maksimum);
    if (potong < maksimum * 0.5) potong = maksimum;
    cebisan.push(baki.slice(0, potong).trim());
    baki = baki.slice(potong).trim();
  }
  if (baki) cebisan.push(baki);
  return cebisan;
}

/**
 * Pecah teks dokumen kepada cebisan ~CEBISAN_SASARAN-CEBISAN_MAKS aksara pada sempadan
 * perenggan: perenggan ditimbun sehingga sasaran; perenggan yang menolak cebisan melebihi
 * siling memulakan cebisan baharu; perenggan tunggal yang lebih panjang daripada siling
 * dipotong keras pada sempadan perkataan. Ekor yang terlalu pendek digabungkan semula.
 */
function pecahCebisan(teks: string): string[] {
  const perenggan = teks
    .split(/\n{2,}/)
    .flatMap((p) => (p.length > CEBISAN_MAKS ? potongPanjang(p, CEBISAN_MAKS) : [p.trim()]))
    .filter((p) => p.length > 0);
  const hasil: string[] = [];
  let semasa = "";
  for (const p of perenggan) {
    if (!semasa) {
      semasa = p;
      continue;
    }
    if (semasa.length < CEBISAN_SASARAN && semasa.length + p.length + 2 <= CEBISAN_MAKS) {
      semasa += `\n\n${p}`;
    } else {
      hasil.push(semasa);
      semasa = p;
    }
  }
  if (semasa) hasil.push(semasa);
  // Ekor terlalu pendek: gabungkan cebisan akhir ke sebelumnya jika muat dalam siling.
  if (hasil.length > 1) {
    const akhir = hasil[hasil.length - 1];
    const sebelum = hasil[hasil.length - 2];
    if (
      akhir.length < CEBISAN_EKOR_MIN &&
      sebelum.length + akhir.length + 2 <= CEBISAN_MAKS
    ) {
      hasil.pop();
      hasil[hasil.length - 1] = `${sebelum}\n\n${akhir}`;
    }
  }
  return hasil;
}

// ---------------------------------------------------------------- HTTP
const app = express();
app.use(express.json({ limit: "1mb" }));

const stateless = {
  sessionIdGenerator: undefined,
  enableJsonResponse: true,
} as const;

app.post("/mcp", async (req, res) => {
  try {
    const httpTransport = new StreamableHTTPServerTransport(stateless as never);
    const mcpServer = buildMemoriServer();
    await mcpServer.connect(httpTransport);
    res.on("close", () => {
      void httpTransport.close();
      void mcpServer.close();
    });
    await httpTransport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Ralat /mcp:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Ralat dalaman" },
        id: null,
      });
    }
  }
});

// Mod tanpa-keadaan tanpa aliran SSE: GET/DELETE ditolak dengan jelas.
app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Kaedah tidak dibenarkan" },
    id: null,
  });
});
app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Kaedah tidak dibenarkan" },
    id: null,
  });
});

app.get("/health", (_req, res) => {
  res.json({
    service: "memori-mcp",
    tools: 7,
    status: "ok",
    model: EMBED_MODEL,
    dim: EMBED_DIM,
    db: !!DB_URL,
  });
});

// Loopback sahaja - sebab yang sama dengan pelayan MCP malaysia (lihat server.ts di sana):
// Render lalukan URL awam ke port pertama yang dibuka, dan pelayan MCP ialah komponen dalaman
// yang diakses API/bootstrap melalui 127.0.0.1. Satu-satunya port Render patut nampak ialah API.
app.listen(PORT, "127.0.0.1", () => {
  console.info(
    JSON.stringify({
      type: "memori-mcp",
      url: `http://127.0.0.1:${PORT}/mcp`,
      tools: 7,
      model: EMBED_MODEL,
      dim: EMBED_DIM,
      db: !!DB_URL,
    }),
  );
});
