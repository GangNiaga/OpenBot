import { describe, expect, test } from "bun:test";
import {
  parseSkillMd,
  renderSkillMd,
  SkillMdRefusedError,
} from "../src/plugins/plugin-store/skill-md";
import type { SkillRecord } from "../src/plugins/plugin-store/model";

function record(overrides: Partial<SkillRecord> = {}): SkillRecord {
  return {
    id: "analisis-data",
    slug: "analisis-data",
    ownerUserId: null,
    title: "Analisis Data",
    summary: "Cari, baca dan analisis set data terbuka Malaysia dengan peraturan anti-reka angka.",
    instructions: "1. Cari set data.\n2. Ambil butiran.\n3. Ringkaskan tanpa mereka angka.",
    origin: "yours",
    installedBy: "dev@openbot.local",
    grantedTo: [],
    tools: ["malaysia/carian_dataset", "malaysia/ambil_dataset"],
    ...overrides,
  } as SkillRecord;
}

describe("rendering a skill row as SKILL.md", () => {
  test("front matter carries the agentskills.io fields and metadata", () => {
    const md = renderSkillMd(record());
    expect(md).toStartWith("---\nname: analisis-data\ndescription: >-\n");
    expect(md).toContain("license: MIT");
    expect(md).toContain("metadata:\n  openbot-slug: analisis-data");
    expect(md).toContain("openbot-tools: malaysia/carian_dataset,malaysia/ambil_dataset");
  });

  test("the body mirrors the war-pack structure", () => {
    const md = renderSkillMd(record());
    expect(md).toContain("# Analisis Data");
    expect(md).toContain("## Bila guna");
    expect(md).toContain("## Arahan");
    expect(md).toContain("- `malaysia/carian_dataset`");
    expect(md).toContain("Rujukan alat di atas ialah pengisytiharan, bukan geran");
  });

  test("a skill with no declared tools renders no tool sections", () => {
    const md = renderSkillMd(record({ tools: [] }));
    expect(md).not.toContain("openbot-tools");
    expect(md).not.toContain("## Alat diperlukan");
  });

  test("an invalid slug is refused rather than rendered", () => {
    expect(() => renderSkillMd(record({ slug: "Bad Slug" }))).toThrow(SkillMdRefusedError);
  });
});

describe("parsing a SKILL.md document", () => {
  test("the rendered form parses back to the same fields (round-trip)", () => {
    const parsed = parseSkillMd(renderSkillMd(record()));
    expect(parsed.slug).toBe("analisis-data");
    expect(parsed.title).toBe("Analisis Data");
    expect(parsed.summary).toContain("anti-reka angka");
    expect(parsed.instructions).toContain("1. Cari set data.");
    expect(parsed.instructions).not.toContain("## Alat");
    expect(parsed.tools).toEqual(["malaysia/carian_dataset", "malaysia/ambil_dataset"]);
  });

  test("a war-pack file parses: folded description, metadata slug, Arahan body", () => {
    const md = `---
name: bilik-perang
description: >-
  Sediakan taklimat strategik Bilik Perang mengikut struktur tetap untuk
  konteks Malaysia. Guna bila perlu laporan keadaan eksekutif.
license: MIT
compatibility: "OpenBot Malaysia"
metadata:
  openbot-slug: bilik-perang
  openbot-server: malaysia
---

# Bilik Perang

## Bila guna
- Laporan keadaan eksekutif.

## Arahan
1. Kumpul fakta daripada alat yang dipunyai.
2. Bentangkan mengikut struktur tetap.

## Alat diperlukan
- \`malaysia/ambil_dataset\`
`;
    const parsed = parseSkillMd(md);
    expect(parsed.slug).toBe("bilik-perang");
    expect(parsed.title).toBe("Bilik Perang");
    expect(parsed.summary).toContain("laporan keadaan eksekutif");
    expect(parsed.instructions).toContain("1. Kumpul fakta");
    expect(parsed.instructions).not.toContain("Alat diperlukan");
    expect(parsed.tools).toEqual([]);
  });

  test("a foreign file with no Arahan section imports its whole body", () => {
    const md = `---
name: nota-ringkas
description: Ringkas sesuatu teks panjang.
---

# Nota Ringkas

Baca teks, buat lima poin utama, pulangkan sahaja.
`;
    const parsed = parseSkillMd(md);
    expect(parsed.slug).toBe("nota-ringkas");
    expect(parsed.instructions).toContain("lima poin utama");
  });

  test("a missing description is refused, per the agentskills.io spec", () => {
    expect(() =>
      parseSkillMd("---\nname: tiada-huraian\n---\n\n# Tiada\n\nBadan sahaja."),
    ).toThrow(SkillMdRefusedError);
  });

  test("an unclosed front matter block is refused", () => {
    expect(() => parseSkillMd("---\nname: tak-tutup\n\n# Badan")).toThrow(
      SkillMdRefusedError,
    );
  });

  test("a name over the 64-character cap is refused", () => {
    const longName = "a".repeat(65);
    expect(() =>
      parseSkillMd(`---\nname: ${longName}\ndescription: penerangan\n---\n\n# Badan`),
    ).toThrow(SkillMdRefusedError);
  });
});
