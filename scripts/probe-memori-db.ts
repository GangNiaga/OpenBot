/**
 * Probe Supabase: adakah jadual memori_malaysia dan extension vector sudah ada?
 * Read-only. Jalankan: bun scripts/probe-memori-db.ts
 */
import postgres from "postgres";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres.bmpippcukywjrrueqjch:gangniagabot2026@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require";

const sql = postgres(DB_URL, {
  max: 1,
  idle_timeout: 10,
  max_lifetime: 60,
  ssl: "require",
});

try {
  const ext = await sql`select extname, extversion from pg_extension where extname = 'vector'`;
  console.log("EXT vector:", ext.length ? `${ext[0].extname} v${ext[0].extversion}` : "TIADA");

  const tbl = await sql`select to_regclass('public.memori_malaysia') as reg`;
  console.log("JADUAL memori_malaysia:", tbl[0]?.reg ?? "TIADA");

  if (tbl[0]?.reg) {
    const cols = await sql`
      select column_name, data_type, udt_name
      from information_schema.columns
      where table_schema='public' and table_name='memori_malaysia'
      order by ordinal_position`;
    for (const c of cols) console.log(`  - ${c.column_name}: ${c.data_type}${c.udt_name === c.data_type ? "" : "/" + c.udt_name}`);

    const idx = await sql`
      select indexname, indexdef from pg_indexes
      where schemaname='public' and tablename='memori_malaysia'`;
    for (const i of idx) console.log(`  [idx] ${i.indexname}: ${i.indexdef.slice(0, 120)}`);

    const bil = await sql`select count(*) as n from memori_malaysia`;
    console.log("BILANGAN BARIS:", bil[0].n);
  }
} catch (e) {
  console.error("RALAT:", e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
