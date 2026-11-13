---
name: lukis-carta
description: >-
  Jana carta organisasi Mermaid yang sah dan kemas dari struktur yang diberi atau templat
  pelayan malaysia (kerajaan persekutuan/negeri, syarikat Sdn Bhd/Berhad/GLC/SME/koperasi).
  Guna bila perlukan gambarajah organisasi.
license: MIT
compatibility: "OpenBot Malaysia — pelayan MCP 'malaysia' di http://127.0.0.1:4210/mcp"
metadata:
  openbot-slug: lukis-carta
  openbot-server: malaysia
---

# Lukis Carta

## Bila guna
- Perlu gambarajah organisasi untuk kerajaan, syarikat atau entiti Malaysia.
- Pengguna beri struktur organisasi dan mahu carta yang sah secara sintaks Mermaid.
- Perlu templat struktur sedia ada sebagai titik mula.

## Arahan
1. Susun senarai nod dahulu dalam Bahasa Melayu: id (identifikator ringkas dan unik), label (jawatan/unit), induk (nod atas).
2. Pilih titik mula:
   - Kerajaan: mulakan dari `malaysia/carta_organisasi_persekutuan`.
   - Syarikat: mulakan dari `malaysia/struktur_organisasi_templat` (jenis: sdn-bhd, berhad, glc, sme, koperasi; saiz: kecil, sederhana, besar).
3. Panggil `malaysia/mermaid_carta` untuk jana DAN sahkan carta — jangan tulis blok Mermaid dengan tangan bila alat ini ada, kerana alat itu mengesahkan id unik, induk wujud dan had 40 nod.
4. Jika alat melaporkan ralat pengesahan, baiki senarai nod mengikut ralat itu dan panggil semula sehingga lulus.
5. Keluarkan blok Mermaid akhir dengan penerangan ringkas setiap lapisan.
6. Jangan sesekali letak nama individu dalam carta — jawatan sahaja.

## Alat diperlukan
- `malaysia/mermaid_carta`
- `malaysia/struktur_organisasi_templat`
- `malaysia/carta_organisasi_persekutuan`

Rujukan alat di atas ialah pengisytiharan, bukan geran — akses tertakluk kepada dasar kelulusan OpenBot.

## Sumber
- skills.yaml: `examples/malaysia/skills.yaml` (slug: `lukis-carta`)
- Standard SKILL.md: https://agentskills.io
