# Pelayan MCP "malaysia" — Data & Organisasi Malaysia

Pelayan MCP Streamable HTTP yang dirujuk oleh `skills.yaml` dan `agents.yaml` pakej
penyewa ini. **Endpoint: `http://127.0.0.1:4210/mcp`** (mod tanpa-keadaan, JSON).

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
semua 13 alat ditemui serta-merta. Geran per Bot diberikan melalui
`POST /api/plugins/grants` (contoh penuh: `examples/malaysia/bootstrap.ts`).

## 13 alat (semuanya baca sahaja, `readOnlyHint: true`)

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

## Prinsip data

Setiap jawapan membawa nota semakan. Tarikh takwim (Islam/Cina/Tamil) sentiasa ditanda
`PERLU DISAHKAN`. Tiada angka direka — jika data.gov.my tidak dapat dihubungi, alat
berkata begitu dengan jelas dan tidak meneka.
