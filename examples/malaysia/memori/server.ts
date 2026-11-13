/**
 * Pelayan MCP "memori" - memori jangka panjang untuk OpenBot (pgvector di Supabase).
 *
 * StreamableHTTP (MCP rasmi) pada port 4211, endpoint /mcp, mod tanpa-keadaan (stateless)
 * dengan jawapan JSON - cermin kepada pelayan "malaysia" (port 4210). Setiap permintaan
 * diberi satu McpServer baharu, jadi tiada sesi yang dikongsi antara Bot.
 *
 * Simpanan: jadual `memori_malaysia` pada DATABASE_URL (Supabase, sambungan pooler,
 * max=2 supaya kolam kecil tidak menelan kuota sambungan pelayan utama). Vektor
 * disimpan sebagai pgvector `vector(1024)` dengan indeks HNSW (vector_cosine_ops).
 *
 * Embedding: API NVIDIA yang sama dengan pelayan utama (OPENAI_BASE_URL/OPENAI_API_KEY,
 * atau MEMORI_EMBED_BASE_URL/MEMORI_EMBED_API_KEY). Model lalai nvidia/nemotron-3.5-embed-1b
 * (asimetrik - input_type "query"/"passage" wajib; dimensions=1024 kerana pemangkasan
 * Matryoshka, dan HNSW pgvector menolak lajur melebihi 2000 dim). Jika tiada kunci atau
 * API gagal, embedding hash tempatan yang deterministik (bag-of-token-hashes, L2) digunakan
 * - jarak antara model berbeza tidak bermakna, jadi nama model dipulangkan bersama hasil.
 *
 * Alat yang ditawarkan:
 *  - simpan_memori   embed kandungan + INSERT, pulangkan id
 *  - cari_memori     embed pertanyaan + cari cosine (jarak `<=>`), pulangkan terdekat
 *  - lupa_memori     DELETE mengikut id
 *  - bilang_memori   kiraan memori per kind
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

// ---------------------------------------------------------------- Alat bantuan
function barisMemori(b: {
  id: number | string;
  kandungan: string;
  kind?: string | null;
  jarak?: number | null;
  model?: string | null;
  created_at?: Date | string | null;
}): string {
  const masa = b.created_at
    ? new Date(b.created_at).toISOString().replace("T", " ").slice(0, 16) +
      " UTC"
    : "";
  const jarak =
    typeof b.jarak === "number" ? ` | jarak ${b.jarak.toFixed(4)}` : "";
  const kind = b.kind ? ` [${b.kind}]` : "";
  return `- #${b.id}${kind}${jarak}${masa ? ` | ${masa}` : ""}\n  ${b.kandungan}`;
}

function ralatKeObject(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---------------------------------------------------------------- Pelayan MCP
function buildMemoriServer(): McpServer {
  const server = new McpServer({ name: "memori", version: "1.0.0" });

  // 1. simpan_memori
  server.registerTool(
    "simpan_memori",
    {
      title: "Simpan memori jangka panjang",
      description:
        "Simpan satu fakta, keutamaan atau peristiwa ke memori jangka panjang (pgvector) supaya " +
        "boleh diingati merentas thread: 'perusahaan saya bernama X', 'pelanggan encik Ali suka Y', " +
        "'kami berjanji hantar sampel Jumaat'. Guna SELEPAS pengguna memberi maklumat tentang dirinya, " +
        "perniagaannya, keputusannya atau janji anda. Jangan simpan kenyataan sementara yang luput hari ini.",
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
      agent_id,
      thread_id,
    }: {
      kandungan: string;
      kind?: Kind;
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
      const jenis = KINDS.includes(kind as Kind) ? (kind as Kind) : "fakta";
      try {
        const { vec, model } = await embed(teks, "passage");
        const s = db();
        const baris = await s`
          insert into memori_malaysia (thread_id, agent_id, kind, kandungan, embedding, model)
          values (${thread_id ?? null}, ${agent_id ?? null}, ${jenis}, ${teks}, ${JSON.stringify(vec)}::vector, ${model})
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
        "Cari memori jangka panjang yang tersimpan dengan carian makna (cosine, pgvector HNSW). " +
        "Guna bila pengguna bertanya apa yang anda sudah tahu tentang dirinya/perniagaannya, atau " +
        "sebelum menjawab soalan yang jawapannya mungkin pernah diberi: 'apa nama perusahaan saya?', " +
        "'apa janji saya minggu lepas?'. Pulangkan memori terdekat dengan nilai jarak (makin kecil makin dekat).",
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
        const { vec, model } = await embed(teks, "query");
        const s = db();
        const syarat = agent_id
          ? s`where agent_id = ${agent_id} or agent_id is null`
          : s``;
        const baris = await s`
          select id, kandungan, kind, model, created_at,
                 (embedding <=> ${JSON.stringify(vec)}::vector) as jarak
          from memori_malaysia
          ${syarat}
          order by embedding <=> ${JSON.stringify(vec)}::vector
          limit ${hadSelamat}`;
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
                `${baris.length} memori terdekat untuk "${teks}" (model: ${model}):\n\n` +
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

  // 3. lupa_memori
  server.registerTool(
    "lupa_memori",
    {
      title: "Lupa satu memori",
      description:
        "Padam satu memori jangka panjang mengikut id (id diterima daripada cari_memori). " +
        "Guna bila memori salah, lapuk, atau pengguna minta ia dilupakan. Satu id dipadam setiap panggilan.",
      inputSchema: {
        id: z
          .number()
          .int()
          .positive()
          .describe(
            "Id memori yang hendak dipadam (daripada cari_memori, cth. 42).",
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
        const s = db();
        const baris =
          await s`delete from memori_malaysia where id = ${idSelamat} returning id`;
        if (baris.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Memori #${idSelamat} tidak ditemui - tiada yang dipadam.`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Memori #${baris[0].id} dilupakan.`,
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
        "Kira berapa memori jangka panjang tersimpan, dipecahkan mengikut kind (fakta/keutamaan/peristiwa). " +
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
        const s = db();
        const syarat = agent_id
          ? s`where agent_id = ${agent_id} or agent_id is null`
          : s``;
        const baris = await s`
          select kind, count(*)::int as bilangan
          from memori_malaysia
          ${syarat}
          group by kind
          order by bilangan desc`;
        const jumlah = baris.reduce((n, b) => n + b.bilangan, 0);
        if (jumlah === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Memori kosong - belum ada apa-apa disimpan.",
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Jumlah memori: ${jumlah}\n` +
                baris
                  .map((b) => `- ${b.kind ?? "(tiada kind)"}: ${b.bilangan}`)
                  .join("\n"),
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

  return server;
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
    tools: 4,
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
      tools: 4,
      model: EMBED_MODEL,
      dim: EMBED_DIM,
      db: !!DB_URL,
    }),
  );
});
