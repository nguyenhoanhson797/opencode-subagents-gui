/**
 * Shapes shared by the plugin's server part and its Desktop window.
 *
 * This module is imported by both runtimes, so it holds types and plain data only: no Node
 * built-ins and no DOM.
 */

export type AgentScope = "global" | "project";

export const AGENT_SCOPES: readonly AgentScope[] = ["global", "project"];

export type AgentMode = "subagent" | "primary" | "all";

export const AGENT_MODES: readonly AgentMode[] = ["subagent", "primary", "all"];

export type PermissionEffect = "allow" | "ask" | "deny";

export const PERMISSION_EFFECTS: readonly PermissionEffect[] = ["allow", "ask", "deny"];

/** Common actions, offered as suggestions in the editor. Any tool or permission action is valid. */
export const COMMON_ACTIONS: readonly string[] = [
  "shell",
  "edit",
  "subagent",
  "read",
  "glob",
  "grep",
  "webfetch",
  "websearch",
  "skill",
  "external_directory",
  "list",
];

export type PermissionRule = {
  action: string;
  resource: string;
  effect: PermissionEffect;
};

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type RequestSpec = {
  headers: Record<string, string>;
  body?: JsonValue;
};

/** Everything the editor can write into an agent's Markdown file. */
export type AgentDraft = {
  description: string;
  mode: AgentMode;
  /** `provider/model`, optionally with `#variant`; empty inherits the parent session's model. */
  model: string;
  /** The Markdown body: the agent's system prompt. */
  system: string;
  steps?: number;
  color?: string;
  hidden: boolean;
  disabled: boolean;
  permissions: PermissionRule[];
  request: RequestSpec;
  /** Unknown frontmatter lines from an existing file, kept verbatim when saving. */
  extra: string;
};

/** One Markdown agent file found on disk. */
export type AgentFile = {
  id: string;
  scope: AgentScope;
  /** Absolute path of the Markdown file. */
  path: string;
  /** Path relative to the scope's agents directory, with `/` separators. */
  file: string;
  mtimeMs: number;
  size: number;
  draft: AgentDraft;
  unknownKeys: string[];
  /** Set when the file's frontmatter could not be read; `draft` then holds defaults. */
  error?: string;
  /** The raw file, included only for a file with a parse error so the user can inspect it. */
  raw?: string;
};

export type AgentDirs = {
  global: string;
  project?: string;
};

export type AgentListResult = {
  agents: AgentFile[];
  dirs: AgentDirs;
  warnings: string[];
};

export type AgentSaveResult = {
  agent: AgentFile;
  /** The effective agent exists after the reload. False means OpenCode has not picked it up yet. */
  listed: boolean;
  warning?: string;
};

export type AgentRemoveResult = {
  removed: true;
  /** The effective agent still exists, because another source defines the same id. */
  listed: boolean;
  warning?: string;
};

export function emptyDraft(): AgentDraft {
  return {
    description: "",
    mode: "subagent",
    model: "",
    system: "",
    hidden: false,
    disabled: false,
    permissions: [],
    request: { headers: {} },
    extra: "",
  };
}
