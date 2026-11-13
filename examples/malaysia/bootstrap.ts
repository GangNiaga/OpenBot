/**
 * Bootstrap pakej Malaysia: daftar pelayan MCP "malaysia" + "memori" dan beri geran alat
 * kepada semua Bot dalam deployment ini.
 *
 * Perkara yang dilakukan (mengikut saluran rasmi OpenBot, bukan tulis terus DB):
 *   1. Kesihatan kedua-dua pelayan MCP tempatan (4210 malaysia, 4211 memori).
 *   2. POST /api/plugins/servers  {key}                     - tambah entri katalog first-party;
 *                                                             OpenBot memanggil tools/list semasa
 *                                                             menambah, jadi alat ditemui serta-merta.
 *   3. GET  /api/agents                                     - senarai Bot sedia ada.
 *   4. POST /api/plugins/grants {kind:"mcp", ref, agentId}  untuk setiap alat x setiap Bot.
 *
 * Idempoten: pelayan yang sudah ditambah dan geran yang sudah ada dilepaskan dengan senyap.
 * Jalankan dari akar repositori:  bun examples/malaysia/bootstrap.ts
 */
const SERVER_URL =
  process.env.OPENBOOT_SERVER_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:3001";

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

/** Alat pelayan "memori" (memori jangka panjang pgvector, port 4211). */
const ALAT_MEMORI = [
  "simpan_memori",
  "cari_memori",
  "lupa_memori",
  "bilang_memori",
] as const;

/** Pelayan tempatan yang didaftar bootstrap, dengan port kesihatan dan senarai alatnya. */
const PELAYAN = [
  { key: "malaysia", port: 4210, nama: "malaysia", alat: ALAT_MALAYSIA },
  { key: "memori", port: 4211, nama: "memori", alat: ALAT_MEMORI },
] as const;

async function api(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
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
  const detail =
    typeof body === "object" && body !== null ? JSON.stringify(body) : "";
  return detail ? `${message}: ${detail}` : message;
}

async function main(): Promise<void> {
  // 1. Kesihatan kedua-dua pelayan MCP tempatan. Memori tiada = amaran, bukan maut:
  //    geran malaysia tetap berjalan dan bootstrap boleh dijalankan semula untuk memori.
  for (const p of PELAYAN) {
    const kesihatan = await fetch(`http://127.0.0.1:${p.port}/health`).catch(
      () => null,
    );
    if (!kesihatan?.ok) {
      const pesan =
        `Pelayan MCP ${p.nama} tidak berjalan di http://127.0.0.1:${p.port}. ` +
        (p.key === "memori"
          ? "But memulakannya di port 4211 (semak log but / DATABASE_URL)."
          : "Mulakan dulu: bun examples/malaysia/mcp/server.ts");
      if (p.key === "memori") {
        console.error(`[1/3] AMARAN: ${pesan}`);
        continue;
      }
      console.error(pesan);
      process.exit(1);
    }
    console.info(
      `[1/3] Pelayan MCP ${p.nama} di kesihatan baik (${p.alat.length} alat):`,
      await kesihatan.json(),
    );
  }

  // 2. Tambah kedua-dua pelayan dari katalog (abaikan ralat "sudah ditambah").
  for (const p of PELAYAN) {
    const tambah = await api("/api/plugins/servers", {
      method: "POST",
      body: JSON.stringify({ key: p.key }),
    });
    if (tambah.status === 200 || tambah.status === 409) {
      console.info(
        tambah.status === 200
          ? `[2/3] Pelayan ${p.key} ditambah dan ${p.alat.length} alat disasarkan.`
          : `[2/3] Pelayan ${p.key} sudah sedia (dilepaskan) - ${p.alat.length} alat disasarkan.`,
      );
    } else if (p.key === "memori") {
      // Katalog tanpa entri "memori" (versi lama) bukan halangan untuk malaysia.
      console.error(
        rawak(
          `[2/3] AMARAN: gagal tambah pelayan memori (HTTP ${tambah.status})`,
          tambah.body,
        ),
      );
    } else {
      console.error(
        rawak(
          `[2/3] Gagal tambah pelayan ${p.key} (HTTP ${tambah.status})`,
          tambah.body,
        ),
      );
      process.exit(1);
    }
  }

  // 3. Senarai Bot sedia ada.
  const senarai = await api("/api/agents");
  if (senarai.status !== 200) {
    console.error(
      rawak(`Gagal senaraikan Bot (HTTP ${senarai.status})`, senarai.body),
    );
    process.exit(1);
  }
  const badan = senarai.body as {
    agents?: Array<{ id?: string; profile?: { name?: string } }>;
  };
  const bot = (badan.agents ?? [])
    .map((a) => ({
      id: String(a.id ?? ""),
      nama: a.profile?.name ?? a.id ?? "?",
    }))
    .filter((a) => a.id !== "");
  if (bot.length === 0) {
    console.error(
      "Tiada Bot dalam deployment ini - restart pelayan supaya pakej tenant disegerak dulu.",
    );
    process.exit(1);
  }
  console.info(
    `[2/3] ${bot.length} Bot ditemui:`,
    bot.map((b) => `${b.nama} (${b.id.slice(0, 8)}...)`).join(", "),
  );

  // 4. Geran alat: setiap alat setiap pelayan untuk setiap Bot.
  let baharu = 0;
  let sudah = 0;
  let gagal = 0;
  for (const p of PELAYAN) {
    let perPelayan = 0;
    for (const b of bot) {
      for (const alat of p.alat) {
        const geran = await api("/api/plugins/grants", {
          method: "POST",
          body: JSON.stringify({
            kind: "mcp",
            ref: `${p.key}/${alat}`,
            agentId: b.id,
          }),
        });
        if (geran.status === 200) baharu += 1;
        else if (geran.status === 409 || geran.status === 400) sudah += 1;
        else {
          gagal += 1;
          console.error(
            rawak(
              `Geran gagal ${b.nama}/${p.key}/${alat} (HTTP ${geran.status})`,
              geran.body,
            ),
          );
        }
        perPelayan += 1;
      }
    }
    console.info(
      `[3/3] Geran ${p.nama}: ${perPelayan} disasarkan (${bot.length} Bot x ${p.alat.length} alat).`,
    );
  }
  console.info(
    `[3/3] Geran: ${baharu} baharu, ${sudah} sudah sedia/dilepaskan, ${gagal} gagal ` +
      `(sasaran: ${bot.length} Bot x ${ALAT_MALAYSIA.length + ALAT_MEMORI.length} alat = ${bot.length * (ALAT_MALAYSIA.length + ALAT_MEMORI.length)}).`,
  );
  if (gagal > 0) process.exit(1);
  console.info(
    "SELESAI. OpenBot Malaysia sedia berperang (malaysia + memori).",
  );
}

await main();
