/**
 * The RPC between this plugin's server part and its Desktop window.
 *
 * Only type imports from `@opencode/*`, so loading this file loads no OpenCode package: the
 * server registers the definition, and the window calls it.
 */
import type { Rpc } from "@opencode/plugin";
import type {
  AgentDraft,
  AgentListResult,
  AgentRemoveResult,
  AgentSaveResult,
  AgentScope,
} from "./types.js";

export const AGENTS_RPC_ID = "opencode-subagents.rpc";

export type ListAgentsInput = { directory?: string };
export type ListAgentsOutput = AgentListResult;
export type SaveAgentInput = {
  scope: AgentScope;
  directory?: string;
  id: string;
  create: boolean;
  draft: AgentDraft;
};
export type SaveAgentOutput = AgentSaveResult;
export type RemoveAgentInput = { scope: AgentScope; directory?: string; id: string };
export type RemoveAgentOutput = AgentRemoveResult;

type StandardValueSchema = Extract<Rpc.PortableValueSchema, { "~standard": unknown }>;
type Typed<T> = { "~standard": { types?: { input: T; output: T } } };
type Schema<T> = StandardValueSchema & Typed<T>;

/**
 * A Standard Schema that runs `check` and passes the value through. OpenCode validates every
 * input and output with it; `types` only carries T for TypeScript.
 */
function schema<T>(check: (value: unknown) => string | null): Schema<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "opencode-subagents",
      validate: (value) => {
        const issue = check(value);
        return issue ? { issues: [{ message: issue }] } : { value: value as T };
      },
    },
  };
}

/** OpenCode's RPC route sends no input when a caller passes nothing; that is `{}` here. */
function inputSchema<T>(check: (value: unknown) => string | null): Schema<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "opencode-subagents",
      validate: (value) => {
        const input = value === undefined ? {} : value;
        const issue = check(input);
        return issue ? { issues: [{ message: issue }] } : { value: input as T };
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalDirectory(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || value.length > 4_096) {
    return "directory must be a path string";
  }
  return null;
}

function checkListInput(value: unknown): string | null {
  if (!isRecord(value)) return "input must be an object";
  return optionalDirectory(value.directory);
}

function checkListOutput(value: unknown): string | null {
  if (!isRecord(value)) return "output must be an object";
  if (!Array.isArray(value.agents)) return "output must carry agents";
  if (!isRecord(value.dirs)) return "output must carry dirs";
  if (!Array.isArray(value.warnings)) return "output must carry warnings";
  return null;
}

function checkSaveInput(value: unknown): string | null {
  if (!isRecord(value)) return "input must be an object";
  if (value.scope !== "global" && value.scope !== "project") {
    return "scope must be global or project";
  }
  if (typeof value.id !== "string" || value.id.length === 0 || value.id.length > 300) {
    return "id must be a non-empty string";
  }
  if (typeof value.create !== "boolean") return "create must be a boolean";
  if (!isRecord(value.draft)) return "draft must be an object";
  return optionalDirectory(value.directory);
}

function checkSaveOutput(value: unknown): string | null {
  if (!isRecord(value)) return "output must be an object";
  if (!isRecord(value.agent)) return "output must carry the saved agent";
  if (typeof value.listed !== "boolean") return "output must carry listed";
  return null;
}

function checkRemoveInput(value: unknown): string | null {
  if (!isRecord(value)) return "input must be an object";
  if (value.scope !== "global" && value.scope !== "project") {
    return "scope must be global or project";
  }
  if (typeof value.id !== "string" || value.id.length === 0 || value.id.length > 300) {
    return "id must be a non-empty string";
  }
  return optionalDirectory(value.directory);
}

function checkRemoveOutput(value: unknown): string | null {
  if (!isRecord(value)) return "output must be an object";
  if (value.removed !== true) return "output must report the file as removed";
  if (typeof value.listed !== "boolean") return "output must carry listed";
  return null;
}

export const AgentsRpc = {
  id: AGENTS_RPC_ID,
  // No events: the panel asks when it mounts, after a save or delete, and on its refresh button.
  events: {},
  methods: {
    list: {
      input: inputSchema<ListAgentsInput>(checkListInput),
      output: schema<ListAgentsOutput>(checkListOutput),
    },
    save: {
      input: schema<SaveAgentInput>(checkSaveInput),
      output: schema<SaveAgentOutput>(checkSaveOutput),
    },
    remove: {
      input: schema<RemoveAgentInput>(checkRemoveInput),
      output: schema<RemoveAgentOutput>(checkRemoveOutput),
    },
  },
} satisfies Rpc.PortableDefinition;
