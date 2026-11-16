/**
 * Pelayan MCP "cuaca" - Cuaca Malaysia untuk OpenBot.
 *
 * StreamableHTTP (MCP rasmi) pada port 4212, endpoint /mcp, mod tanpa-keadaan (stateless)
 * dengan jawapan JSON - sama bentuk dengan pelayan saudara "malaysia" (4210) dan "memori"
 * (4211). Semua data datang daripada Open-Meteo (https://open-meteo.com), API terbuka tanpa
 * kunci: geokod nama bandar kepada koordinat, baca cuaca semasa dan ramalan harian, dan
 * terjemah kod cuaca WMO kepada Bahasa Melayu sebelum dipulangkan kepada Bot.
 *
 * Degradasi jujur: jika Open-Meteo gagal atau had kadar tercapai, alat memulangkan mesej
 * ralat yang jujur - tiada angka cuaca direka-reka.
 *
 * Alat yang ditawarkan (semuanya baca sahaja, readOnlyHint):
 *  - cari_lokasi     carian nama bandar Malaysia (dan dunia) kepada koordinat
 *  - cuaca_semasa    cuaca semasa sesebuah lokasi, dalam Bahasa Melayu
 *  - ramalan_cuaca   ramalan harian sehingga 7 hari, dalam Bahasa Melayu
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";

const PORT = Number.parseInt(process.env.CUACA_MCP_PORT ?? "4212", 10);

/** Kod cuaca WMO (weather_code) kepada penerangan Bahasa Melayu. Kod tiada dalam senarai ini dipulangkan mentah. */
const WMO_BM: Record<number, string> = {
  0: "Langit cerah",
  1: "Amat cerah",
  2: "Sebahagian berawan",
  3: "Berawan sebahagian besar",
  45: "Kabut",
  48: "Kabut beku",
  51: "Gerimis ringan",
  53: "Gerimis sederhana",
  55: "Gerimis lebat",
  56: "Gerimis beku ringan",
  57: "Gerimis beku lebat",
  61: "Hujan ringan",
  63: "Hujan sederhana",
  65: "Hujan lebat",
  66: "Hujan beku ringan",
  67: "Hujan beku lebat",
  71: "Salji ringan",
  73: "Salji sederhana",
  75: "Salji lebat",
  77: "Butiran salji",
  80: "Hujan turun ringan",
  81: "Hujan turun sederhana",
  82: "Hujan turun lebat",
  85: "Salji hujan ringan",
  86: "Salji hujan lebat",
  95: "Ribut petir ringan atau sederhana",
  96: "Ribut petir dengan hujan batu ringan",
  99: "Ribut petir dengan hujan batu lebat",
};

function ceritaKod(code: number | undefined): string {
  if (typeof code !== "number") return "kod cuaca tidak diberi";
  return WMO_BM[code] ?? `kod cuaca WMO ${code}`;
}

async function ambil<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const body = (await res.json().catch(() => null)) as
    | (T & { error?: boolean; reason?: string })
    | null;
  if (!res.ok || !body) {
    throw new Error(`Open-Meteo menjawab ${res.status}`);
  }
  if (body.error) {
    throw new Error(
      `Open-Meteo menolak permintaan: ${body.reason ?? "tidak diketahui"}`,
    );
  }
  return body;
}

type Lokasi = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
};

async function geokod(nama: string): Promise<Lokasi> {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?count=5&language=ms&format=json&name=" +
    encodeURIComponent(nama);
  const j = await ambil<{ results?: Lokasi[] }>(url);
  const first = j.results?.[0];
  if (!first)
    throw new Error(
      `Lokasi "${nama}" tidak dijumpai dalam geokod Open-Meteo. Cuba nama bandar yang lebih umum, atau gunakan alat cari_lokasi dahulu untuk pilihan tepat.`,
    );
  return first;
}

function binaCuacaServer(): McpServer {
  const server = new McpServer({ name: "cuaca", version: "1.0.0" });

  server.registerTool(
    "cari_lokasi",
    {
      title: "Cari lokasi (geokod)",
      description:
        "Cari nama bandar/bandaraya (terutamanya Malaysia) kepada koordinat latitud-longitud yang boleh digunakan alat cuaca lain. Pulangkan sehingga 5 cadangan dengan nama, negeri/negara dan koordinat - berguna apabila nama lokasi samar (contoh 'Batu Pahat' vs 'Batu Caves').",
      inputSchema: {
        nama: z
          .string()
          .min(1)
          .describe(
            "Nama lokasi, cth. 'Kuala Lumpur', 'Ipoh', 'Kota Kinabalu'.",
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ nama }) => {
      try {
        const url =
          "https://geocoding-api.open-meteo.com/v1/search?count=5&language=ms&format=json&name=" +
          encodeURIComponent(nama);
        const j = await ambil<{ results?: Lokasi[] }>(url);
        if (!j.results?.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Tiada lokasi dijumpai untuk "${nama}". Cuba ejaan yang lebih umum.`,
              },
            ],
          };
        }
        const baris = j.results.map(
          (r, i) =>
            `${i + 1}. ${r.name}${r.admin1 ? `, ${r.admin1}` : ""}${r.country ? ` (${r.country})` : ""} - lat ${r.latitude}, lon ${r.longitude}`,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Keputusan geokod untuk "${nama}":\n${baris.join("\n")}\n\nGunakan koordinat atau nama yang tepat pada alat cuaca_semasa / ramalan_cuaca.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Geokod gagal: ${error instanceof Error ? error.message : "tidak diketahui"}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    "cuaca_semasa",
    {
      title: "Cuaca semasa",
      description:
        "Cuaca semasa sesebuah lokasi dalam Bahasa Melayu: suhu, rasa sebenar, kelembapan, angin, hujan dan keadaan langit. Beri nama bandar (cth. 'Shah Alam') - lokasi digeokod secara automatik kepada keputusan pertama yang paling hampir.",
      inputSchema: {
        lokasi: z
          .string()
          .min(1)
          .describe("Nama bandar atau lokasi, cth. 'Kuala Lumpur'."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ lokasi }) => {
      try {
        const l = await geokod(lokasi);
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${l.latitude}&longitude=${l.longitude}` +
          "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation" +
          "&timezone=Asia%2FKuala_Lumpur";
        const j = await ambil<{ current?: Record<string, number> }>(url);
        const c = j.current;
        if (!c) throw new Error("Jawapan Open-Meteo tiada bahagian 'current'.");
        const teks = [
          `Cuaca semasa ${l.name}${l.admin1 ? `, ${l.admin1}` : ""}:`,
          `- Keadaan: ${ceritaKod(c.weather_code)}`,
          `- Suhu: ${c.temperature_2m} °C (rasa sebenar ${c.apparent_temperature} °C)`,
          `- Kelembapan: ${c.relative_humidity_2m} %`,
          `- Angin: ${c.wind_speed_10m} km/j`,
          `- Hujan: ${c.precipitation} mm`,
          "",
          "Sumber: Open-Meteo (kemas kini setiap ~15 minit). Untuk amaran cuaca rasmi, rujuk MetMalaysia (met.gov.my).",
        ].join("\n");
        return { content: [{ type: "text" as const, text: teks }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Cuaca semasa gagal: ${error instanceof Error ? error.message : "tidak diketahui"}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    "ramalan_cuaca",
    {
      title: "Ramalan cuaca harian",
      description:
        "Ramalan cuaca harian sehingga 7 hari untuk sesebuah lokasi dalam Bahasa Melayu: keadaan, min/max suhu, jumlah hujan dan kebarangkalian hujan setiap hari. Berguna untuk perancangan acara luar, penghantaran dan mesyuarat tapak.",
      inputSchema: {
        lokasi: z
          .string()
          .min(1)
          .describe("Nama bandar atau lokasi, cth. 'Johor Bahru'."),
        hari: z
          .number()
          .int()
          .min(1)
          .max(7)
          .optional()
          .describe("Bilangan hari ramalan (1-7). Kosong untuk 5 hari."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ lokasi, hari }) => {
      try {
        const l = await geokod(lokasi);
        const n = Math.max(1, Math.min(7, hari ?? 5));
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${l.latitude}&longitude=${l.longitude}` +
          "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max" +
          `&timezone=Asia%2FKuala_Lumpur&forecast_days=${n}`;
        const j = await ambil<{
          daily?: Record<string, Array<number | string>>;
        }>(url);
        const d = j.daily;
        if (!d?.time?.length)
          throw new Error("Jawapan Open-Meteo tiada bahagian 'daily'.");
        const tarikh = d.time as string[];
        const baris = tarikh.map((t, i) => {
          const kod = ceritaKod(d.weather_code?.[i] as number | undefined);
          const min = d.temperature_2m_min?.[i];
          const max = d.temperature_2m_max?.[i];
          const hujan = d.precipitation_sum?.[i];
          const prob = d.precipitation_probability_max?.[i];
          return `- ${t}: ${kod} | ${min}°C hingga ${max}°C | hujan ${hujan} mm (kebarangkalian ${prob ?? "?"} %)`;
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Ramalan ${tarikh.length} hari untuk ${l.name}${l.admin1 ? `, ${l.admin1}` : ""}:\n${baris.join("\n")}\n\nSumber: Open-Meteo. Amaran ribut/limau rasmi datang dari MetMalaysia - rujuk met.gov.my untuk arahan rasmi.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Ramalan gagal: ${error instanceof Error ? error.message : "tidak diketahui"}`,
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
    const mcpServer = binaCuacaServer();
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
  res.json({ service: "cuaca-mcp", tools: 3, status: "ok" });
});

// Loopback only - sebab yang sama dengan pelayan "malaysia" (4210): Render menganggap port
// pertama yang dibuka sebagai port utama dan menyalurkan URL awam kepadanya; pelayan MCP ialah
// komponen dalam-stack yang diproksikan API dan didaftarkan bootstrap melalui 127.0.0.1.
app.listen(PORT, "127.0.0.1", () => {
  console.info(
    JSON.stringify({
      type: "cuaca-mcp",
      url: `http://127.0.0.1:${PORT}/mcp`,
      tools: 3,
    }),
  );
});
