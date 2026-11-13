/**
 * Bootstrap pakej Malaysia: daftar pelayan MCP "malaysia" dan beri geran alat kepada
 * semua Bot dalam deployment ini.
 *
 * Perkara yang dilakukan (mengikut saluran rasmi OpenBot, bukan tulis terus DB):
 *   1. POST /api/plugins/servers  {key: "malaysia"}     - tambah entri katalog first-party;
 *                                                         OpenBot memanggil tools/list semasa
 *                                                         menambah, jadi 13 alat ditemui serta-merta.
 *   2. GET  /api/agents                                 - senarai Bot sedia ada.
 *   3. POST /api/plugins/grants {kind:"mcp", ref, agentId} untuk setiap alat x setiap Bot.
 *
 * Idempoten: pelayan yang sudah ditambah dan geran yang sudah ada dilepaskan dengan senyap.
 * Jalankan dari akar repositori:  bun examples/malaysia/bootstrap.ts
 */
const SERVER_URL =
  process.env.OPENBOOT_SERVER_URL?.replace(/\/$/, "") || "http://127.0.0.1:3001";

/** Nama alat pelayan "malaysia" (sumber kebenaran: /health dan tools/list pelayan itu). */
const ALAT_MALAYSIA = [
  "carta_organisasi_persekutuan",
  "senarai_kementerian",
  "senarai_negeri",
  "gred_perkhidmatan",
  "struktur_organisasi_templat",
  "carian_dataset",
  "ambil_dataset",
  "analisis_teks_bm",
  "penukar_unit",
  "mermaid_carta",
  "templat_minit_mesyuarat",
  "kalendar_cuti",
  "glosari_kerajaan",
  // Kit F&B (dilancarkan dengan FNB-PLAYBOOK)
  "scenari_fnb",
  "kalkulator_harga_jual",
  "kira_bep",
  "pelan_kandungan_fnb",
  "jawab_ulasan",
] as const;

async function api(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

function rawak(message: string, body: unknown): string {
  const detail = typeof body === "object" && body !== null ? JSON.stringify(body) : "";
  return detail ? `${message}: ${detail}` : message;
}

async function main(): Promise<void> {
  const kesihatan = await fetch("http://127.0.0.1:4210/health").catch(() => null);
  if (!kesihatan?.ok) {
    console.error(
      "Pelayan MCP malaysia tidak berjalan di http://127.0.0.1:4210. Mulakan dulu:",
      "cd /home/z/my-project/mini-services/malaysia-mcp && bun run dev",
    );
    process.exit(1);
  }
  console.info("[1/3] Pelayan MCP malaysia di kesihatan baik:", await kesihatan.json());

  // 1. Tambah pelayan dari katalog (abaikan ralat "sudah ditambah").
  const tambah = await api("/api/plugins/servers", {
    method: "POST",
    body: JSON.stringify({ key: "malaysia" }),
  });
  if (tambah.status === 200 || tambah.status === 409) {
    console.info(
      tambah.status === 200
        ? `[2/3] Pelayan malaysia ditambah dan ${ALAT_MALAYSIA.length} alat disasarkan.`
        : `[2/3] Pelayan malaysia sudah sedia (dilepaskan) - ${ALAT_MALAYSIA.length} alat disasarkan.`,
    );
  } else {
    console.error(rawak(`[2/3] Gagal tambah pelayan (HTTP ${tambah.status})`, tambah.body));
    process.exit(1);
  }

  // 2. Senarai Bot sedia ada.
  const senarai = await api("/api/agents");
  if (senarai.status !== 200) {
    console.error(rawak(`Gagal senaraikan Bot (HTTP ${senarai.status})`, senarai.body));
    process.exit(1);
  }
  const badan = senarai.body as { agents?: Array<{ id?: string; profile?: { name?: string } }> };
  const bot = (badan.agents ?? [])
    .map((a) => ({ id: String(a.id ?? ""), nama: a.profile?.name ?? a.id ?? "?" }))
    .filter((a) => a.id !== "");
  if (bot.length === 0) {
    console.error("Tiada Bot dalam deployment ini - restart pelayan supaya pakej tenant disegerak dulu.");
    process.exit(1);
  }
  console.info(`[2/3] ${bot.length} Bot ditemui:`, bot.map((b) => `${b.nama} (${b.id.slice(0, 8)}...)`).join(", "));

  // 3. Geran alat: setiap alat "malaysia" untuk setiap Bot.
  let baharu = 0;
  let sudah = 0;
  let gagal = 0;
  for (const b of bot) {
    for (const alat of ALAT_MALAYSIA) {
      const geran = await api("/api/plugins/grants", {
        method: "POST",
        body: JSON.stringify({ kind: "mcp", ref: `malaysia/${alat}`, agentId: b.id }),
      });
      if (geran.status === 200) baharu += 1;
      else if (geran.status === 409 || geran.status === 400) sudah += 1;
      else {
        gagal += 1;
        console.error(rawak(`Geran gagal ${b.nama}/${alat} (HTTP ${geran.status})`, geran.body));
      }
    }
  }
  console.info(
    `[3/3] Geran: ${baharu} baharu, ${sudah} sudah sedia/dilepaskan, ${gagal} gagal ` +
      `(sasaran: ${bot.length} Bot x ${ALAT_MALAYSIA.length} alat = ${bot.length * ALAT_MALAYSIA.length}).`,
  );
  if (gagal > 0) process.exit(1);
  console.info("SELESAI. OpenBot Malaysia sedia berperang.");
}

await main();
