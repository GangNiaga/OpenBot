#!/usr/bin/env python3
"""Suntik arahan memori jangka panjang ke dalam setiap system_prompt Bot Malaysia.

Memasukkan blok MEMORI selepas setiap baris `system_prompt: >-` dalam
examples/malaysia/agents.yaml, dengan indentasi 6 ruang supaya kemas dalam blok >-.
Idempoten: blok yang sudah ada tidak diduplikasi.
"""
import re
import sys

PATH = "examples/malaysia/agents.yaml"

BLOK = [
    "      MEMORI JANGKA PANJANG - anda memegang alat pelayan MCP \"memori\": simpan_memori,",
    "      cari_memori, lupa_memori, bilang_memori. Tiga peraturan wajib: (1) Apabila pengguna",
    "      memberitahu fakta peribadi mereka (nama, tempat tinggal, pekerjaan, keutamaan,",
    "      tarikh penting), PANGGIL simpan_memori dahulu untuk menyimpannya, kemudian sahkan",
    "      dengan id yang alat pulangkan. DILARANG KERAS mengaku \"saya sudah simpan\" jika",
    "      tiada panggilan simpan_memori sebenar berlaku dalam run ini. (2) Apabila pengguna",
    "      bertanya apa-apa tentang diri mereka sendiri (\"siapa saya\", \"nama saya siapa\",",
    "      \"apa minuman kegemaran saya\"), PANGGIL cari_memori dahulu dan jawab daripada",
    "      hasilnya; jika tiada memori sepadan, katakan jujur anda tiada rekod itu dan tanya",
    "      pengguna. (3) Gunakan bilang_memori untuk kiraan dan lupa_memori (dengan id) untuk",
    "      memadam memori yang salah. Alat-alat ini satu-satunya cara anda ingat sesuatu",
    "      merentas perbualan; memori yang tidak disimpan dengan alat ini hilang selamanya.",
]

TAG = "MEMORI JANGKA PANJANG"

with open(PATH, encoding="utf-8") as f:
    lines = f.read().split("\n")

out = []
dibuat = 0
dilangkau = 0
i = 0
while i < len(lines):
    line = lines[i]
    out.append(line)
    if re.match(r"^    system_prompt: >-\s*$", line):
        # semak sama ada blok sudah wujud dalam beberapa baris seterusnya (idempoten)
        hampir = "\n".join(lines[i + 1 : i + 15])
        if TAG in hampir:
            dilangkau += 1
        else:
            out.extend(BLOK)
            dibuat += 1
    i += 1

with open(PATH, "w", encoding="utf-8") as f:
    f.write("\n".join(out))

print(f"Blok ditambah: {dibuat} | sudah ada: {dilangkau}")
if dibuat == 0 and dilangkau == 0:
    print("AMARAN: tiada system_prompt: >- dijumpai - semak format fail!")
    sys.exit(1)
