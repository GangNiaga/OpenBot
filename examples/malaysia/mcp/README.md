# Pelayan MCP "malaysia" — Data & Organisasi Malaysia

Pelayan MCP Streamable HTTP yang dirujuk oleh `skills.yaml` dan `agents.yaml` pakej
penyewa ini. **Endpoint: `http://127.0.0.1:4210/mcp`** (mod tanpa-keadaan, JSON).

**Status (16 November 2026):** Pelayan `malaysia` kekal sebagai pelayan tempatan tersuai.
Deployment semasa turut menjalankan 7 pelayan lain daripada katalog terkurasi — `coingecko`,
`malaysiatransit`, `composio`, `exa`, `firecrawl`, `routines`, `memori` — dengan 120 alat
keseluruhan (memori kini 7 alat selepas kit RAG dokumen). Rujuk `../../../docs/architecture.md`
dan `../ECOSYSTEM-RESEARCH.md`.

## Pelayan saudara: memori (port 4211)

Pelayan MCP "memori" (`../memori/server.ts`, `http://127.0.0.1:4211/mcp`) ialah memori
jangka panjang pgvector untuk semua Bot pakej ini, dengan 7 alat. Bermula Nov 2026 cariannya
hibrid penuh: kedudukan vektor cosine (50 kandidat teratas) digabungkan dengan kedudukan
leksikal BM25 (k1=1.2, b=0.75) melalui Reciprocal Rank Fusion — skor =
1/(60+rank_vektor) + 1/(60+rank_leksikal) — supaya soalan berunsur nama/istilah literal tidak
lagi terlepas. Setiap baris kini membawa `valid_at` (bila fakta mula benar; `cari_memori`
terima momen opsyen untuk semantik "sebagaimana pada masa itu"), dan `lupa_memori` ialah
padam lembut — `superseded_at` ditandakan, bukan baris dihapus. Tiga alat dokumen RAG baharu:
`simpan_dokumen` (pecah teks kepada cebisan ~700-900 aksara pada sempadan perenggan, embed
setiap cebisan sebagai kind='doc_chunk'), `cari_dokumen` (hibrid sama; pulangkan cebisan
bersama tajuk dokumen) dan `padam_dokumen` (lupakan semua cebisan sesuatu tajuk). Skema naik
taraf di tempat melalui CREATE/ALTER TABLE IF NOT EXISTS pada larian alat pertama — tiada
migrasi manual — dan geran alat baharu disasarkan oleh `examples/malaysia/bootstrap.ts`
(`ALAT_MEMORI`).

## Penggunaan dalam sandbox ini

Pelayan berjalan sebagai mini-service berasingan:

- Sumber: `/home/z/my-project/mini-services/malaysia-mcp/index.ts`
- Jalankan: `cd /home/z/my-project/mini-services/malaysia-mcp && bun run dev` (auto-restart
  dengan `bun --hot`)
- Kesihatan: `curl http://127.0.0.1:4210/health`
- SDK: `@modelcontextprotocol/sdk` (McpServer + StreamableHTTPServerTransport), corak
  tanpa-keadaan — satu `McpServer` baharu bagi setiap permintaan, selari dengan pola klien
  MCP OpenBot (`server/src/plugins/mcp.ts`) yang membina klien baharu bagi setiap panggilan.

## Pendaftaran dalam OpenBot

Pelayan ini didaftarkan sebagai **entri katalog first-party** dalam
`server/src/plugins/catalogue.ts`:

```ts
{
  key: "malaysia",
  title: "Data & Organisasi Malaysia",
  vendor: "OpenBot (tempatan)",
  host: "http://127.0.0.1:4210",
  path: "/mcp",
  auth: { kind: "none" },
  writeTools: Object.freeze([]),
}
```

Selepas pelayan berjalan, pentadbir menambahnya melalui `POST /api/plugins/servers`
dengan `{"key": "malaysia"}` — OpenBot memanggil `tools/list` semasa menambah, jadi
semua 18 alat ditemui serta-merta. Geran per Bot diberikan melalui
`POST /api/plugins/grants` (contoh penuh: `examples/malaysia/bootstrap.ts`).

## 18 alat (semuanya baca sahaja, `readOnlyHint: true`)

13 alat asal + 5 alat kit F&B (dilancarkan bersama `FNB-PLAYBOOK.md`):

| Alat | Tujuan |
|---|---|
| `carta_organisasi_persekutuan` | Struktur kerajaan persekutuan lengkap + blok Mermaid |
| `senarai_kementerian` | Senarai utama kementerian dengan portfolio (snapshot bertarikh) |
| `senarai_negeri` | 13 negeri + 3 WP, ibu kota, gelaran ketua eksekutif, nota MA63 |
| `gred_perkhidmatan` | Kumpulan gred perkhidmatan awam (JPA) |
| `struktur_organisasi_templat` | Templat carta syarikat: sdn-bhd/berhad/glc/sme/koperasi |
| `carian_dataset` | Carian data.gov.my (degradasi jujur bila tidak dapat dihubungi) |
| `ambil_dataset` | Butiran set data data.gov.my |
| `analisis_teks_bm` | Statistik teks BM + kata kunci (kata henti ditapis) |
| `penukar_unit` | km/batu, kg/paun, °C/°F, hektar/ekar, format RM |
| `mermaid_carta` | JSON hierarki -> carta Mermaid disahkan |
| `templat_minit_mesyuarat` | Templat minit mesyuarat gaya rasmi Malaysia |
| `kalendar_cuti` | Hari kelepasan am (tetap DISAHKAN; takwim PERLU DISAHKAN) |
| `glosari_kerajaan` | Glosari dwibahasa istilah kerajaan/korporat |
| `scenari_fnb` | 6 senario perniagaan F&B + data pasaran DOSM + peraturan SST/halal |
| `kalkulator_harga_jual` | Kos resipi -> harga jual, margin, SST 6%/8% |
| `kira_bep` | Titik pulang modal (BEP) per suku, cakupan kos tetap |
| `pelan_kandungan_fnb` | Pelan kandungan mingguan F&B per saluran |
| `jawab_ulasan` | Draf balasan ulasan pelanggan (BM, nada sopan) |

## Prinsip data

Setiap jawapan membawa nota semakan. Tarikh takwim (Islam/Cina/Tamil) sentiasa ditanda
`PERLU DISAHKAN`. Tiada angka direka — jika data.gov.my tidak dapat dihubungi, alat
berkata begitu dengan jelas dan tidak meneka.
