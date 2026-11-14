/**
 * Pem.wayar Composio MCP (consumer key) ke deployment OpenBot - ikut saluran rasmi
 * produk, BUKAN tulis terus DB:
 *
 *   1. POST /api/admin/credentials  {kind:"mcp", provider:"composio", keyId, plaintext}
 *      - kunci consumer `ck_...` masuk ke vault (disulitkan). Idempoten: kunci hidup
 *        dengan kind/provider/keyId sama dipulihkan melalui rotasi.
 *   2. POST /api/plugins/servers    {key:"composio", credentialId}
 *      - entri katalog first-party (host https://connect.composio.dev, path /mcp,
 *        header `x-consumer-api-key`). addServer menjalankan refreshTools serta-merta,
 *        jadi 12 meta-alat ditemui pada saat penambahan.
 *   3. GET  /api/agents             - semua Bot.
 *   4. POST /api/plugins/grants     {kind:"mcp", ref:"composio/<ALAT>", agentId} x 12 x N.
 *   5. GET  /api/plugins/for/pembantu-malaysia  - sahkan alat tersenarai.
 *   6. POST /api/plugins/call       {ref:"composio/COMPOSIO_SEARCH_TOOLS"} - panggilan hidup.
 *
 * Jalankan:  bun scripts/composio-mcp-wire.ts
 */
const BASE = (
  process.env.OPENBOT_BASE ?? "https://openbot-server-90bf.onrender.com"
).replace(/\/$/, "");
const CONSUMER_KEY =
  process.env.COMPOSIO_CONSUMER_KEY ?? "ck_LyGglpQbXJfMCg1sSsHs";
const AGENT_SEMAK = process.env.OPENBOT_CHECK_AGENT ?? "pembantu-malaysia";

/** 12 meta-alat yang didaftar pelayan Composio (sumber: tools/list 2026-02). */
const ALAT_COMPOSIO = [
  "COMPOSIO_SEARCH_TOOLS",
  "COMPOSIO_GET_TOOL_SCHEMAS",
  "COMPOSIO_MULTI_EXECUTE_TOOL",
  "COMPOSIO_PROXY_EXECUTE",
  "COMPOSIO_MANAGE_CONNECTIONS",
  "COMPOSIO_WAIT_FOR_CONNECTIONS",
  "COMPOSIO_REMOTE_BASH_TOOL",
  "COMPOSIO_REMOTE_WORKBENCH",
  "COMPOSIO_SEARCH_SKILLS",
  "COMPOSIO_MANAGE_SKILL",
  "COMPOSIO_USE_SKILL",
  "COMPOSIO_SUBMIT_FEEDBACK",
] as const;

function masa() {
  return new Date().toISOString().slice(11, 19);
}

async function api(
  label: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  console.log(
    `[${masa()}] ${label}: HTTP ${response.status}` +
      (body ? ` ${JSON.stringify(body).slice(0, 300)}` : ""),
  );
  return { status: response.status, body };
}

async function utama(): Promise<void> {
  console.log(`=== WAYAR COMPOSIO MCP @ ${BASE} (${masa()}) ===`);

  // 0. Deployment hidup?
  const agents = await api("0. agents", "/api/agents");
  if (agents.status !== 200 || !Array.isArray(agents.body?.agents)) {
    console.error("FATAL: deployment tidak menjawab /api/agents");
    process.exit(2);
  }
  const idBot = (agents.body.agents as { id: string }[]).map((a) => a.id);
  console.log(
    `  ${idBot.length} Bot: ${idBot.slice(0, 8).join(", ")}${idBot.length > 8 ? " ..." : ""}`,
  );

  // 1. Kunci consumer ke vault (kind mcp + provider composio = syarat addServer).
  const kred = await api("1. credential", "/api/admin/credentials", {
    method: "POST",
    body: JSON.stringify({
      kind: "mcp",
      provider: "composio",
      keyId: "composio-consumer-mcp",
      plaintext: CONSUMER_KEY,
      metadata: {
        note: "Composio consumer MCP key (halaman Sessions & API Key); header x-consumer-api-key",
      },
    }),
  });
  const credentialId: string | undefined = kred.body?.credential?.id;
  if (kred.status !== 200 && kred.status !== 201) {
    console.error(
      `FATAL: kredensial gagal (HTTP ${kred.status}).`,
      JSON.stringify(kred.body),
    );
    process.exit(2);
  }
  if (!credentialId) {
    console.error("FATAL: tiada credential.id dalam jawapan.");
    process.exit(2);
  }

  // 2. Tambah pelayan katalog "composio" dengan credentialId (refreshTools serta-merta).
  const tambah = await api("2. addServer", "/api/plugins/servers", {
    method: "POST",
    body: JSON.stringify({ key: "composio", credentialId }),
  });
  const pelayan = tambah.body?.server;
  if (tambah.status === 200 && pelayan) {
    const bilangan = Array.isArray(pelayan.tools) ? pelayan.tools.length : "?";
    console.log(
      `  Pelayan composio: ${bilangan} alat, lastError=${JSON.stringify(pelayan.lastError ?? null)}`,
    );
  } else {
    console.error(
      `FATAL: addServer HTTP ${tambah.status}.`,
      JSON.stringify(tambah.body),
    );
    process.exit(2);
  }

  // 3. Geran: setiap alat x setiap Bot. Yang sudah ada dilepaskan dengan senyap.
  let berjaya = 0;
  let gagal = 0;
  for (const bot of idBot) {
    for (const alat of ALAT_COMPOSIO) {
      const geran = await api(
        `3. geran ${bot}/${alat}`,
        "/api/plugins/grants",
        {
          method: "POST",
          body: JSON.stringify({
            kind: "mcp",
            ref: `composio/${alat}`,
            agentId: bot,
          }),
        },
      );
      if (geran.status === 200) berjaya += 1;
      else gagal += 1;
    }
  }
  console.log(`  Geran: ${berjaya} berjaya, ${gagal} gagal`);
  if (gagal > 0) {
    console.error("FATAL: ada geran gagal - semak log di atas.");
    process.exit(2);
  }

  // 4. Sahkan senarai untuk satu Bot.
  const senarai = await api(
    `4. plugins/for/${AGENT_SEMAK}`,
    `/api/plugins/for/${AGENT_SEMAK}`,
  );
  const refs: string[] = (senarai.body?.tools ?? senarai.body?.plugins ?? [])
    .map((t: any) => t?.ref ?? t?.name ?? "")
    .filter((r: string) => r.startsWith("composio/"));
  console.log(
    `  Alat composio untuk ${AGENT_SEMAK}: ${refs.length}${refs.length ? ` -> ${refs.join(", ")}` : ""}`,
  );

  // 5. Panggilan hidup: carian melintasi katalog Composio.
  const panggil = await api("5. call SEARCH_TOOLS", "/api/plugins/call", {
    method: "POST",
    body: JSON.stringify({
      ref: "composio/COMPOSIO_SEARCH_TOOLS",
      args: {
        queries: [
          {
            use_case: "list repositories of a github user",
            known_fields: "",
          },
        ],
      },
      agentId: AGENT_SEMAK,
    }),
  });
  const teks = String(panggil.body?.text ?? "");
  console.log(`  Hasil panggilan (potong 600): ${teks.slice(0, 600)}`);

  const lulus =
    refs.length >= ALAT_COMPOSIO.length &&
    panggil.status === 200 &&
    teks.includes('"successful":true');
  console.log(
    `\n=== KEPUTUSAN: ${lulus ? "LULUS - Composio MCP berwayar dan berfungsi" : "SEPARA/GAGAL - lihat butiran"} ===`,
  );
  process.exit(lulus ? 0 : 1);
}

utama().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
