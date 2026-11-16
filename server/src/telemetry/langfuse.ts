/**
 * Langfuse trace export: one span per headless turn, over OTLP/HTTP, when a deployment asks.
 *
 * Tracing is a port, not a dependency. The toolkit runs turns without the server, so a turn takes
 * what it needs as `traceTurn` (toolkit/run-turn.ts's `TurnSpan`), and this module is the
 * server-side implementation: a `BasicTracerProvider` with one batch processor exporting OTLP/HTTP
 * protobuf to Langfuse's OpenTelemetry endpoint, which Langfuse renders as traces on its own UI.
 *
 * Configured with Langfuse's own variables — `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`,
 * `LANGFUSE_BASE_URL` — and off unless all three are set, or until `OPENBOT_OTEL_EXPORT=off` turns
 * the export off with them still configured, the same kill-switch the audit stream above
 * (telemetry/otel.ts) answers to. Disabled means nothing is constructed and the span helpers
 * answer a no-op: an unset deployment pays nothing at boot, and a span helper never throws.
 *
 * Attributes are identifiers and outcomes only — agent, thread, run, outcome, duration. Nothing a
 * person said reaches a span; the conversation stays in the transcript, as the audit exporter's
 * scrubbing already keeps it out of the SIEM.
 *
 * Never fatal. An unreachable Langfuse drops spans after the SDK's own retries, and the server
 * keeps answering.
 */
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BasicTracerProvider,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-base";

/** What a span carries, and nothing else. */
export type TurnSpanAttributes = Record<string, string | number | boolean>;

/**
 * The span itself, as the toolkit's port states it: one attribute at a time, then one end. The
 * no-op answers both calls and forgets.
 */
export type TurnSpanLike = {
  setAttribute: (key: string, value: string | number | boolean) => void;
  end: () => void;
};

export type LangfuseTracing = {
  /** One span per turn, started now: the `traceTurn` port `createTurnRunner` takes. */
  turnSpan: (name: string, attributes: TurnSpanAttributes) => TurnSpanLike;
  /** Attributes onto a span already started, then end it. Safe on the no-op span too. */
  endTurnSpan: (span: TurnSpanLike, attributes: TurnSpanAttributes) => void;
  /** Send whatever the batch still holds. Never rejects. */
  flush: () => Promise<void>;
  /** Flush and stop. Never rejects. */
  shutdown: () => Promise<void>;
};

/** Whether the environment names Langfuse and has not switched the export off. */
export function langfuseConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.OPENBOT_OTEL_EXPORT?.trim().toLowerCase() === "off") return false;
  return Boolean(
    env.LANGFUSE_PUBLIC_KEY?.trim() &&
      env.LANGFUSE_SECRET_KEY?.trim() &&
      env.LANGFUSE_BASE_URL?.trim(),
  );
}

/** A span nothing records, for a deployment without the export or a tracer that refused. */
export const noopTurnSpan: TurnSpanLike = {
  setAttribute: () => {},
  end: () => {},
};

/** One span, started now; the no-op when `tracing` is absent, so callers need no branch. */
export function startTurnSpan(
  tracing: LangfuseTracing | undefined,
  name: string,
  attributes: TurnSpanAttributes,
): TurnSpanLike {
  return tracing?.turnSpan(name, attributes) ?? noopTurnSpan;
}

/** Attributes onto a span already started, then end it — the no-op included. */
export function endTurnSpan(
  span: TurnSpanLike,
  attributes: TurnSpanAttributes,
): void {
  for (const [key, value] of Object.entries(attributes))
    span.setAttribute(key, value);
  span.end();
}

export function createLangfuseTracing(
  env: Record<string, string | undefined> = process.env,
): LangfuseTracing | undefined {
  if (!langfuseConfigured(env)) return undefined;
  const publicKey = env.LANGFUSE_PUBLIC_KEY?.trim() ?? "";
  const secretKey = env.LANGFUSE_SECRET_KEY?.trim() ?? "";
  const baseUrl = env.LANGFUSE_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
  if (!publicKey || !secretKey || !baseUrl) return undefined;
  const exporter = new OTLPTraceExporter({
    url: `${baseUrl}/api/public/otel/v1/traces`,
    headers: {
      Authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`,
    },
    timeoutMillis: 10_000,
  });
  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({
      "service.name": env.OTEL_SERVICE_NAME?.trim() || "openbot",
    }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
  const tracer = provider.getTracer("openbot");
  return {
    turnSpan(name, attributes) {
      try {
        const span = tracer.startSpan(name, { attributes });
        return {
          setAttribute: (key, value) => {
            try {
              span.setAttribute(key, value);
            } catch {
              // Tracing never breaks a turn.
            }
          },
          end: () => {
            try {
              span.end();
            } catch {
              // Nor its end.
            }
          },
        };
      } catch {
        return noopTurnSpan;
      }
    },
    endTurnSpan,
    flush: () => provider.forceFlush().catch(() => undefined),
    shutdown: () => provider.shutdown().catch(() => undefined),
  };
}
