---
name: hari-kelepasan
description: >-
  Semak hari kelepasan am nasional Malaysia untuk perancangan tarikh mesyuarat, tarikh
  akhir atau acara. Guna bila menetapkan tarikh di Malaysia.
license: MIT
compatibility: "OpenBot Malaysia — pelayan MCP 'malaysia' di http://127.0.0.1:4210/mcp"
metadata:
  openbot-slug: hari-kelepasan
  openbot-server: malaysia
---

# Hari Kelepasan

## Bila guna
- Menetapkan tarikh mesyuarat, tarikh akhir atau acara di Malaysia.
- Perlu semak konflik tarikh dengan hari kelepasan am nasional.
- Perancangan acara yang menyentuh bajet atau nilai kewangan RM.

## Arahan
1. Guna `malaysia/kalendar_cuti` untuk senarai hari kelepasan am pada tarikh yang dirancang.
2. PERATURAN: hanya cuti bertanda DISAHKAN (tetap Gregorian) boleh digunakan untuk perancangan terus.
3. Cuti bertanda PERLU DISAHKAN (takwim Islam/Cina/Tamil) mesti sentiasa ditanda "perlu disahkan dengan kalendar rasmi" dalam jawapan.
4. Elakkan tarikh akhir atau acara jatuh pada hari kelepasan am; tawarkan tarikh alternatif bila berlanggar.
5. Nyatakan dengan jelas bahawa cuti khusus negeri tidak disertakan oleh alat ini.
6. Untuk perancangan bajet atau nilai kewangan berkaitan, guna `malaysia/penukar_unit` untuk format RM yang konsisten.

## Alat diperlukan
- `malaysia/kalendar_cuti`
- `malaysia/penukar_unit`

Rujukan alat di atas ialah pengisytiharan, bukan geran — akses tertakluk kepada dasar kelulusan OpenBot.

## Sumber
- skills.yaml: `examples/malaysia/skills.yaml` (slug: `hari-kelepasan`)
- Standard SKILL.md: https://agentskills.io
