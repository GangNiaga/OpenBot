/**
 * The SKILL.md bridge: an OpenBot skill row rendered as, and parsed back from, the
 * Agent Skills format (https://agentskills.io/specification).
 *
 * WHY THIS FILE EXISTS. The `skills` table is OpenBot's own shape — slug, title,
 * summary, instructions, declared tool refs — and everything inside OpenBot reads that
 * shape. The rest of the agent world reads SKILL.md: Claude's skills API, skills.sh
 * (`npx skills add owner/repo`), ClawHub, Composio's own SKILL.md. Rendering and parsing
 * this one format is what makes a skill written here installable there and vice versa,
 * with no other machinery.
 *
 * THE FORMAT IS THE CONTRACT, so both directions pin the same conventions, and the
 * examples in `examples/malaysia/war-pack/skills/<slug>/SKILL.md` parse with this parser
 * too:
 *
 *   ---
 *   name: analisis-data                  (the slug; agentskills.io rules apply)
 *   description: >-                      (folded scalar; what the skill does AND when to use it)
 *     ...
 *   license: MIT
 *   compatibility: "..."
 *   metadata:
 *     openbot-slug: analisis-data        (round-trips the slug even if `name` was renamed)
 *     openbot-tools: malaysia/ambil_dataset,malaysia/analisis_teks_bm
 *   ---
 *
 *   # Title
 *
 *   ## Bila guna / summary prose (kept verbatim in the body)
 *   ...
 *   ## Arahan
 *   1. ...
 *
 * `## Arahan` is where the store's `instructions` live on export, because the war-pack
 * files use it and because instructions are the part a Bot executes — the rest of the
 * body is documentation a person reads. A file with no `## Arahan` imports its whole
 * body as the instructions, which is the only lossless reading of a file that did not
 * come from us.
 */

import type { SkillRecord } from "./model";

/** agentskills.io: a name is at most 64 characters. */
const NAME_MAX = 64;
/** agentskills.io: a description is at most 1024 characters. */
const DESCRIPTION_MAX = 1024;
/** OpenBot's own slug rule, the same one POST /skills enforces. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

/** The part of a skill row this file renders and parses. `grantedTo` and `ownerUserId` stay behind: who a skill is granted to is deployment state, not skill content. */
export type SkillMdCore = Pick<
  SkillRecord,
  "slug" | "title" | "summary" | "instructions" | "tools"
>;

export type ParsedSkillMd = {
  slug: string;
  title: string;
  summary: string;
  instructions: string;
  tools: string[];
};

/** What went wrong, named for the person holding the file. */
export class SkillMdRefusedError extends Error {}

/**
 * Render one skill row as a SKILL.md document.
 *
 * The front matter is emitted in the agentskills.io field order (name, description,
 * license, compatibility, metadata), the body mirrors the war-pack examples' section
 * structure, and every tool ref lands in BOTH `metadata.openbot-tools` (so an import
 * recovers the declarations without reading prose) and the `## Alat diperlukan` list
 * (so a person reading the file sees them). A skill with no declared tools renders no
 * tool sections at all, rather than an empty list.
 */
export function renderSkillMd(record: SkillMdCore): string {
  const slug = record.slug;
  if (!SLUG_PATTERN.test(slug) || slug.length > NAME_MAX) {
    throw new SkillMdRefusedError(
      `the slug "${slug}" is not a valid agentskills.io name, so it cannot be rendered`,
    );
  }
  const summary = record.summary.trim();
  if (summary.length > DESCRIPTION_MAX) {
    throw new SkillMdRefusedError(
      `the summary is ${summary.length} characters; the agentskills.io description cap is ${DESCRIPTION_MAX}`,
    );
  }

  const descriptionLines = (summary || record.title)
    .split("\n")
    .map((line) => `  ${line.trim()}`);
  const toolLine = record.tools.length
    ? `\n  openbot-tools: ${record.tools.join(",")}`
    : "";

  const toolList = record.tools.length
    ? [
        "",
        "## Alat diperlukan",
        ...record.tools.map((ref) => `- \`${ref}\``),
        "",
        "Rujukan alat di atas ialah pengisytiharan, bukan geran — akses tertakluk kepada dasar kelulusan OpenBot.",
        "",
      ].join("\n")
    : "";

  const sections = [
    "---",
    `name: ${slug}`,
    "description: >-",
    ...descriptionLines,
    "license: MIT",
    `compatibility: "OpenBot — geran alat ditadbir oleh OpenBot, bukan fail ini"`,
    "metadata:",
    `  openbot-slug: ${slug}${toolLine}`,
    "---",
    "",
    `# ${record.title}`,
    "",
    ...(summary ? ["## Bila guna", "", summary, ""] : []),
    "## Arahan",
    "",
    record.instructions.trim(),
    toolList,
  ];
  return sections.join("\n");
}

/**
 * Parse a SKILL.md document back into the fields the store writes.
 *
 * The parser reads exactly what {@link renderSkillMd} writes and the war-pack files
 * write, and nothing more: a line-based front matter reader with folded-scalar support
 * for `description`, one nesting level for `metadata`, and the `## Arahan` split for
 * instructions. Anything the spec allows beyond this — `allowed-tools` lists, nested
 * metadata maps, `assets/` directories — is preserved where it does not matter and
 * refused where it does, rather than half-approximated.
 */
export function parseSkillMd(text: string): ParsedSkillMd {
  const content = text.replace(/\r\n/g, "\n").trim();
  if (!content.startsWith("---")) {
    throw new SkillMdRefusedError("a SKILL.md file starts with a `---` front matter block");
  }
  const end = content.indexOf("\n---", 3);
  if (end < 0) {
    throw new SkillMdRefusedError("the front matter block is never closed with a `---` line");
  }

  const frontMatter = content.slice(3, end).split("\n");
  const body = content.slice(end + 4);

  let name: string | null = null;
  let description = "";
  let descriptionFolded = false;
  let metadataSlug: string | null = null;
  let metadataTools: string[] = [];
  let inMetadata = false;

  for (const raw of frontMatter) {
    const line = raw.replace(/\t/g, "  ");
    if (line.startsWith("  ") || line.startsWith("-")) {
      // Nested lines. Only `metadata`'s two keys are read; anything deeper is ignored
      // rather than misread, which is the safe direction for a file we did not write.
      if (inMetadata) {
        const nested = line.trim();
        const slugMatch = nested.match(/^openbot-slug:\s*(.+)$/);
        if (slugMatch) {
          metadataSlug = slugMatch[1].trim();
          continue;
        }
        const toolsMatch = nested.match(/^openbot-tools:\s*(.+)$/);
        if (toolsMatch) {
          metadataTools = toolsMatch[1]
            .split(",")
            .map((ref) => ref.trim())
            .filter((ref) => ref.includes("/"));
          continue;
        }
      }
      if (descriptionFolded) {
        description += (description ? " " : "") + line.trim();
      }
      continue;
    }
    inMetadata = false;
    descriptionFolded = false;
    const keyMatch = line.match(/^([a-zA-Z-]+):\s*(.*)$/);
    if (!keyMatch) continue;
    const [, key, rest] = keyMatch;
    if (key === "name" && rest.trim()) {
      name = rest.trim();
    } else if (key === "description") {
      if (rest.trim() === ">-" || rest.trim() === ">" || rest.trim() === "|-") {
        description = "";
        descriptionFolded = true;
      } else {
        description = rest.trim().replace(/^"|"$/g, "");
      }
    } else if (key === "metadata") {
      inMetadata = true;
    }
  }

  const slug = metadataSlug ?? name;
  if (!slug) {
    throw new SkillMdRefusedError(
      "the front matter carries no `name` and no `metadata.openbot-slug`, so the skill has no slug",
    );
  }
  if (!SLUG_PATTERN.test(slug)) {
    throw new SkillMdRefusedError(
      `the name "${slug}" is not lower-case letters, numbers and hyphens`,
    );
  }
  if (slug.length > NAME_MAX) {
    throw new SkillMdRefusedError(`the name is longer than ${NAME_MAX} characters`);
  }
  if (!description) {
    throw new SkillMdRefusedError(
      "the agentskills.io spec requires a description — what the skill does and when to use it",
    );
  }
  if (description.length > DESCRIPTION_MAX) {
    throw new SkillMdRefusedError(
      `the description is ${description.length} characters; the cap is ${DESCRIPTION_MAX}`,
    );
  }

  // The body: an H1 title, optional documentation sections, and the instructions.
  // `## Arahan` wins when it is there; the whole body is the fallback, so a foreign
  // skill written as one prose block imports losslessly.
  const withoutHeading = body.replace(/^#\s+.+$/m, "").trim();
  const arahanIndex = withoutHeading.indexOf("## Arahan");
  let instructions: string;
  if (arahanIndex >= 0) {
    instructions = withoutHeading
      .slice(arahanIndex + "## Arahan".length)
      .replace(/^## Alat diperlukan[\s\S]*$/m, "")
      .replace(/^Rujukan alat[\s\S]*$/m, "")
      .trim();
  } else {
    instructions = withoutHeading
      .replace(/^## Alat diperlukan[\s\S]*$/m, "")
      .replace(/^## Bila guna[\s\S]*?(?=^## )/m, "")
      .trim();
  }
  if (!instructions) {
    throw new SkillMdRefusedError("the file carries no instructions to run");
  }

  // The title: the first H1, else the slug. Kept human because it is what every list shows.
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = (titleMatch?.[1] ?? slug).trim();

  return { slug, title, summary: description, instructions, tools: metadataTools };
}
