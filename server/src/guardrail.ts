/**
 * Guardrail: the injection scanner and secret redactor that ride on the untrusted envelope.
 *
 * The envelope (`untrusted-content.ts`) already tells the model that outside content is data, not
 * instructions. That envelope is prose — it asks the model to behave, and a small model under a long
 * page can forget. This layer does not ask: it changes the content itself.
 *
 * Three things, in the order they defend:
 *
 *  1. SCAN. Every piece of outside content that passes through `markUntrusted` or
 *     `withUntrustedNotice` is scanned for instruction-override patterns — the classic "ignore all
 *     previous instructions", "reveal your system prompt", "you are now DAN", the exfiltration verbs
 *     aimed at credentials, and their Malay equivalents. Only outside content is scanned: a person's
 *     own message may legitimately contain these words, and scanning it would be reading their mail.
 *  2. STRIP (strict mode only). The lines that matched are replaced with a marker, so the model
 *     reads `[GUARDRAIL: an instruction-override attempt was removed]` where the attack was. Log mode
 *     keeps the content and writes the hit to the log, so a deployment can measure its false-positive
 *     rate before trusting the strip.
 *  3. REDACT. Known credential shapes (`nvapi-`, `sk-`, `ghp_`, AKIA, Slack tokens, Bearer headers,
 *     database URLs with passwords, `key: value` pairs named key/token/secret/password) are replaced
 *     with `[REDACTED:…]` in every mode but "off", because a secret that never reaches the model's
 *     context is a secret it can never echo back out.
 *
 * The mode comes from `OPENBOT_GUARDRAIL`: "off" | "log" (the default) | "strict". Read per call, so
 * a test can flip it and a hot restart of a container cannot leave a stale value behind.
 *
 * WHAT THIS IS NOT. Not a boundary: the grant and the policy remain the only real boundaries, and a
 * page that wants the model to misbehave can phrase itself outside every regex ever written. This
 * layer exists to make the cheapest attacks cost something, and to leave a log line an operator can
 * search for afterwards. Its failure direction is silence: a pattern this file does not know simply
 * rides through, and the envelope notice is still there to catch it.
 */
export type GuardrailMode = "off" | "log" | "strict";

/** One match: the pattern family that fired, and the line it fired on. */
export type InjectionHit = {
  rule: string;
  line: string;
};

/** Read once per call: the deployment's chosen mode, "log" when unset or malformed. */
export function guardrailMode(): GuardrailMode {
  const raw = (process.env.OPENBOT_GUARDRAIL ?? "").toLowerCase();
  return raw === "off" || raw === "strict" || raw === "log" ? raw : "log";
}

/**
 * Instruction-override patterns. Each names a rule so a log line can say what fired, and the strip
 * can replace the line the attempt sat on. Kept deliberately narrow: a normal web page that merely
 * *discusses* prompt injection should not be mangled, so patterns demand the imperative shape —
 * an imperative verb aimed at the model's own instructions — rather than any mention of the topic.
 */
const RULES: ReadonlyArray<{ rule: string; re: RegExp }> = [
  {
    rule: "override-en",
    re:
      /\b(?:ignore|disregard|forget|override|drop)\b[^.\n!?]{0,48}\b(?:previous|prior|earlier|above|all|other|the)\b[^.\n!?]{0,32}\b(?:instructions?|prompts?|rules?|directions?|guidance)\b/i,
  },
  {
    rule: "override-bm",
    re: /\b(?:abaikan|lupakan|ubah|ganti|buang)\b[^.\n!?]{0,48}\b(?:arahan|peraturan|penerangan|instruksi)\b/i,
  },
  {
    rule: "prompt-extraction",
    re:
      /\b(?:reveal|show|print|repeat|disclose|output|copy|paste|leak)\b[^.\n!?]{0,32}\b(?:your|the|its)\b[^.\n!?]{0,24}\b(?:system\s*prompt|initial\s*prompt|original\s*prompt|system\s*message|instructions|hidden\s*prompt|secret\s*instructions?)\b/i,
  },
  {
    rule: "role-hijack",
    re:
      /\b(?:you\s+are\s+now|from\s+now\s+on\s+you\s+are|act\s+as|pretend\s+to\s+be|become)\b[^.\n!?]{0,60}\b(?:DAN|jailbreak|unrestricted|no\s+rules|without\s+rules|developer\s+mode|god\s+mode|unfiltered)\b/i,
  },
  {
    rule: "mode-unlock",
    re: /\b(?:developer|god|jailbreak|unrestricted)\s+mode\b/i,
  },
  {
    rule: "instruction-rewrite",
    re: /\b(?:new|real|actual|updated|true)\s+(?:instructions?|orders?|directives?)\s*(?:are|:)/i,
  },
  {
    rule: "prompt-redefinition",
    re: /\b(?:system|assistant)\s*(?:prompt|message)\s*[:=]/i,
  },
  {
    rule: "credential-exfiltration-en",
    re:
      /\b(?:exfiltrate|steal|leak|grab|harvest)\b[^.\n!?]{0,48}\b(?:secret|key|token|credential|password|api[-_ ]?key)\b/i,
  },
  {
    rule: "credential-send",
    re:
      /\b(?:email|send|post|upload|forward|submit)\b[^.\n!?]{0,64}\b(?:api[-_ ]?key|secret|token|credential|password|env(?:ironment)?\s*(?:file|vars?))\b/i,
  },
  {
    rule: "encoded-payload",
    re:
      /\b(?:decode|decrypt)\s+(?:the\s+)?(?:following|this|next)\b[^.\n!?]{0,48}\b(?:and\s+)?(?:follow|execute|obey|run|do)\b/i,
  },
  {
    rule: "end-marker-forgery",
    re: /\bend\s+of\s+(?:system|instructions?|prompt)\b/i,
  },
];

/** The marker a stripped line leaves behind, in strict mode. */
const STRIP_MARKER = "[GUARDRAIL: an instruction-override attempt was removed from this content]";

/**
 * Scan outside content for instruction-override attempts.
 *
 * Line-by-line so a strip can remove the sentence without touching the rest, and so a log can quote
 * only the line that fired — never the whole page.
 */
export function scanForInjection(content: string): InjectionHit[] {
  const hits: InjectionHit[] = [];
  const seen = new Set<string>();
  for (const line of content.split("\n")) {
    if (!line) continue;
    for (const { rule, re } of RULES) {
      if (re.test(line)) {
        const key = `${rule}\u0000${line}`;
        if (!seen.has(key)) {
          seen.add(key);
          hits.push({ rule, line: line.trim().slice(0, 160) });
        }
        break;
      }
    }
  }
  return hits;
}

/**
 * Remove the matched spans the scan flagged, leaving the rest of every line intact.
 *
 * A page that quotes an attack ("articles say 'ignore all previous instructions'") is prose, not an
 * attack: a match that sits inside quotation marks on its line stays — quoted mentions are how
 * normal pages *discuss* prompt injection, and mangling them would be the guardrail editing the
 * record. A match outside quotes takes the rest of its line with it — the span is the attack's
 * opening and the line's tail is its payload — so the marker names the removal where it was.
 */
export function stripInjectionAttempts(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      for (const { re } of RULES) {
        re.lastIndex = 0;
        const match = re.exec(line);
        if (!match) continue;
        const before = line.slice(0, match.index);
        // Straight and curly quotes toggle: an odd count before the match means the match sits
        // inside a quotation — prose about attacks, not an attack — so it stays.
        const ketuk = (before.match(/["'\u201c\u2018\u201d\u2019]/g) ?? []).length;
        if (ketuk % 2 === 1) continue;
        // The matched span is the attack's opening; the rest of the line is its payload. Drop the
        // tail too — the marker names what was removed, where it was.
        return line.slice(0, match.index) + STRIP_MARKER;
      }
      return line;
    })
    .join("\n");
}

/**
 * Credential shapes, redacted in place.
 *
 * Value-preserving of nothing: the redaction replaces the whole secret, keeping only a tag that says
 * which shape was removed. `postgres://user:pass@host` keeps its user and host — a connection target
 * is often the interesting fact, and the password is the secret.
 */
const SECRET_REDACTIONS: ReadonlyArray<{ re: RegExp; tag: string }> = [
  { re: /\bnvapi-[A-Za-z0-9_-]{20,}\b/g, tag: "nvapi-key" },
  { re: /\bsk-[A-Za-z0-9_-]{20,}\b/g, tag: "openai-style-key" },
  { re: /\bghp_[A-Za-z0-9]{20,}\b/g, tag: "github-token" },
  { re: /\bAKIA[0-9A-Z]{16}\b/g, tag: "aws-access-key" },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, tag: "slack-token" },
  { re: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/g, tag: "bearer-token" },
  { re: /(postgres(?:ql)?:\/\/[^:\s"']+?:)[^@\s"']+(@)/g, tag: "database-password" },
  {
    re: /\b(api[_-]?key|token|secret|password)(['"]?\s*[:=]\s*['"]?)[A-Za-z0-9._+/=-]{16,}/gi,
    tag: "named-secret-value",
  },
];

export function redactSecrets(content: string): string {
  let out = content;
  for (const { re, tag } of SECRET_REDACTIONS) {
    out = out.replace(re, `[REDACTED:${tag}]`);
  }
  return out;
}

/** What the guardrail decided about one piece of outside content. Kept small, for the log. */
export type GuardrailVerdict = {
  mode: GuardrailMode;
  hits: InjectionHit[];
  redacted: boolean;
  content: string;
};

/**
 * Apply the guardrail to a piece of outside content, in the deployment's mode.
 *
 * "off" — nothing. "log" — scan, log what fired, redact secrets, leave the prose alone. "strict" —
 * scan, log, redact, and strip the flagged lines. The log line carries the source, the rule names
 * and the first flagged line, truncated — enough to search by, never the whole page.
 */
export function guardrailApply(content: string, source: string): GuardrailVerdict {
  const mode = guardrailMode();
  if (mode === "off") return { mode, hits: [], redacted: false, content };
  const hits = scanForInjection(content);
  if (hits.length > 0) {
    console.error(
      JSON.stringify({
        type: "guardrail-injection",
        mode,
        source: source.slice(0, 120),
        rules: [...new Set(hits.map((hit) => hit.rule))],
        firstLine: hits[0].line,
        total: hits.length,
        timestamp: new Date().toISOString(),
      }),
    );
  }
  let out = content;
  let redacted = false;
  const before = out;
  out = redactSecrets(out);
  redacted = out !== before;
  if (mode === "strict" && hits.length > 0) {
    out = stripInjectionAttempts(out);
  }
  return { mode, hits, redacted, content: out };
}

/**
 * One boot-time line, so the logs say what is standing: the mode and how many patterns are armed.
 * Called from the app's boot, not at import, so a test import stays quiet.
 */
export function guardrailBootLine(): string {
  const mode = guardrailMode();
  return mode === "off"
    ? `guardrail: MATI (OPENBOT_GUARDRAIL=off) - envelope sahaja bertahan`
    : `guardrail: aktif (aras ${mode}, ${RULES.length} corak injeksi, ${SECRET_REDACTIONS.length} corak rahsia)`;
}
