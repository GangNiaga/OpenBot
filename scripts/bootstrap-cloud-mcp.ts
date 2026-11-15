/**
 * Bootstrap pelayan MCP awan untuk deployment Render: composio, exa, firecrawl,
 * coingecko, malaysiatransit - kredensial vault, pendaftaran server, dan geran
 * setiap alat kepada setiap Bot.
 *
 * IDEMPOTEN dan bukan fatal jika gagal: dijalankan oleh start-cloud.sh selepas
 * pelayan siap, setiap but. Yang sudah wujud ditinggalkan begitu sahaja, jadi
 * skrip ini hanya mengisi apa yang hilang - sama peranan dengan
 * examples/malaysia/bootstrap.ts untuk pelayan MCP tempatan.
 *
 * Kunci COMPOSIO_API_KEY ialah CONSUMER MCP KEY (ck_...) dari halaman
 * "Sessions & API Key" Composio - ia hanya sah pada connect.composio.dev/mcp
 * dengan header x-consumer-api-key, bukan pada REST Platform API.
 */

import postgres from "postgres";

const serverUrl = (process.env.OPENBOOT_SERVER_URL ?? "").replace(/\/+$/, "");
if (!serverUrl) {
  throw new Error(
    "OPENBOOT_SERVER_URL is not set, so this bootstrap does not know which server to configure.",
  );
}

/**
 * The whole bootstrap, retried. Boot is when every other process in the container fills its
 * pool, and Supabase's session-mode pooler caps the deployment at 15 clients — a first
 * attempt that lands exactly in that burst dies with EMAXCONNSESSION (observed on Render).
 * Three goes with a gap between them clears the burst; each phase re-reads what exists, so
 * a partial attempt is simply finished by the next one.
 */
const MAX_ATTEMPTS = 3;
const RETRY_MS = 12_000;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  try {
    await bootstrap();
    process.exit(0);
  } catch (error) {
    console.warn(
      JSON.stringify({
        type: "bootstrap-cloud-mcp-attempt-failed",
        attempt,
        reason: error instanceof Error ? error.message : String(error),
      }),
    );
    if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, RETRY_MS));
  }
}
console.warn(
  JSON.stringify({ type: "bootstrap-cloud-mcp-gave-up", attempts: MAX_ATTEMPTS }),
);
process.exit(1);

async function bootstrap(): Promise<void> {

/** Pelayan katalog yang deployment awan ini dijamin ada, dan siapa yang mengesahkannya. */
const KEYLESS_SERVERS = ["exa", "firecrawl", "coingecko", "malaysiatransit"];
const COMPOSIO_KEY_ID = "composio-consumer-mcp";

type Credential = { id: string; keyId: string; revokedAt: string | null };

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${path} answered ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// 1. Kredensial composio dalam vault (idempoten mengikut keyId)
// ---------------------------------------------------------------------------
let composioCredentialId: string | null = null;
try {
  const listed = await json<{ credentials: Credential[] }>("/api/admin/credentials");
  composioCredentialId =
    listed.credentials.find(
      (c) => c.keyId === COMPOSIO_KEY_ID && c.revokedAt === null,
    )?.id ?? null;
} catch {
  // Listing yang gagal bukan kegagalan akhir - cuba semak melalui pendaftaran di bawah.
}

if (!composioCredentialId && process.env.COMPOSIO_API_KEY) {
  const created = await json<{ credential: Credential }>("/api/admin/credentials", {
    method: "POST",
    body: JSON.stringify({
      kind: "mcp",
      provider: "composio",
      keyId: COMPOSIO_KEY_ID,
      plaintext: process.env.COMPOSIO_API_KEY,
      metadata: {
        note: "Composio consumer MCP key (halaman Sessions & API Key); header x-consumer-api-key",
      },
    }),
  });
  composioCredentialId = created.credential.id;
  console.info(JSON.stringify({ type: "bootstrap-credential-created", id: composioCredentialId }));
}

// ---------------------------------------------------------------------------
// 2. Pendaftaran server (idempoten: yang sudah ada dilangkau)
// ---------------------------------------------------------------------------
const plugins = await json<{ servers: { id: string }[] }>("/api/plugins");
const present = new Set(plugins.servers.map((s) => s.id));

const toAdd: { key: string; credentialId?: string }[] = [];
if (composioCredentialId && !present.has("composio")) {
  toAdd.push({ key: "composio", credentialId: composioCredentialId });
}
for (const key of KEYLESS_SERVERS) {
  if (!present.has(key)) toAdd.push({ key });
}

for (const add of toAdd) {
  try {
    await json("/api/plugins/servers", { method: "POST", body: JSON.stringify(add) });
    console.info(JSON.stringify({ type: "bootstrap-server-added", key: add.key }));
  } catch (error) {
    // 409 "already" dari lomba antara but dengan but lama bukan kegagalan.
    console.warn(
      JSON.stringify({ type: "bootstrap-server-skipped", key: add.key, reason: String(error).slice(0, 160) }),
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Alat yang telah ditemui (dari DB - sumber benar selepas addServer refresh)
// ---------------------------------------------------------------------------
const serversToGrant = [...(composioCredentialId ? ["composio"] : []), ...KEYLESS_SERVERS].filter(
  (key) => present.has(key) || toAdd.some((a) => a.key === key),
);

const sql = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 5 });
// postgres.js expands `${sql(list)}` as a comma-joined IN list; a raw array binds as ONE
// array parameter, which silently matches no server_id and grants nothing.
const toolRows = await sql`
  select server_id, name from mcp_tools
  where server_id in (${sql(serversToGrant)})
  order by server_id, name`;
await sql.end();
const refs = toolRows.map((r: { server_id: string; name: string }) => `${r.server_id}/${r.name}`);

// ---------------------------------------------------------------------------
// 4. Geran: setiap alat kepada setiap Bot (toleran dengan yang sudah wujud)
// ---------------------------------------------------------------------------
const agents = await json<{ agents: { id: string }[] }>("/api/agents");
const agentIds = agents.agents.map((a) => a.id);

let ok = 0;
let already = 0;
let failed = 0;
const jobs: Promise<void>[] = [];
async function grant(ref: string, agentId: string): Promise<void> {
  try {
    const res = await fetch(`${serverUrl}/api/plugins/grants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "mcp", ref, agentId }),
      signal: AbortSignal.timeout(60_000),
    });
    if (res.ok) {
      ok += 1;
    } else if (res.status === 409) {
      already += 1;
    } else {
      failed += 1;
    }
  } catch {
    failed += 1;
  }
}
for (const ref of refs) {
  for (const agentId of agentIds) jobs.push(grant(ref, agentId));
}
const CONCURRENCY = 10;
for (let i = 0; i < jobs.length; i += CONCURRENCY) {
  await Promise.all(jobs.slice(i, i + CONCURRENCY));
}

console.info(
  JSON.stringify({
    type: "bootstrap-cloud-mcp-done",
    servers: serversToGrant,
    tools: refs.length,
    agents: agentIds.length,
    grants: { created: ok, already: already, failed },
  }),
);
}
