/**
 * Pelayan MCP "solat" - Waktu Solat Malaysia (data JAKIM) untuk OpenBot.
 *
 * StreamableHTTP (MCP rasmi) pada port 4214, endpoint /mcp, mod tanpa-keadaan (stateless)
 * dengan jawapan JSON - sama bentuk dengan pelayan saudara "malaysia" (4210), "memori"
 * (4211), "cuaca" (4212) dan "tukaran" (4213). Data datang daripada API terbuka tanpa kunci
 * api.waktusolat.app yang memuat turun jadual rasmi JAKIM (Jabatan Kemajuan Islam Malaysia)
 * bagi bulan semasa: /zones untuk senarai zon, /v2/solat/{KOD} untuk waktu sebulan.
 *
 * Degradasi jujur: jika API gagal atau kod zon tidak sah, alat memulangkan mesej ralat yang
 * jujur - tiada waktu direka-reka. Jadual rasmi setiap bulan juga diterbitkan di
 * e-solat JAKIM (www.e-solat.gov.my).
 *
 * Alat yang ditawarkan (semuanya baca sahaja, readOnlyHint):
 *  - senarai_zon_solat  senarai zon JAKIM (kod + negeri + daerah), boleh ditapis negeri
 *  - waktu_solat        waktu solat sesebuah zon pada hari tertentu (default hari ini)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";

const PORT = Number.parseInt(process.env.SOLAT_MCP_PORT ?? "4214", 10);

type Zon = { jakimCode: string; negeri: string; daerah: string };
type HariSolat = {
  day: number;
  hijri?: string;
  imsak?: number;
  fajr?: number;
  syuruk?: number;
  dhuha?: number;
  dhuhr?: number;
  asr?: number;
  maghrib?: number;
  isha?: number;
};

const MASA_BM: Array<[string, number | undefined]> = [
  ["Imsak", undefined],
  ["Subuh", undefined],
  ["Syuruk", undefined],
  ["Dhuha", undefined],
  ["Zohor", undefined],
  ["Asar", undefined],
  ["Maghrib", undefined],
  ["Isyak", undefined],
];

function masaMY(sek: number | undefined): string {
  if (typeof sek !== "number") return "(tiada)";
  const d = new Date(sek * 1000);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function tarikhMY(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function teksHari(h: HariSolat): string {
  const masa: Record<string, number | undefined> = {
    Imsak: h.imsak,
    Subuh: h.fajr,
    Syuruk: h.syuruk,
    Dhuha: h.dhuha,
    Zohor: h.dhuhr,
    Asar: h.asr,
    Maghrib: h.maghrib,
    Isyak: h.isha,
  };
  const baris = MASA_BM.map(
    ([label]) => `- ${label}: ${masaMY(masa[label])}`,
  ).join("\n");
  return `${baris}${h.hijri ? `\nTarikh Hijrah: ${h.hijri}` : ""}`;
}

async function bacaZon(): Promise<Zon[]> {
  const res = await fetch("https://api.waktusolat.app/zones", {
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => null)) as Zon[] | null;
  if (!res.ok || !Array.isArray(j))
    throw new Error(`api.waktusolat.app/zones menjawab ${res.status}`);
  return j;
}

async function bacaBulan(
  kod: string,
): Promise<{ zone?: string; prayers?: HariSolat[] }> {
  const res = await fetch(
    `https://api.waktusolat.app/v2/solat/${encodeURIComponent(kod)}`,
    {
      signal: AbortSignal.timeout(15_000),
    },
  );
  const j = (await res.json().catch(() => null)) as {
    zone?: string;
    prayers?: HariSolat[];
    error?: string;
  } | null;
  if (!res.ok || !j)
    throw new Error(
      `api.waktusolat.app menjawab ${res.status} untuk zon "${kod}"`,
    );
  return j;
}

function binaSolatServer(): McpServer {
  const server = new McpServer({ name: "solat", version: "1.0.0" });

  server.registerTool(
    "senarai_zon_solat",
    {
      title: "Senarai zon waktu solat JAKIM",
      description:
        "Senarai kod zon waktu solat JAKIM Malaysia (cth. SGR01, JHR02, WLY01) dengan negeri dan daerah. Gunakan dahulu untuk cari kod zon tepat sebelum memanggil waktu_solat - setiap negeri ada beberapa zon mengikut daerah.",
      inputSchema: {
        negeri: z
          .string()
          .optional()
          .describe(
            "Penapis negeri, cth. 'Selangor', 'Johor', 'Kuala Lumpur'. Kosong untuk semua.",
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ negeri }) => {
      try {
        const zon = await bacaZon();
        const p = negeri?.trim().toLowerCase();
        const terpilih = p
          ? zon.filter((z) => z.negeri.toLowerCase().includes(p))
          : zon;
        const baris = terpilih
          .map((z) => `- ${z.jakimCode} | ${z.negeri} | ${z.daerah}`)
          .join("\n");
        const teks = baris
          ? `${terpilih.length} zon${p ? ` untuk "${negeri}"` : ""}:\n${baris}\n\nGunakan kod (kolum pertama) pada alat waktu_solat.`
          : `Tiada zon dijumpai untuk negeri "${negeri}". Cuba nama negeri penuh, cth. 'Pulau Pinang'.`;
        return { content: [{ type: "text" as const, text: teks }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Senarai zon gagal: ${error instanceof Error ? error.message : "tidak diketahui"}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    "waktu_solat",
    {
      title: "Waktu solat sesebuah zon",
      description:
        "Waktu solat harian (Imsak, Subuh, Syuruk, Dhuha, Zohor, Asar, Maghrib, Isyak) untuk satu zon JAKIM, dalam waktu Malaysia (MYT, UTC+8). Data bulan semasa dari jadual rasmi JAKIM. Beri kod zon dari senarai_zon_solat (cth. SGR01) dan hari pilihan ('esok' atau YYYY-MM-DD).",
      inputSchema: {
        zon: z
          .string()
          .describe("Kod zon JAKIM, cth. 'SGR01', 'JHR02', 'WLY01'."),
        hari: z
          .string()
          .optional()
          .describe(
            "'esok' atau tarikh YYYY-MM-DD dalam bulan semasa. Kosong untuk hari ini.",
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ zon, hari }) => {
      const kod = zon.trim().toUpperCase();
      if (!/^[A-Z]{3}\d{2}$/.test(kod)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Kod zon "${zon}" kelihatan tidak sah (bentuk sah: 3 huruf + 2 digit, cth. SGR01). Gunakan alat senarai_zon_solat untuk cari kod yang betul.`,
            },
          ],
        };
      }
      try {
        const hariIni = new Date();
        let sasaran = hariIni;
        const p = hari?.trim().toLowerCase();
        if (p === "esok") {
          sasaran = new Date(hariIni.getTime() + 24 * 60 * 60 * 1000);
        } else if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) {
          sasaran = new Date(`${p}T12:00:00+08:00`);
        } else if (p) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Parameter hari "${hari}" tidak difahami. Guna 'esok' atau tarikh YYYY-MM-DD.`,
              },
            ],
          };
        }
        const tarikh = tarikhMY(sasaran);
        const hariTarget = Number.parseInt(tarikh.slice(8, 10), 10);
        const bulanTarget = tarikh.slice(0, 7);
        const j = await bacaBulan(kod);
        const prayers = j.prayers ?? [];
        const bulanData = prayers.length
          ? tarikhMY(
              new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                prayers[0].day,
              ).getTime(),
            ).slice(0, 7)
          : "";
        if (bulanData && bulanData !== bulanTarget) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Tarikh ${tarikh} di luar bulan semasa yang disediakan sumber (${bulanData}). Alat ini memulangkan bulan semasa sahaja - untuk bulan lain, rujuk e-solat JAKIM (www.e-solat.gov.my).`,
              },
            ],
          };
        }
        const h = prayers.find((x) => x.day === hariTarget);
        if (!h) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Tarikh ${tarikh} tidak dijumpai dalam jadual zon ${kod}. Gunakan alat senarai_zon_solat untuk sahkan kod zon.`,
              },
            ],
          };
        }
        const teks = [
          `Waktu solat zon ${kod} pada ${tarikh}:`,
          teksHari(h),
          "",
          "Sumber: jadual JAKIM melalui api.waktusolat.app (bulan semasa). Waktu mungkin berbeza beberapa minit antara sumber rasmi - sahkan dengan e-solat JAKIM untuk kegunaan rasmi.",
        ].join("\n");
        return { content: [{ type: "text" as const, text: teks }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Waktu solat gagal: ${error instanceof Error ? error.message : "tidak diketahui"}`,
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
    const mcpServer = binaSolatServer();
    await mcpServer.connect(httpTransport);
    res.on("close", () => {
      void httpTransport.close();
      void mcpServer.close();
    });
    await httpTransport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Ralat /mcp:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Ralat dalaman" },
          id: null,
        });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res
    .status(405)
    .json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Kaedah tidak dibenarkan" },
      id: null,
    });
});
app.delete("/mcp", (_req, res) => {
  res
    .status(405)
    .json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Kaedah tidak dibenarkan" },
      id: null,
    });
});

app.get("/health", (_req, res) => {
  res.json({ service: "solat-mcp", tools: 2, status: "ok" });
});

// Loopback only - sebab yang sama dengan pelayan "malaysia" (4210) dan saudaranya.
app.listen(PORT, "127.0.0.1", () => {
  console.info(
    JSON.stringify({
      type: "solat-mcp",
      url: `http://127.0.0.1:${PORT}/mcp`,
      tools: 2,
    }),
  );
});
