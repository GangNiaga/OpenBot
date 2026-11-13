/**
 * E2E Memori Jangka Panjang (awan) - OpenBot Render.
 *
 * Mod Intelligence: POST /run kembalikan envelope {joinToken, realtime:{clientUrl,topic}},
 * dan peristiwa AG-UI mengalir melalui WebSocket Phoenix ke topik `thread:<threadId>`.
 * Urutan: join WS (mod "run") dahulu, kemudian POST /run, kemudian dengar.
 *
 * Aliran ujian:
 *  1. Thread A: arah bot simpan fakta pengguna (harap alat simpan_memori)
 *  2. Probe Supabase terus: baris baru dalam memori_malaysia?
 *  3. Thread B (BARU): tanya "siapa saya?" (harap cari_memori)
 *
 * Jalankan: bun e2e_memori.ts
 */
import postgres from "postgres";

const BASE = "https://openbot-server-90bf.onrender.com";
const WS_URL = "wss://openbot-server-90bf.onrender.com/api/intelligence/client/websocket";
const AGENT = "pembantu-malaysia";
const STAM = Date.now();
const MASA_MENUNGGU_MS = 150_000;

function masa() {
  return new Date().toISOString().slice(11, 19);
}

/** Satu run penuh: join WS topic, POST /run, kutip peristiwa sehingga RUN_FINISHED. */
async function run(tag: string, threadId: string, userText: string) {
  const topic = `thread:${threadId}`;
  const peristiwa: any[] = [];
  let selesai = false;

  const ws = new WebSocket(WS_URL);
  const tungguBuka = new Promise<void>((lulus, gagal) => {
    ws.onopen = () => lulus();
    ws.onerror = (e) => gagal(new Error("WS error: " + String(e)));
    setTimeout(() => gagal(new Error("WS timeout buka")), 30_000);
  });
  await tungguBuka;

  // Phoenix join (mod run - tanpa stream_mode, strim mula dengan RUN_STARTED)
  ws.send(JSON.stringify([1, 1, topic, "phx_join", {}]));

  const tungguPeristiwa = new Promise<string>((lulus) => {
    const tamat = setTimeout(() => {
      console.log(`  [${masa()}] ${tag}: tamat masa ${MASA_MENUNGGU_MS / 1000}s tanpa RUN_FINISHED`);
      lulus("timeout");
    }, MASA_MENUNGGU_MS);
    ws.onmessage = (m) => {
      let frame: any[];
      try {
        frame = JSON.parse(String(m.data));
      } catch {
        return;
      }
      const [, , ftopic, fevent, payload] = frame;
      if (fevent === "phx_reply") return;
      if (ftopic !== topic) return;
      if (fevent === "ag_ui_event") {
        peristiwa.push(payload);
        const t = payload?.type ?? "";
        if (t === "TOOL_CALL_START") console.log(`  [${masa()}] ${tag} ALAT: ${payload.toolCallName}`);
        if (t === "TEXT_MESSAGE_CONTENT" && payload.delta)
          process.stdout.write("");
      } else if (fevent === "stream_idle" || fevent === "replay_complete") {
        // idle selepas run ialah isyarat hujung
        if (selesai) {
          clearTimeout(tamat);
          lulus(fevent);
        }
      }
    };
    ws.onclose = () => {
      if (!selesai) {
        clearTimeout(tamat);
        lulus("ws-close");
      }
    };
  });

  // POST /run selepas WS join
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/copilotkit/agent/${AGENT}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      threadId,
      runId: `run-${tag}-${STAM}`,
      state: {},
      messages: [{ id: `m-${tag}-${STAM}`, role: "user", content: userText }],
      tools: [],
      context: [],
    }),
  });
  const envelope = await res.json().catch(() => null);
  console.log(`  [${masa()}] ${tag}: POST HTTP ${res.status} envelope=${envelope ? "ok" : "?"}`);

  // Tunggu sehingga RUN_FINISHED dilihat dalam peristiwa, kemudian sedikit lagi untuk idle
  const mula = Date.now();
  while (Date.now() - mula < MASA_MENUNGGU_MS) {
    if (peristiwa.some((p) => p?.type === "RUN_FINISHED")) {
      selesai = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  selesai = true;

  const teks = peristiwa
    .filter((p) => p?.type === "TEXT_MESSAGE_CONTENT")
    .map((p) => p.delta ?? "")
    .join("");
  const alat = peristiwa
    .filter((p) => p?.type === "TOOL_CALL_START")
    .map((p) => p.toolCallName);
  const errEv = peristiwa.find((p) => p?.type === "RUN_ERROR");
  if (errEv) console.log(`  [${masa()}] ${tag} RUN-RALAT: ${JSON.stringify(errEv).slice(0, 200)}`);
  console.log(`  [${masa()}] ${tag}: ${peristiwa.length} peristiwa, ${Math.round((Date.now() - t0) / 1000)}s`);
  try {
    ws.close();
  } catch {}
  return { teks, alat };
}

async function probeSupabase() {
  const url =
    "postgres://postgres.bmpippcukywjrrueqjch:gangniagabot2026@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require";
  const sql = postgres(url, { max: 1, connect_timeout: 15, ssl: "require" });
  try {
    const rows = await sql`select id, kind, kandungan, model, created_at from memori_malaysia order by created_at desc limit 5`;
    console.log(`  Supabase memori_malaysia: ${rows.length} baris terkini`);
    for (const r of rows)
      console.log(`    - [${r.kind}] ${String(r.kandungan).slice(0, 90)} (${r.model})`);
    return rows;
  } catch (e: any) {
    console.log(`  Supabase RALAT: ${e.code ?? e.message}`);
    return [];
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

async function utama() {
  console.log(`=== E2E MEMORI @ ${new Date().toISOString()} (agen: ${AGENT}) ===`);

  console.log(`\n--- Langkah 1: simpan memori (thread A) ---`);
  const a = await run(
    "simpan",
    `memori-a-${STAM}`,
    "Sila simpan maklumat ini dalam memori jangka panjang anda sekarang: nama saya Zul Azman, saya tinggal di Ipoh, dan minuman kegemaran saya ialah teh tarik. Selepas menyimpan, sahkan dengan satu ayat."
  );
  console.log(`  Jawapan: ${a.teks.slice(0, 200) || "(tiada)"}`);
  console.log(`  Alat: ${a.alat.length ? a.alat.join(", ") : "(tiada)"}`);

  console.log(`\n--- Langkah 2: probe Supabase ---`);
  const rows = await probeSupabase();

  console.log(`\n--- Langkah 3: ingat semula (thread B BARU) ---`);
  const b = await run("ingat", `memori-b-${STAM}`, "Siapa nama saya? Di mana saya tinggal? Apa minuman kegemaran saya? Jawab ringkas.");
  console.log(`  Jawapan: ${b.teks.slice(0, 300) || "(tiada)"}`);
  console.log(`  Alat: ${b.alat.length ? b.alat.join(", ") : "(tiada)"}`);

  const berjaya = rows.length > 0 && b.teks.toLowerCase().includes("zul");
  console.log(
    `\n=== KEPUTUSAN: ${berjaya ? "LULUS - memori berfungsi merentas thread" : "GAGAL/SEPARA - lihat butiran"} ===`
  );
  process.exit(berjaya ? 0 : 1);
}

utama().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
