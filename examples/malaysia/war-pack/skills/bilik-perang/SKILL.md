---
name: bilik-perang
description: >-
  Sediakan taklimat strategik Bilik Perang mengikut struktur tetap (Keadaan Semasa,
  Isu Utama, Pilihan Tindakan, Cadangan, Perkara Tidak Disahkan) untuk organisasi dan
  konteks Malaysia. Guna bila perlu laporan keadaan eksekutif atau keputusan lintas jabatan.
license: MIT
compatibility: "OpenBot Malaysia — pelayan MCP 'malaysia' di http://127.0.0.1:4210/mcp"
metadata:
  openbot-slug: bilik-perang
  openbot-server: malaysia
---

# Bilik Perang

## Bila guna
- Perlu laporan keadaan eksekutif yang ringkas dan berstruktur.
- Keputusan lintas jabatan atau lintas agensi mesti dibuat segera.
- Isu menyentuh kerajaan, pematuhan atau konteks institusi Malaysia.

## Arahan
1. Susun taklimat mengikut struktur tetap lima bahagian, dalam urutan ini:
   - **Keadaan Semasa** — apa yang berlaku dan siapa terlibat.
   - **Isu Utama** — 3 isu teratas beserta kesannya.
   - **Pilihan Tindakan** — sekurang-kurangnya 2 pilihan dengan kesan dan risiko setiap satu.
   - **Cadangan** — pilihan yang disyorkan dan sebabnya.
   - **Perkara Tidak Disahkan** — maklumat belum sahih; sentiasa ditanda jelas.
2. Konteks institusi: guna `malaysia/carta_organisasi_persekutuan` bila perkara menyentuh kerajaan atau pematuhan.
3. Angka rasmi: guna `malaysia/carian_dataset`. Jika tiada data sahih, tandakan "perlu disahkan" — JANGAN mereka angka.
4. Dokumen panjang: guna `malaysia/analisis_teks_bm` untuk meringkaskan dokumen yang diberi kepada poin taklimat.
5. Istilah: guna `malaysia/glosari_kerajaan` untuk istilah rasmi yang konsisten.
6. Kekalkan nada eksekutif: setiap dakwaan ada sumber, atau ditanda "perlu disahkan".
7. Akhiri dengan **SENARAI TINDAKAN**: siapa (jabatan/Bot mana), buat apa, bila (tarikh akhir).

## Alat diperlukan
- `malaysia/carta_organisasi_persekutuan`
- `malaysia/carian_dataset`
- `malaysia/analisis_teks_bm`
- `malaysia/glosari_kerajaan`

Rujukan alat di atas ialah pengisytiharan, bukan geran — akses tertakluk kepada dasar kelulusan OpenBot.

## Sumber
- skills.yaml: `examples/malaysia/skills.yaml` (slug: `bilik-perang`)
- Standard SKILL.md: https://agentskills.io
