import { currentEdition } from "../../edition";
import { PluginRefusedError } from "../store";
import { parseSkillMd, renderSkillMd, SkillMdRefusedError } from "../plugin-store/skill-md";
import type { PluginRouteContext } from "./context";

/** Writing and deleting skills. */
export function mountSkillRoutes({
  routes,
  store,
  requireUser,
  actorEmail,
  skillActor,
  skillRefusal,
}: PluginRouteContext) {
  /**
   * Write a skill.
   *
   * Not admin-only. A skill is an instruction, not a capability: it can only ask a
   * Bot to use tools that Bot was already granted, and every one of those calls is still decided,
   * policy-checked and audited. Adding an MCP server is the opposite, and stays an administrator's.
   *
   * A person's skill is their own. `global` writes one for the whole deployment, which an
   * administrator may do and nobody else.
   */
  routes.post("/skills", requireUser, async (context) => {
    const body = (await context.req.json().catch(() => null)) as {
      slug?: unknown;
      title?: unknown;
      summary?: unknown;
      instructions?: unknown;
      global?: boolean;
      tools?: unknown;
    } | null;
    /*
     * The body is JSON, so the annotations are wishes: `{"slug":123}` passes a truthiness
     * check and `RegExp.test` then coerces it to `"123"`, and `{"summary":{}}` reaches the
     * store where the insert throws a 500. A slug, a title and instructions are non-empty
     * strings here, and a summary is absent or a string. Anything else is a 400 before
     * any refusal check, store write, or audit row.
     */
    if (
      typeof body?.slug !== "string" ||
      typeof body?.title !== "string" ||
      !body.title.trim() ||
      typeof body?.instructions !== "string" ||
      !body.instructions.trim()
    ) {
      return context.json(
        { error: "A slug, a title and instructions are required." },
        400,
      );
    }
    if (!/^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/.test(body.slug)) {
      return context.json(
        { error: "A slug is lower-case letters, numbers and hyphens." },
        400,
      );
    }
    if (body.summary !== undefined && typeof body.summary !== "string") {
      return context.json(
        { error: "A summary is text when it is present." },
        400,
      );
    }

    const actor = skillActor(context);
    if (body.global && !actor.isAdmin) {
      return context.json(
        { error: "Only an admin can write a skill for everyone." },
        403,
      );
    }

    // Editing an existing slug, which is what a repeated save is, needs the right to edit that
    // skill. Without this, saving over somebody else's name would silently take it.
    const refusal = await skillRefusal(context, body.slug);
    if (refusal) return context.json({ error: refusal }, 403);

    /*
     * Absent leaves the declarations alone, so a caller that predates this field does not silently
     * clear one. An array, including an empty one, says what the skill needs now.
     *
     * Every entry must be a non-empty string: silently dropping mistyped entries would turn a
     * client bug into a skill that declares nothing and answers success. `global` must be a
     * boolean when present, so the string `"yes"` cannot create a deployment-wide skill.
     */
    if (body.global !== undefined && typeof body.global !== "boolean") {
      return context.json(
        { error: "Global must be true or false when it is present." },
        400,
      );
    }
    if (body.tools !== undefined) {
      if (
        !Array.isArray(body.tools) ||
        body.tools.some((ref) => typeof ref !== "string" || !ref.trim())
      ) {
        return context.json(
          { error: "Tools are a list of serverId/toolName references." },
          400,
        );
      }
    }
    const tools = Array.isArray(body.tools)
      ? (body.tools as string[]).map((ref) => ref.trim())
      : undefined;

    /*
     * FOR EVERYBODY ONLY WHERE THERE IS SOMEBODY ELSE. The personal edition has one person, and its
     * Settings > Skills is the page Admin > Skills is, so it saves with `global` too. Stored as
     * nobody's, the skill was missing from everything that lists the person's own, such as a Bot's
     * "Your skills". There it is the person's. Existing rows are given to them at startup
     * (`ensurePersonalSkillsOwned`).
     */
    const forEverybody =
      body.global === true && currentEdition() !== "personal";

    try {
      await store.installSkill({
        slug: body.slug,
        title: body.title.trim(),
        summary: body.summary ?? "",
        instructions: body.instructions.trim(),
        ownerUserId: forEverybody ? null : actor.id,
        ...(tools === undefined ? {} : { tools }),
        by: actorEmail(context),
      });
    } catch (error) {
      // A ref naming no tool this deployment has seen. Answered rather than thrown, because it is
      // something the person writing the skill can fix and the message says what to fix.
      if (error instanceof PluginRefusedError) {
        return context.json({ error: error.message }, 400);
      }
      throw error;
    }
    return context.json({ skills: await store.listSkills(actor) });
  });

  routes.delete("/skills/:slug", requireUser, async (context) => {
    const slug = context.req.param("slug");
    const refusal = await skillRefusal(context, slug);
    if (refusal) return context.json({ error: refusal }, 403);

    await store.uninstallSkill(slug, actorEmail(context));
    return context.json({ ok: true });
  });

  /*
   * Export one skill as a SKILL.md document — the Agent Skills format
   * (agentskills.io) that Claude, skills.sh, ClawHub and Composio read.
   *
   * Reading, not writing, and a skill is an instruction rather than a capability, so
   * this carries no new authority: everything in the document is text the person could
   * already read through GET /api/plugins. The slug that does not exist answers 404 —
   * a missing skill is a different answer from a refusal to render one.
   */
  routes.get("/skills/:slug/skill.md", requireUser, async (context) => {
    const slug = context.req.param("slug");
    const skill = (await store.listSkills(skillActor(context))).find(
      (record) => record.slug === slug,
    );
    if (!skill) {
      return context.json({ error: "No such skill." }, 404);
    }
    let markdown: string;
    try {
      markdown = renderSkillMd(skill);
    } catch (error) {
      if (error instanceof SkillMdRefusedError) {
        return context.json({ error: error.message }, 409);
      }
      throw error;
    }
    return new Response(markdown, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `inline; filename="${slug}.SKILL.md"`,
      },
    });
  });

  /*
   * Import a SKILL.md document as a skill.
   *
   * Same authority as POST /skills — a skill is an instruction, not a capability — so
   * the same non-admin rule, the same global gate and the same audit apply. The parsed
   * slug, title, summary and instructions feed the same installSkill the JSON route
   * calls; tool declarations come from the document's `metadata.openbot-tools` unless
   * the caller overrides them, and every ref is validated by the store exactly as the
   * JSON route's are.
   */
  routes.post("/skills/import", requireUser, async (context) => {
    const body = (await context.req.json().catch(() => null)) as {
      content?: unknown;
      global?: boolean;
      tools?: unknown;
    } | null;
    if (typeof body?.content !== "string" || !body.content.trim()) {
      return context.json({ error: "A SKILL.md document is required." }, 400);
    }
    if (body.global !== undefined && typeof body.global !== "boolean") {
      return context.json({ error: "Global must be true or false when it is present." }, 400);
    }

    let parsed;
    try {
      parsed = parseSkillMd(body.content);
    } catch (error) {
      if (error instanceof SkillMdRefusedError) {
        return context.json({ error: error.message }, 400);
      }
      throw error;
    }

    const actor = skillActor(context);
    if (body.global && !actor.isAdmin) {
      return context.json({ error: "Only an admin can write a skill for everyone." }, 403);
    }
    const refusal = await skillRefusal(context, parsed.slug);
    if (refusal) return context.json({ error: refusal }, 403);

    // An explicit list wins over the document's declarations, so a caller can import a
    // file and retarget its tools without editing the text.
    const tools = Array.isArray(body.tools)
      ? (body.tools as unknown[]).filter(
          (ref): ref is string => typeof ref === "string" && Boolean(ref.trim()),
        )
      : parsed.tools;

    try {
      await store.installSkill({
        slug: parsed.slug,
        title: parsed.title,
        summary: parsed.summary,
        instructions: parsed.instructions,
        ownerUserId: body.global === true && currentEdition() !== "personal" ? null : actor.id,
        ...(tools.length ? { tools } : {}),
        by: actorEmail(context),
      });
    } catch (error) {
      if (error instanceof PluginRefusedError) {
        return context.json({ error: error.message }, 400);
      }
      throw error;
    }
    return context.json({ skills: await store.listSkills(actor) });
  });
}
