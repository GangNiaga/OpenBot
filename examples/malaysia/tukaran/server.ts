/**
 * Pelayan MCP "tukaran" - Kadar Pertukaran Matawang untuk OpenBot.
 *
 * StreamableHTTP (MCP rasmi) pada port 4213, endpoint /mcp, mod tanpa-keadaan (stateless)
 * dengan jawapan JSON - sama bentuk dengan pelayan saudara "malaysia" (4210) dan "cuaca"
 * (4212). Semua kadar datang daripada Open Exchange Rates API yang terbuka tanpa kunci
 * (https://open.er-api.com/v6/latest/{MATAWANG}, penyedia exchangerate-api.com) yang dikemas
 * kini sekali sehari dan menyokong ~160 matawang termasuk MYR.
 *
 * Degradasi jujur: jika API gagal atau kod matawang tidak sah, alat memulangkan mesej ralat
 * yang jujur - tiada kadar direka-reka, dan tiada kadar masa-nyata yang dijanjikan (data
 * harian, jadi nyatakan tarikh kemaskini dalam jawapan).
 *
 * Alat yang ditawarkan (semuanya baca sahaja, readOnlyHint):
 *  - kadar_semasa     kadar semasa matawang asas terhadap matawang utama
 *  - tukar_matawang   tukar jumlah dari satu matawang ke satu matawang lain
 *  - senarai_matawang senarai kod matawang yang disokong
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";

const PORT = Number.parseInt(process.env.TUKARAN_MCP_PORT ?? "4213", 10);

const KOD_PATEN = /^[A-Z]{3}$/;

/** Matawang yang selalu ditunjukkan pada kadar_semasa (dengan MYR terdahulu bila asas bukan MYR). */
const KOD_UTAMA = [
  "USD",
  "EUR",
  "SGD",
  "IDR",
  "THB",
  "GBP",
  "JPY",
  "AUD",
  "CNY",
  "SAR",
] as const;

type JawapanErApi = {
  result?: string;
  base_code?: string;
  time_last_update_utc?: string;
  time_next_update_utc?: string;
  rates?: Record<string, number>;
  "error-type"?: string;
};

async function kadar(code: string): Promise<JawapanErApi> {
  const res = await fetch(`https://open.er-api.com/v6/latest/${code}`, {
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => null)) as JawapanErApi | null;
  if (!res.ok || !j) throw new Error(`open.er-api.com menjawab ${res.status}`);
  if (j.result !== "success") {
    throw new Error(
      `Kod matawang "${code}" tidak diterima oleh API (${j["error-type"] ?? "tidak diketahui"}). Gunakan alat senarai_matawang untuk kod yang sah.`,
    );
  }
  return j;
}

function binaTukaranServer(): McpServer {
  const server = new McpServer({ name: "tukaran", version: "1.0.0" });

  server.registerTool(
    "kadar_semasa",
    {
      title: "Kadar pertukaran semasa",
      description:
        "Kadar pertukaran harian bagi satu matawang asas terhadap matawang utama (USD, EUR, SGD, IDR, THB, GBP, JPY, AUD, CNY, SAR). Data dikemas kini sekali sehari oleh exchangerate-api.com - tarikh kemaskini sentiasa dinyatakan. Untuk bukan matawang ini, gunakan tukar_matawang dengan kod spesifik.",
      inputSchema: {
        dari: z
          .string()
          .default("MYR")
          .describe(
            "Kod matawang asas 3 huruf, cth. 'MYR', 'USD', 'SGD'. Kosong untuk MYR.",
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ dari }) => {
      const kod = (dari || "MYR").trim().toUpperCase();
      if (!KOD_PATEN.test(kod)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Kod "${kod}" tidak sah - gunakan 3 huruf seperti MYR atau USD.`,
            },
          ],
        };
      }
      try {
        const j = await kadar(kod);
        const rates = j.rates ?? {};
        const baris = KOD_UTAMA.filter((k) => k !== kod)
          .map((k) => `- 1 ${kod} = ${rates[k] ?? "?"} ${k}`)
          .join("\n");
        const teks = [
          `Kadar ${kod} (asas) semasa:`,
          baris,
          `- Jumlah matawang disokong: ${Object.keys(rates).length}`,
          "",
          `Kemaskini: ${j.time_last_update_utc ?? "?"} (seterusnya: ${j.time_next_update_utc ?? "?"})`,
          "Sumber: exchangerate-api.com melalui open.er-api.com - kadar harian, bukan masa-nyata. Untuk kadar rasmi BNM, rujuk bnm.gov.my.",
        ].join("\n");
        return { content: [{ type: "text" as const, text: teks }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Kadar gagal: ${error instanceof Error ? error.message : "tidak diketahui"}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    "tukar_matawang",
    {
      title: "Tukar matawang",
      description:
        "Tukar satu jumlah wang dari satu matawang ke matawang lain menggunakan kadar harian semasa (cth. 250 MYR kepada JPY). Sesuai untuk anggaran kos, bajet perjalanan dan perbandingan harga antara negara - nyatakan ia anggaran kadar harian, bukan kadar urus niaga bank.",
      inputSchema: {
        dari: z.string().describe("Kod matawang sumber 3 huruf, cth. 'MYR'."),
        ke: z.string().describe("Kod matawang sasaran 3 huruf, cth. 'JPY'."),
        jumlah: z
          .number()
          .positive()
          .describe("Jumlah wang untuk ditukar, cth. 250."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ dari, ke, jumlah }) => {
      const kodDari = dari.trim().toUpperCase();
      const kodKe = ke.trim().toUpperCase();
      if (!KOD_PATEN.test(kodDari) || !KOD_PATEN.test(kodKe)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Kod matawang mesti 3 huruf (dapat: "${kodDari}", "${kodKe}").`,
            },
          ],
        };
      }
      try {
        const j = await kadar(kodDari);
        const rate = j.rates?.[kodKe];
        if (typeof rate !== "number") {
          return {
            content: [
              {
                type: "text" as const,
                text: `Matawang "${kodKe}" tidak disokong untuk asas ${kodDari}. Gunakan alat senarai_matawang untuk kod yang sah.`,
              },
            ],
          };
        }
        const hasil = jumlah * rate;
        const teks = [
          `${jumlah.toLocaleString("ms-MY")} ${kodDari} = ${hasil.toLocaleString("ms-MY", { maximumFractionDigits: 2 })} ${kodKe}`,
          `- Kadar digunakan: 1 ${kodDari} = ${rate} ${kodKe}`,
          `- Kemaskini kadar: ${j.time_last_update_utc ?? "?"}`,
          "",
          "Ini anggaran kadar harian pasaran - kadar sebenar bank/penukar berbeza (yuran dan spread). Untuk kadar rasmi, rujuk bnm.gov.my.",
        ].join("\n");
        return { content: [{ type: "text" as const, text: teks }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Penukaran gagal: ${error instanceof Error ? error.message : "tidak diketahui"}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    "senarai_matawang",
    {
      title: "Senarai matawang disokong",
      description:
        "Senarai kod matawang 3 huruf yang disokong oleh sumber kadar (cth. MYR, USD, EUR, JPY). Gunakan dahulu jika tidak pasti sesuatu kod wujud sebelum memanggil tukar_matawang.",
      inputSchema: {
        dari: z
          .string()
          .default("MYR")
          .describe(
            "Kod matawang asas untuk memastikan senarai - kosong untuk MYR.",
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ dari }) => {
      const kod = (dari || "MYR").trim().toUpperCase();
      if (!KOD_PATEN.test(kod)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Kod "${kod}" tidak sah - gunakan 3 huruf seperti MYR.`,
            },
          ],
        };
      }
      try {
        const j = await kadar(kod);
        const kodKod = Object.keys(j.rates ?? {}).sort();
        const teks = [
          `${kodKod.length} matawang disokong (asas ${j.base_code ?? kod}):`,
          kodKod.join(", "),
        ].join("\n");
        return { content: [{ type: "text" as const, text: teks }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Senarai gagal: ${error instanceof Error ? error.message : "tidak diketahui"}`,
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
    const mcpServer = binaTukaranServer();
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
  res.json({ service: "tukaran-mcp", tools: 3, status: "ok" });
});

// Loopback only - sebab yang sama dengan pelayan "malaysia" (4210) dan "cuaca" (4212).
app.listen(PORT, "127.0.0.1", () => {
  console.info(
    JSON.stringify({
      type: "tukaran-mcp",
      url: `http://127.0.0.1:${PORT}/mcp`,
      tools: 3,
    }),
  );
});
