/**
 * A minimal stand-in for the CopilotKit Intelligence platform, for running
 * OpenBot where no Intelligence deployment exists.
 *
 * What it serves, in the shape the runtime and the app's Phoenix clients use:
 *  - REST for the runtime client: entitlements, threads, thread messages,
 *    thread locks (acquire, renew, release).
 *  - Phoenix WebSocket for the runner (`/runner/websocket`, topic
 *    `ingestion:<runId>`) and the browser's client socket
 *    (`/client/websocket`, topic `thread:<threadId>`), relaying AG-UI events
 *    from a run to whoever watches the thread.
 *  - Replay: a client joining in `connect` mode gets a messages snapshot, the
 *    recorded events, `replay_complete`, and `stream_idle`.
 *  - The project-key Learning API (`/api/v1/learning/...`) the runtime's
 *    Learning sweep, auto-assign and review client call: containers, runs,
 *    and the learned-skills ZIP snapshot. Containers are created on first
 *    read; a started run advances to `succeeded` on its own after a few
 *    seconds, with zero candidates - there is no evidence pipeline here to
 *    mine, so an empty run is the honest outcome.
 *
 * Everything is in memory and restarts empty, which is the right size for a
 * demo: durable history across restarts is a platform concern this stand-in
 * does not carry.
 */
const PORT = Number.parseInt(process.env.INTELLIGENCE_MOCK_PORT ?? "19099", 10);

type Message = { id: string; role: string; [key: string]: unknown };
type AgUiEvent = Record<string, unknown>;

type ThreadRecord = {
  id: string;
  name?: string;
  agentId?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
};

type RunRecord = { threadId: string; joinToken: string };

const threads = new Map<string, ThreadRecord>();
const threadEvents = new Map<string, AgUiEvent[]>();
const threadMessages = new Map<string, Message[]>();
const runs = new Map<string, RunRecord>();
const activeRunByThread = new Map<string, string>();
const joinedTopicsBySocket = new Map<unknown, Set<string>>();
const socketsByTopic = new Map<string, Set<unknown>>();

let socketSeq = 0;

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

const notFound = () => json({ error: "ROUTE_NOT_FOUND" }, 404);

/* --------------------------------------------------------------------- */
/* Learning: containers, runs, and the learned-skills snapshot.          */
/* Wire contracts mirror Intelligence's project-key Learning API:        */
/* {error: {code, retryable}} refusals, container/run objects that the   */
/* runtime client's schemas parse, and a ZIP snapshot with revision +    */
/* ETag headers the learned-skills reader accepts.                       */
/* --------------------------------------------------------------------- */

type LearningContainer = {
  id: string;
  name: string;
  projectId: number;
  promptContext: string | null;
  createdAt: string;
  updatedAt: string;
};

type LearningRun = {
  id: string;
  learningContainerId: string;
  projectId: number;
  status: "queued" | "freezing" | "batching" | "reducing" | "finalizing" | "succeeded" | "failed";
  triggerSource: "automatic" | "manual";
  attemptCount: number;
  candidateCount: number | null;
  insightCount: number | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failureCode: string | null;
  kubernetesJobName: string | null;
};

const learningContainers = new Map<string, LearningContainer>();
const learningRunsByContainer = new Map<string, LearningRun[]>();

// A stored (uncompressed) ZIP holding one README entry: the empty learned-
// skills snapshot. Skills arrive with a real evidence pipeline, not here.
const LEARNED_SKILLS_SNAPSHOT_ZIP = Buffer.from(
  "UEsDBBQAAAAAAAZvcF3IUbXMYAAAAGAAAAAJAAAAUkVBRE1FLm1kIyBMZWFybmVkIHNraWxscwoKTm8gbGVhcm5lZCBza2lsbHMgeWV0LiBTa2lsbHMgYXBwZWFyIGhlcmUgYWZ0ZXIgYSBMZWFybmluZyBydW4gcHJvZHVjZXMgdGhlbS4KUEsBAhQDFAAAAAAABm9wXchRtcxgAAAAYAAAAAkAAAAAAAAAAAAAAIABAAAAAFJFQURNRS5tZFBLBQYAAAAAAQABADcAAACHAAAAAAA=",
  "base64",
);
const LEARNED_SKILLS_REVISION = "rev-00000001";
const LEARNED_SKILLS_ETAG = `"00763d7d94b5af1cdded81fbe71e3a4faf1aedcf639b61103922b9d7ce9baf71"`;

function learningContainer(id: string): LearningContainer {
  let container = learningContainers.get(id);
  if (!container) {
    container = {
      id,
      name: id === "openbot" ? "OpenBot Learning" : id,
      projectId: 1,
      promptContext: null,
      createdAt: now(),
      updatedAt: now(),
    };
    learningContainers.set(id, container);
  }
  return container;
}

function learningRuns(id: string): LearningRun[] {
  let list = learningRunsByContainer.get(id);
  if (!list) {
    list = [];
    learningRunsByContainer.set(id, list);
  }
  return list;
}

/** The Learning routes are keyed the way Intelligence's are: the bearer key
 * must be the deployment's own project key (CPK_INTELLIGENCE_API_KEY). The
 * mock is loopback-only, so the check is a formality - but the shape of the
 * refusal matches the platform, so a misconfigured deployment reads as one. */
function learningAuthorized(request: Request): boolean {
  const expected = process.env.CPK_INTELLIGENCE_API_KEY;
  if (!expected) return true; // No key configured: the loopback stand-in trusts itself.
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

const learningRefusal = (status: number, code: string) =>
  json({ error: { code, retryable: false } }, status);

/** A started run walks the queue on its own so `listLearningRuns` shows a
 * completed run the sweep's next pass treats as finished. There is no
 * evidence to mine, so the run succeeds with zero candidates. */
function startLearningRun(containerId: string): LearningRun {
  const run: LearningRun = {
    id: crypto.randomUUID(),
    learningContainerId: containerId,
    projectId: 1,
    status: "queued",
    triggerSource: "automatic",
    attemptCount: 1,
    candidateCount: null,
    insightCount: null,
    createdAt: now(),
    updatedAt: now(),
    startedAt: null,
    completedAt: null,
    failureCode: null,
    kubernetesJobName: null,
  };
  learningRuns(containerId).unshift(run);
  const advance = () => {
    run.updatedAt = now();
    if (run.status === "queued") {
      run.status = "batching";
      run.startedAt = now();
      setTimeout(advance, 1_500);
      return;
    }
    if (run.status === "batching") {
      run.status = "succeeded";
      run.candidateCount = 0;
      run.insightCount = 0;
      run.completedAt = now();
    }
  };
  setTimeout(advance, 1_500);
  return run;
}

const LEARNING_CONTAINER_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function handleLearning(request: Request, url: URL): Promise<Response | undefined> {
  if (!url.pathname.startsWith("/api/v1/learning/")) return undefined;
  if (!learningAuthorized(request)) return learningRefusal(401, "AUTHENTICATION_FAILED");
  const parts = url.pathname.split("/").filter(Boolean);
  // ["api", "v1", "learning", "containers", id, rest?]
  if (parts[3] !== "containers") return learningRefusal(404, "ROUTE_NOT_FOUND");
  const containerId = parts[4] ?? "";
  const rest = parts.slice(5).join("/");
  if (!LEARNING_CONTAINER_ID.test(containerId)) return learningRefusal(404, "CONTAINER_NOT_FOUND");

  if (!rest && request.method === "GET") {
    return json({ container: learningContainer(containerId) });
  }

  if (rest === "runs" && request.method === "GET") {
    return json({ runs: learningRuns(containerId).slice(0, 100) });
  }

  if (rest === "runs" && request.method === "POST") {
    return json({ run: startLearningRun(containerId) });
  }

  if (rest === "skills" && request.method === "GET") {
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === LEARNED_SKILLS_ETAG) {
      return new Response(null, {
        status: 304,
        headers: {
          "X-CopilotKit-Skills-Revision": LEARNED_SKILLS_REVISION,
          ETag: LEARNED_SKILLS_ETAG,
        },
      });
    }
    return new Response(new Uint8Array(LEARNED_SKILLS_SNAPSHOT_ZIP), {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "X-CopilotKit-Skills-Revision": LEARNED_SKILLS_REVISION,
        ETag: LEARNED_SKILLS_ETAG,
      },
    });
  }

  if (rest === "candidates" && request.method === "GET") return json({ candidates: [] });

  return learningRefusal(404, "ROUTE_NOT_FOUND");
}

/** The containers list the container-picker and ensure-container reads. */
async function handleLearningList(request: Request, url: URL): Promise<Response | undefined> {
  if (url.pathname !== "/api/v1/learning/containers" || request.method !== "GET") return undefined;
  if (!learningAuthorized(request)) return learningRefusal(401, "AUTHENTICATION_FAILED");
  return json({ containers: [...learningContainers.values()], nextCursor: null });
}

function now() {
  return new Date().toISOString();
}

/* --------------------------------------------------------------------- */
/* Messages, built incrementally from the AG-UI events a run produces.   */
/* --------------------------------------------------------------------- */

function messagesFor(threadId: string): Message[] {
  let list = threadMessages.get(threadId);
  if (!list) {
    list = [];
    threadMessages.set(threadId, list);
  }
  return list;
}

function applyEventToMessages(threadId: string, event: AgUiEvent) {
  const list = messagesFor(threadId);
  const type = event.type as string;
  const messageId = event.messageId as string | undefined;
  const toolCallId = event.toolCallId as string | undefined;

  const upsert = (id: string, patch: Partial<Message>) => {
    let message = list.find((candidate) => candidate.id === id);
    if (!message) {
      message = { id, role: "assistant" };
      list.push(message);
    }
    Object.assign(message, patch);
    return message;
  };

  switch (type) {
    case "TEXT_MESSAGE_START": {
      if (messageId) upsert(messageId, { role: (event.role as string) ?? "assistant", content: "" });
      break;
    }
    case "TEXT_MESSAGE_CONTENT": {
      if (messageId) {
        const message = upsert(messageId, {});
        message.content = `${(message.content as string) ?? ""}${(event.delta as string) ?? ""}`;
      }
      break;
    }
    case "TOOL_CALL_START": {
      if (toolCallId) {
        const message = upsert(toolCallId, { role: "assistant" });
        const toolCalls = (message.tool_calls as Array<Record<string, unknown>>) ?? [];
        toolCalls.push({
          id: toolCallId,
          type: "function",
          function: { name: (event.toolCallName as string) ?? "", arguments: "" },
        });
        message.tool_calls = toolCalls;
      }
      break;
    }
    case "TOOL_CALL_ARGS": {
      if (toolCallId) {
        const message = upsert(toolCallId, {});
        const toolCalls = (message.tool_calls as Array<Record<string, unknown>>) ?? [];
        const call = toolCalls[toolCalls.length - 1];
        if (call?.function)
          call.function.arguments = `${((call.function as { arguments?: string }).arguments ?? "")}${(event.delta as string) ?? ""}`;
      }
      break;
    }
    case "RUN_STARTED": {
      const input = event.input as { messages?: Message[] } | undefined;
      for (const message of input?.messages ?? []) {
        if (message?.id && !list.some((candidate) => candidate.id === message.id))
          list.push(message);
      }
      break;
    }
    default:
      break;
  }
}

/* --------------------------------------------------------------------- */
/* Event recording and fan-out.                                          */
/* --------------------------------------------------------------------- */

function eventsFor(threadId: string): AgUiEvent[] {
  let list = threadEvents.get(threadId);
  if (!list) {
    list = [];
    threadEvents.set(threadId, list);
  }
  return list;
}

function broadcast(topic: string, event: string, payload: unknown) {
  const sockets = socketsByTopic.get(topic);
  if (!sockets) return;
  const frame = JSON.stringify([null, null, topic, event, payload]);
  for (const socket of sockets) {
    try {
      socket.send(frame);
    } catch {
      // A socket that fails to write is closing; its close handler cleans up.
    }
  }
}

function runnerEvent(threadId: string, event: AgUiEvent) {
  eventsFor(threadId).push(event);
  applyEventToMessages(threadId, event);
  broadcast(`thread:${threadId}`, "ag_ui_event", event);
}

/* --------------------------------------------------------------------- */
/* Phoenix helpers.                                                      */
/* --------------------------------------------------------------------- */

function reply(socket: unknown, joinRef: unknown, ref: unknown, topic: string, status: string, response: unknown = {}) {
  socket.send(JSON.stringify([joinRef, ref, topic, "phx_reply", { status, response }]));
}

function pushTo(socket: unknown, topic: string, event: string, payload: unknown) {
  socket.send(JSON.stringify([null, null, topic, event, payload]));
}

function joinedTopics(socket: unknown): Set<string> {
  let set = joinedTopicsBySocket.get(socket);
  if (!set) {
    set = new Set();
    joinedTopicsBySocket.set(socket, set);
  }
  return set;
}

function handlePhoenixFrame(socket: unknown, raw: string, isRunner: boolean) {
  let frame: unknown[];
  try {
    frame = JSON.parse(raw) as unknown[];
  } catch {
    return;
  }
  const [joinRef, ref, topic, event, payload] = frame as [unknown, unknown, string, string, Record<string, unknown>];
  if (!topic) return;

  switch (event) {
    case "phx_join": {
      joinedTopics(socket).add(topic);
      let sockets = socketsByTopic.get(topic);
      if (!sockets) {
        sockets = new Set();
        socketsByTopic.set(topic, sockets);
      }
      sockets.add(socket);
      reply(socket, joinRef, ref, topic, "ok", {});

      const threadId = topic.startsWith("thread:") ? topic.slice(7) : undefined;
      if (!isRunner && threadId) {
        const params = (payload ?? {}) as Record<string, unknown>;
        if (params.stream_mode === "connect") {
          // A restored transcript: snapshot, the recorded events, then the
          // control pair the client waits on. A join in "run" mode gets
          // nothing here - its stream must open with RUN_STARTED.
          const snapshot = threadMessages.get(threadId) ?? [];
          if (snapshot.length > 0)
            pushTo(socket, topic, "ag_ui_event", { type: "MESSAGES_SNAPSHOT", messages: snapshot });
          for (const recorded of eventsFor(threadId)) pushTo(socket, topic, "ag_ui_event", recorded);
          pushTo(socket, topic, "replay_complete", {});
          pushTo(socket, topic, "stream_idle", {});
        }
      }
      break;
    }
    case "phx_leave": {
      joinedTopics(socket).delete(topic);
      socketsByTopic.get(topic)?.delete(socket);
      reply(socket, joinRef, ref, topic, "ok", {});
      break;
    }
    case "heartbeat": {
      reply(socket, joinRef, ref, topic ?? "phoenix", "ok", {});
      break;
    }
    case "event":
    case "events": {
      // Runner side: one AG-UI event, or a batch of them.
      const batch = event === "events" ? ((payload?.events as AgUiEvent[]) ?? []) : [payload as AgUiEvent];
      for (const one of batch) {
        const threadId = (one?.threadId ?? one?.thread_id) as string | undefined;
        if (threadId) runnerEvent(threadId, one);
      }
      reply(socket, joinRef, ref, topic, "ok", {});
      break;
    }
    case "stop_run": {
      // A browser's Stop: relay it to the run's runner the way the gateway does.
      reply(socket, joinRef, ref, topic, "ok", {});
      const threadId = topic.startsWith("thread:") ? topic.slice(7) : undefined;
      const runId = (payload?.run_id as string | undefined) ?? activeRunByThread.get(threadId ?? "");
      if (threadId && runId) {
        activeRunByThread.delete(threadId);
        broadcast(`ingestion:${runId}`, "ag-ui", { type: "CUSTOM", name: "stop" });
      }
      break;
    }
    default: {
      // Unknown push: acknowledge so the sender does not wait for a timeout.
      if (ref !== undefined && ref !== null) reply(socket, joinRef, ref, topic, "ok", {});
      break;
    }
  }
}

/* --------------------------------------------------------------------- */
/* REST.                                                                 */
/* --------------------------------------------------------------------- */

async function handleRest(request: Request, url: URL): Promise<Response | undefined> {
  const path = url.pathname;
  const body = request.method === "GET" || request.method === "DELETE"
    ? {}
    : ((await request.json().catch(() => ({}))) as Record<string, unknown>);

  if (path === "/api/entitlements/runtime" && request.method === "GET") {
    return json({
      status: "ready",
      entitlement: {
        active: true,
        source: "managedOrgSubscription",
        features: {
          threads: true,
          memory: true,
          memories: true,
          learning: true,
          skills: true,
          inspector: true,
          generative_ui: true,
          channels: true,
        },
        limits: {},
      },
    });
  }

  if (path === "/api/threads" && request.method === "POST") {
    const id = body.threadId as string;
    if (id && threads.has(id)) return json({ error: "THREAD_ALREADY_EXISTS" }, 409);
    const record: ThreadRecord = {
      id: id ?? crypto.randomUUID(),
      name: (body.name as string) ?? undefined,
      agentId: (body.agentId as string) ?? undefined,
      userId: (body.userId as string) ?? undefined,
      createdAt: now(),
      updatedAt: now(),
    };
    if (record.id) threads.set(record.id, record);
    return json({ thread: record });
  }

  if (path === "/api/threads" && request.method === "GET") {
    return json({ threads: [...threads.values()], hasMore: false });
  }

  if (path === "/api/threads/subscribe" && request.method === "POST") {
    return json({ joinToken: crypto.randomUUID(), joinCode: crypto.randomUUID(), expiresAt: now() });
  }

  if (path === "/api/memories/subscribe" && request.method === "POST") {
    return json({ joinToken: crypto.randomUUID(), joinCode: crypto.randomUUID(), expiresAt: now() });
  }

  if (path.startsWith("/api/memories")) {
    if (path === "/api/memories/recall") return json({ memories: [] });
    return json({ memories: [], hasMore: false });
  }

  if (path === "/api/inspector/metadata") return json({ metadata: {} });

  const learning = await handleLearning(request, url);
  if (learning) return learning;
  const learningList = await handleLearningList(request, url);
  if (learningList) return learningList;

  const segments = path.split("/").filter(Boolean);
  // ["api", "threads", id?, rest?]
  if (segments[0] !== "api" || segments[1] !== "threads") return undefined;
  const threadId = segments[2];
  const rest = segments[3];
  if (!threadId) return undefined;

  const existing = threads.get(threadId);

  if (!rest && request.method === "GET") {
    if (!existing) return json({ error: "THREAD_NOT_FOUND" }, 404);
    return json({ thread: existing });
  }

  if (!rest && request.method === "PATCH") {
    if (!existing) return json({ error: "THREAD_NOT_FOUND" }, 404);
    if (typeof body.name === "string") existing.name = body.name;
    existing.updatedAt = now();
    return json({ thread: existing });
  }

  if (!rest && request.method === "DELETE") {
    threads.delete(threadId);
    threadEvents.delete(threadId);
    threadMessages.delete(threadId);
    return new Response(null, { status: 204 });
  }

  if (rest === "messages" && request.method === "GET") {
    const fields = url.searchParams.get("fields");
    const messages = threadMessages.get(threadId) ?? [];
    if (fields === "id") return json({ messages: messages.map((message) => ({ id: message.id })) });
    return json({ messages });
  }

  if (rest === "connect" && request.method === "POST") {
    // The runtime's thread reader announces a thread it is about to read. The
    // platform answers with the thread's durable identity; nothing here needs
    // one, so the record itself is the answer.
    if (!existing) return json({ error: "THREAD_NOT_FOUND" }, 404);
    return json({ thread: existing });
  }

  if (rest === "join-code" && request.method === "GET") {
    if (!existing) return json({ error: "THREAD_NOT_FOUND" }, 404);
    return json({ joinCode: crypto.randomUUID(), expiresAt: now() });
  }

  if (rest === "lock") {
    const runId = ((body.runId as string) ?? url.searchParams.get("runId")) as string | undefined;
    if (request.method === "POST") {
      const token = crypto.randomUUID();
      if (runId) {
        runs.set(runId, { threadId, joinToken: token });
        activeRunByThread.set(threadId, runId);
      }
      return json({ threadId, runId, joinToken: token, ttlSeconds: 60 });
    }
    if (request.method === "PATCH") return json({ ttlSeconds: 60 });
    if (request.method === "DELETE") {
      if (runId) {
        runs.delete(runId);
        if (activeRunByThread.get(threadId) === runId) activeRunByThread.delete(threadId);
      }
      return new Response(null, { status: 204 });
    }
  }

  if (rest === "events" || rest === "state") {
    if (rest === "events") return json({ events: eventsFor(threadId) });
    const snapshot = threadMessages.get(threadId);
    return json(
      snapshot && snapshot.length > 0
        ? { kind: "snapshot", state: {}, messages: snapshot }
        : { kind: "empty" },
    );
  }

  return undefined;
}

/* --------------------------------------------------------------------- */
/* Server.                                                               */
/* --------------------------------------------------------------------- */

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 255,
  async fetch(request, server) {
    const url = new URL(request.url);

    if (
      (url.pathname === "/client/websocket" || url.pathname === "/runner/websocket") &&
      request.headers.get("upgrade")?.toLowerCase() === "websocket"
    ) {
      const role = url.pathname.startsWith("/runner") ? "runner" : "client";
      const upgraded = server.upgrade(request, { data: { role, id: ++socketSeq } });
      if (upgraded) return undefined as unknown as Response;
      return new Response("upgrade failed", { status: 400 });
    }

    try {
      const answered = await handleRest(request, url);
      return answered ?? notFound();
    } catch (error) {
      console.error("[cpk-intelligence-mock]", request.method, path0(url), error);
      return json({ error: "INTERNAL" }, 500);
    }

    function path0(u: URL) {
      return u.pathname;
    }
  },
  websocket: {
    open() {},
    message(socket, raw) {
      handlePhoenixFrame(socket, String(raw), socket.data?.role === "runner");
    },
    close(socket) {
      const topics = joinedTopicsBySocket.get(socket);
      if (topics) {
        for (const topic of topics) socketsByTopic.get(topic)?.delete(socket);
        joinedTopicsBySocket.delete(socket);
      }
    },
  },
});

console.log(`[cpk-intelligence-mock] listening on http://127.0.0.1:${PORT}`);
