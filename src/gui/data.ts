/**
 * The window's data: the plugin's CRUD RPC, OpenCode's effective agent and model lists, and the
 * live subagent sessions under the routed session.
 *
 * Every surface owns its instances, and a call that finishes after a newer one is dropped.
 */
import type { Context, MountedSession } from "@opencode/plugin/gui";
import { createEffect, createSignal, onCleanup } from "solid-js";
import {
  AgentsRpc,
  type ListAgentsInput,
  type ListAgentsOutput,
  type RemoveAgentInput,
  type RemoveAgentOutput,
  type SaveAgentInput,
  type SaveAgentOutput,
} from "../rpc.js";
import type { AgentScope, PermissionRule } from "../types.js";

type CallOptions = { location?: { directory: string }; signal?: AbortSignal };

type AgentsRpcMethods = {
  list(input: ListAgentsInput, options?: CallOptions): Promise<ListAgentsOutput>;
  save(input: SaveAgentInput, options?: CallOptions): Promise<SaveAgentOutput>;
  remove(input: RemoveAgentInput, options?: CallOptions): Promise<RemoveAgentOutput>;
};

const RPC_TIMEOUT_MS = 30_000;
const SESSION_TIMEOUT_MS = 15_000;

function methods(ctx: Context): AgentsRpcMethods {
  const client = ctx.client as unknown as { rpc(definition: unknown): AgentsRpcMethods };
  return client.rpc(AgentsRpc);
}

function options(directory: string | undefined): CallOptions {
  const signal = AbortSignal.timeout(RPC_TIMEOUT_MS);
  return directory ? { location: { directory }, signal } : { signal };
}

/** RPC calls reject with a plain `{ type, message }` object rather than an Error. */
export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export type EffectiveAgent = {
  id: string;
  name?: string;
  description?: string;
  mode?: "subagent" | "primary" | "all";
  hidden?: boolean;
  color?: string;
  steps?: number;
  model?: { id: string; providerID: string; variant?: string };
  system?: string;
  permissions?: PermissionRule[];
  request?: { headers?: Record<string, string>; body?: unknown };
};

export type ModelInfoLike = {
  id: string;
  modelID: string;
  providerID: string;
  name: string;
  type?: string;
  enabled?: boolean;
  variants?: Array<{ id: string }>;
  limit?: { context: number; output: number; input?: number };
  status?: string;
};

export type ProviderInfoLike = { id: string; name: string };

type AgentClient = {
  agent: {
    list(input?: { location?: { directory?: string } }): Promise<{ data: EffectiveAgent[] }>;
  };
  model: {
    list(input?: {
      types?: readonly string[];
      location?: { directory?: string };
    }): Promise<{ data: ModelInfoLike[] }>;
  };
  provider: {
    list(input?: { location?: { directory?: string } }): Promise<{ data: ProviderInfoLike[] }>;
  };
  session: {
    list(input?: {
      parentID?: string;
      limit?: number;
      directory?: string;
    }): Promise<{ data: SessionInfoLike[] }>;
    active(): Promise<Record<string, { type: string }>>;
    interrupt(input: { sessionID: string }): Promise<unknown>;
  };
};

function clientOf(ctx: Context): AgentClient {
  return ctx.client as unknown as AgentClient;
}

function clientOfSession(session: MountedSession): AgentClient {
  return session.server.client as unknown as AgentClient;
}

// -----------------------------------------------------------------------------
// Agent files and effective definitions
// -----------------------------------------------------------------------------

function sameId(left: string, right: string): boolean {
  const normalize = (value: string) =>
    value
      .trim()
      .replaceAll("\\", "/")
      .replace(/^\.\/+/, "")
      .replace(/\.md$/i, "")
      .replace(/\/+/g, "/")
      .replace(/^\/|\/$/g, "");
  return normalize(left) === normalize(right);
}

export type AgentsData = {
  agents: () => ListAgentsOutput["agents"] | undefined;
  dirs: () => ListAgentsOutput["dirs"] | undefined;
  warnings: () => readonly string[];
  effective: () => EffectiveAgent[];
  loading: () => boolean;
  error: () => string | undefined;
  load(): Promise<void>;
  save(input: SaveAgentInput): Promise<SaveAgentOutput>;
  remove(input: RemoveAgentInput): Promise<RemoveAgentOutput>;
};

export function createAgentsData(
  ctx: Context,
  directory: () => string | undefined,
): AgentsData {
  const [agents, setAgents] = createSignal<ListAgentsOutput["agents"]>();
  const [dirs, setDirs] = createSignal<ListAgentsOutput["dirs"]>();
  const [warnings, setWarnings] = createSignal<readonly string[]>([]);
  const [effective, setEffective] = createSignal<EffectiveAgent[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let sequence = 0;

  const load = async () => {
    const mine = ++sequence;
    setLoading(true);
    setError(undefined);

    const location = directory();
    const [filesResult, effectiveResult] = await Promise.allSettled([
      methods(ctx).list(location ? { directory: location } : {}, options(location)),
      clientOf(ctx).agent.list(location ? { location: { directory: location } } : {}),
    ]);

    if (mine !== sequence) return;

    if (filesResult.status === "fulfilled") {
      setAgents(filesResult.value.agents);
      setDirs(filesResult.value.dirs);
      setWarnings(filesResult.value.warnings);
    } else {
      setError(errorText(filesResult.reason));
      setAgents(undefined);
      setDirs(undefined);
      setWarnings([]);
    }

    if (effectiveResult.status === "fulfilled") {
      setEffective(effectiveResult.value.data ?? []);
    } else {
      setEffective([]);
    }

    if (mine === sequence) setLoading(false);
  };

  return {
    agents,
    dirs,
    warnings,
    effective,
    loading,
    error,
    load,
    async save(input) {
      const location = directory();
      const result = await methods(ctx).save(
        { ...input, ...(location ? { directory: location } : {}) },
        options(location),
      );
      await load();
      // The server's own list may not be scoped to the call's location. Trust the effective
      // agent list the window just read for this directory.
      const present = effective().some((agent) => sameId(agent.id, input.id));
      return present
        ? { ...result, listed: true, warning: undefined }
        : result;
    },
    async remove(input) {
      const location = directory();
      const result = await methods(ctx).remove(
        { ...input, ...(location ? { directory: location } : {}) },
        options(location),
      );
      await load();
      const present = effective().some((agent) => sameId(agent.id, input.id));
      return present
        ? { ...result, listed: true }
        : { ...result, listed: false, warning: undefined };
    },
  };
}

// -----------------------------------------------------------------------------
// Models and providers
// -----------------------------------------------------------------------------

export type ModelsData = {
  models: () => ModelInfoLike[];
  providers: () => ProviderInfoLike[];
  loading: () => boolean;
  error: () => string | undefined;
  load(): Promise<void>;
};

export function createModelsData(
  ctx: Context,
  directory: () => string | undefined,
  session?: () => MountedSession | undefined,
): ModelsData {
  const [models, setModels] = createSignal<ModelInfoLike[]>([]);
  const [providers, setProviders] = createSignal<ProviderInfoLike[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let sequence = 0;

  const load = async () => {
    const mine = ++sequence;
    setLoading(true);
    setError(undefined);

    const location = directory();
    const routed = session?.();
    const client = routed ? clientOfSession(routed) : clientOf(ctx);
    const input = location ? { types: ["chat"] as const, location: { directory: location } } : { types: ["chat"] as const };
    const providerInput = location ? { location: { directory: location } } : {};

    const [modelsResult, providersResult] = await Promise.allSettled([
      client.model.list(input),
      client.provider.list(providerInput),
    ]);

    if (mine !== sequence) return;

    if (modelsResult.status === "fulfilled") {
      const rows = (modelsResult.value.data ?? [])
        .filter((model) => model.enabled !== false)
        .sort((left, right) =>
          left.providerID === right.providerID
            ? left.name.localeCompare(right.name)
            : left.providerID.localeCompare(right.providerID),
        );
      setModels(rows);
    } else {
      setModels([]);
      setError(errorText(modelsResult.reason));
    }

    if (providersResult.status === "fulfilled") setProviders(providersResult.value.data ?? []);

    if (mine === sequence) setLoading(false);
  };

  return { models, providers, loading, error, load };
}

// -----------------------------------------------------------------------------
// Live subagent sessions
// -----------------------------------------------------------------------------

export type SessionInfoLike = {
  id: string;
  parentID?: string;
  title?: string;
  agent?: string;
  model?: { id: string; providerID: string; variant?: string };
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
  outcome?: "succeeded" | "failed" | "interrupted";
  time: {
    created: number;
    updated: number;
    busy?: number;
    idle?: number;
  };
};

export type RunNode = {
  session: SessionInfoLike;
  depth: number;
  running: boolean;
};

export type LiveData = {
  rows: () => RunNode[];
  loading: () => boolean;
  error: () => string | undefined;
  running: () => number;
  total: () => number;
  load(): Promise<void>;
  stop(sessionID: string): Promise<void>;
  open(sessionID: string): void;
};

const MAX_CHILD_DEPTH = 4;
const MAX_CHILD_SESSIONS = 400;

async function childrenOf(
  client: AgentClient,
  parentID: string,
  directory: string | undefined,
): Promise<SessionInfoLike[]> {
  try {
    const answer = await client.session.list({
      parentID,
      limit: 100,
      ...(directory ? { directory } : {}),
    });
    return answer.data ?? [];
  } catch {
    return [];
  }
}

export function createLiveData(
  ctx: Context,
  session: () => MountedSession,
  interval: () => number,
): LiveData {
  const [rows, setRows] = createSignal<RunNode[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let sequence = 0;

  const load = async () => {
    const mine = ++sequence;
    const current = session();
    if (!current) return;

    setLoading(true);
    setError(undefined);

    try {
      const client = clientOfSession(current);
      const directory = current.directory;

      const activePromise = client.session
        .active()
        .then((active) => active ?? {})
        .catch(() => ({}) as Record<string, { type: string }>);

      const collected: Array<{ session: SessionInfoLike; depth: number }> = [];
      let frontier: Array<{ id: string; depth: number }> = [{ id: current.id, depth: 0 }];

      for (let depth = 1; depth <= MAX_CHILD_DEPTH && frontier.length > 0; depth += 1) {
        const answers = await Promise.all(
          frontier.map(async (parent) => ({
            parent,
            children: await childrenOf(client, parent.id, directory),
          })),
        );

        const next: Array<{ id: string; depth: number }> = [];
        for (const answer of answers) {
          for (const child of answer.children) {
            if (collected.length >= MAX_CHILD_SESSIONS) break;
            if (child.parentID && child.parentID !== answer.parent.id) continue;
            collected.push({ session: child, depth: answer.parent.depth + 1 });
            next.push({ id: child.id, depth: answer.parent.depth + 1 });
          }
        }
        frontier = next;
      }

      const active = await activePromise;
      if (mine !== sequence) return;

      collected.sort((left, right) => left.session.time.created - right.session.time.created);
      setRows(
        collected.map((entry) => ({
          ...entry,
          running: active[entry.session.id]?.type === "running",
        })),
      );
    } catch (failure) {
      if (mine === sequence) setError(errorText(failure));
    } finally {
      if (mine === sequence) setLoading(false);
    }
  };

  createEffect(() => {
    // Re-run when the routed session or directory changes, and when the interval setting changes.
    session().id;
    session().directory;
    const milliseconds = interval();
    void load();
    if (milliseconds <= 0) return;
    const timer = setInterval(() => void load(), milliseconds);
    onCleanup(() => clearInterval(timer));
  });

  return {
    rows,
    loading,
    error,
    running: () => rows().filter((row) => row.running).length,
    total: () => rows().length,
    load,
    async stop(sessionID) {
      const current = session();
      if (!current) return;
      await clientOfSession(current).session.interrupt({ sessionID });
      await load();
    },
    open(sessionID) {
      const current = session();
      if (!current) return;
      ctx.tabs.open({ server: current.server.id, id: sessionID }, { focus: true });
    },
  };
}

export type { AgentScope };
