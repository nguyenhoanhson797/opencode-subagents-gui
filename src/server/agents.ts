/**
 * The server side of agent CRUD: find Markdown agent files, validate an editor draft, write it,
 * delete it, and ask OpenCode to reload its agent list.
 *
 * Every path is resolved under an agents directory, and an id may only add safe path segments.
 */
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import {
  AGENT_MODES,
  PERMISSION_EFFECTS,
  type AgentDraft,
  type AgentFile,
  type AgentListResult,
  type AgentMode,
  type AgentRemoveResult,
  type AgentSaveResult,
  type AgentScope,
  type JsonValue,
  type PermissionEffect,
  type PermissionRule,
  type RequestSpec,
} from "../types.js";
import { parseAgentMarkdown, renderAgentMarkdown } from "./markdown.js";

const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES = 500;
const MAX_DEPTH = 6;
const MAX_SYSTEM_CHARS = 200_000;
const MAX_EXTRA_CHARS = 50_000;
const MAX_DESCRIPTION_CHARS = 2_000;

type Reloader = {
  agent: {
    reload(): Promise<void>;
    list(): Promise<{ data: readonly { id: string }[] }>;
  };
};

/** The global agents directory, following the config directory OpenCode itself uses. */
export function globalAgentsDir(): string {
  const explicit = process.env.OPENCODE_CONFIG_DIR?.trim();
  const configFile = process.env.OPENCODE_CONFIG?.trim();
  if (explicit) return path.join(explicit, "agents");
  if (configFile) return path.join(path.dirname(configFile), "agents");

  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  const config = xdg ? xdg : path.join(homedir(), ".config");
  return path.join(config, "opencode", "agents");
}

/** `<project>/.opencode/agents`, or undefined when the session has no directory. */
export function projectAgentsDir(directory: string | undefined): string | undefined {
  if (!directory) return undefined;
  const root = path.isAbsolute(directory) ? directory : path.resolve(directory);
  return path.join(root, ".opencode", "agents");
}

function baseDir(scope: AgentScope, directory: string | undefined): string {
  if (scope === "global") return globalAgentsDir();
  const project = projectAgentsDir(directory);
  if (!project) throw new Error("A project directory is required to save a project agent.");
  return project;
}

function normalizeId(input: string): string {
  let id = String(input ?? "").trim();
  id = id.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\.md$/i, "");
  id = id.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
  if (!id) throw new Error("Agent ID is required.");

  const parts = id.split("/");
  if (parts.length > MAX_DEPTH) throw new Error(`Agent ID may have at most ${MAX_DEPTH} segments.`);
  for (const part of parts) {
    if (part === "." || part === "..") throw new Error("Agent ID may not contain . or .. segments.");
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(part)) {
      throw new Error(
        "Agent ID segments must start with a letter or number and use only letters, numbers, dots, dashes and underscores.",
      );
    }
    if (part.endsWith(".")) throw new Error("Agent ID segments may not end with a dot.");
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(part)) {
      throw new Error(`"${part}" is a reserved file name on Windows.`);
    }
  }
  return id;
}

function ensureInside(base: string, target: string): void {
  const relative = path.relative(base, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("The agent path leaves its agents directory.");
  }
}

function targetFor(scope: AgentScope, directory: string | undefined, id: string): {
  base: string;
  target: string;
} {
  const base = baseDir(scope, directory);
  const target = path.join(base, ...id.split("/")) + ".md";
  ensureInside(base, target);
  return { base, target };
}

function isoError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function readOne(
  target: string,
  base: string,
  scope: AgentScope,
): Promise<AgentFile> {
  const info = await stat(target);
  if (info.size > MAX_FILE_BYTES) {
    throw new Error(`The file is larger than ${Math.floor(MAX_FILE_BYTES / 1024)} KB.`);
  }

  const raw = await readFile(target, "utf8");
  const relative = path.relative(base, target).split(path.sep).join("/");
  const id = relative.replace(/\.md$/i, "");
  const parsed = parseAgentMarkdown(raw);

  return {
    id,
    scope,
    path: target,
    file: relative,
    mtimeMs: info.mtimeMs,
    size: info.size,
    draft: parsed.draft,
    unknownKeys: parsed.unknownKeys,
    ...(parsed.error ? { error: parsed.error, raw: raw.slice(0, MAX_FILE_BYTES) } : {}),
  };
}

async function scan(
  base: string,
  current: string,
  scope: AgentScope,
  agents: AgentFile[],
  warnings: string[],
  depth: number,
  seen: Set<string>,
): Promise<void> {
  if (depth > MAX_DEPTH || agents.length >= MAX_FILES) return;

  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") warnings.push(`${current}: ${isoError(error)}`);
    return;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (agents.length >= MAX_FILES) {
      warnings.push(`Stopped after ${MAX_FILES} agent files.`);
      return;
    }
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    const target = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await scan(base, target, scope, agents, warnings, depth + 1, seen);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;

    try {
      const real = await stat(target);
      const key = `${real.dev}:${real.ino}:${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      agents.push(await readOne(target, base, scope));
    } catch (error) {
      warnings.push(`${target}: ${isoError(error)}`);
    }
  }
}

/** Every Markdown agent file in the global and project agents directories. */
export async function listAgentFiles(input: {
  directory?: string;
}): Promise<AgentListResult> {
  const global = globalAgentsDir();
  const project = projectAgentsDir(input.directory);
  const agents: AgentFile[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  await scan(global, global, "global", agents, warnings, 0, seen);
  if (project) await scan(project, project, "project", agents, warnings, 0, seen);

  agents.sort((left, right) =>
    left.scope === right.scope
      ? left.id.localeCompare(right.id)
      : left.scope === "project"
        ? -1
        : 1,
  );

  return {
    agents,
    dirs: { global, ...(project ? { project } : {}) },
    warnings,
  };
}

function normalizeModel(value: unknown): string {
  let model = String(value ?? "").trim();
  if (!model) return "";
  if (/\s/.test(model)) throw new Error("Model must not contain spaces.");

  let base = model;
  let variant = "";
  const hash = base.indexOf("#");
  if (hash !== -1) {
    variant = base.slice(hash + 1).trim();
    base = base.slice(0, hash).trim();
    if (!variant) throw new Error("A model variant after # may not be empty.");
  }

  const slash = base.indexOf("/");
  if (slash <= 0 || slash === base.length - 1) {
    throw new Error("Model must use provider/model, optionally followed by #variant.");
  }
  const provider = base.slice(0, slash);
  const id = base.slice(slash + 1);
  if (provider.trim() !== provider || id.trim() !== id) {
    throw new Error("Model must use provider/model without surrounding spaces.");
  }
  if (id.includes("#")) throw new Error("Model may contain only one #variant part.");

  model = `${provider}/${id}${variant ? `#${variant}` : ""}`;
  if (model.length > 400) throw new Error("Model is too long.");
  return model;
}

function normalizeSteps(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const steps = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(steps) || !Number.isInteger(steps) || steps < 1 || steps > 1000) {
    throw new Error("Steps must be a whole number from 1 to 1000.");
  }
  return steps;
}

function normalizeColor(value: unknown): string | undefined {
  const color = String(value ?? "").trim();
  if (!color) return undefined;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error("Color must be a six-digit hex value such as #ff6b6b.");
  }
  return color.toLowerCase();
}

function normalizePermissions(value: unknown): PermissionRule[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Permissions must be a list of rules.");
  if (value.length > 100) throw new Error("At most 100 permission rules are allowed.");

  const rules: PermissionRule[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("Each permission rule must be an object.");
    }
    const record = item as Record<string, unknown>;
    const action = String(record.action ?? "").trim();
    const resource = String(record.resource ?? "").trim();
    const effect = String(record.effect ?? "").trim() as PermissionEffect;
    if (!action) throw new Error("A permission rule needs an action.");
    if (!resource) throw new Error("A permission rule needs a resource.");
    if (!(PERMISSION_EFFECTS as readonly string[]).includes(effect)) {
      throw new Error("A permission effect must be allow, ask or deny.");
    }
    if (action.length > 200 || resource.length > 500) {
      throw new Error("A permission action or resource is too long.");
    }
    rules.push({ action, resource, effect });
  }
  return rules;
}

function normalizeHeaders(value: unknown): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request headers must be an object of names and values.");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 50) throw new Error("At most 50 request headers are allowed.");

  const headers: Record<string, string> = {};
  for (const [rawName, rawValue] of entries) {
    const name = rawName.trim();
    const headerValue = String(rawValue ?? "");
    if (!name) throw new Error("A request header needs a name.");
    if (name.length > 200) throw new Error("A request header name is too long.");
    if (headerValue.length > 4_000) throw new Error("A request header value is too long.");
    headers[name] = headerValue;
  }
  return headers;
}

function normalizeBody(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request body must be a JSON object.");
  }
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    throw new Error("Request body is not valid JSON.");
  }
  if (text.length > 100_000) throw new Error("Request body is too large.");
  return JSON.parse(text) as JsonValue;
}

function normalizeRequest(value: unknown): RequestSpec {
  if (value === undefined || value === null) return { headers: {} };
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request must be an object.");
  }
  const record = value as Record<string, unknown>;
  const headers = normalizeHeaders(record.headers);
  const body = normalizeBody(record.body);
  return body === undefined ? { headers } : { headers, body };
}

/** Validates an editor draft and returns a canonical copy safe to write. */
export function normalizeDraft(value: unknown): AgentDraft {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Agent settings are missing.");
  }
  const record = value as Record<string, unknown>;
  const description = String(record.description ?? "").trim();
  if (description.length > MAX_DESCRIPTION_CHARS) {
    throw new Error(`Description must be ${MAX_DESCRIPTION_CHARS} characters or fewer.`);
  }

  const mode = String(record.mode ?? "subagent").trim() as AgentMode;
  if (!(AGENT_MODES as readonly string[]).includes(mode)) {
    throw new Error("Mode must be subagent, primary or all.");
  }

  if (mode !== "primary" && !description) {
    throw new Error("Add a description; OpenCode shows it to the model when choosing a subagent.");
  }

  const system = String(record.system ?? "");
  if (system.length > MAX_SYSTEM_CHARS) {
    throw new Error(`System prompt must be ${MAX_SYSTEM_CHARS} characters or fewer.`);
  }

  const extra = String(record.extra ?? "");
  if (extra.length > MAX_EXTRA_CHARS) throw new Error("Extra frontmatter is too large.");

  const steps = normalizeSteps(record.steps);
  const color = normalizeColor(record.color);

  return {
    description,
    mode,
    model: normalizeModel(record.model),
    system,
    ...(steps !== undefined ? { steps } : {}),
    ...(color ? { color } : {}),
    hidden: record.hidden === true,
    disabled: record.disabled === true,
    permissions: normalizePermissions(record.permissions),
    request: normalizeRequest(record.request),
    extra,
  };
}

async function reload(
  ctx: Reloader,
  id: string,
): Promise<{ listed: boolean; warning?: string }> {
  try {
    await ctx.agent.reload();
  } catch (error) {
    return {
      listed: false,
      warning: `The file was written, but OpenCode could not reload agents: ${isoError(error)}`,
    };
  }

  try {
    const list = await ctx.agent.list();
    return { listed: list.data.some((agent) => agent.id === id) };
  } catch (error) {
    return {
      listed: false,
      warning: `The file was written, but the agent list could not be read: ${isoError(error)}`,
    };
  }
}

export async function saveAgentFile(
  ctx: Reloader,
  input: {
    scope: AgentScope;
    directory?: string;
    id: string;
    create: boolean;
    draft: unknown;
  },
): Promise<AgentSaveResult> {
  const id = normalizeId(input.id);
  const draft = normalizeDraft(input.draft);
  const scope: AgentScope = input.scope === "project" ? "project" : "global";
  const { base, target } = targetFor(scope, input.directory, id);

  await mkdir(path.dirname(target), { recursive: true });

  if (input.create) {
    try {
      await stat(target);
      throw new Error(`An agent named "${id}" already exists in this location.`);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }
  } else {
    try {
      await stat(target);
    } catch {
      throw new Error(`The agent file for "${id}" no longer exists.`);
    }
  }

  await writeFile(target, renderAgentMarkdown(draft), "utf8");
  const agent = await readOne(target, base, scope);
  const result = await reload(ctx, id);

  return {
    agent,
    listed: result.listed,
    ...(result.warning
      ? { warning: result.warning }
      : result.listed
        ? {}
        : {
            warning:
              "The file was saved, but OpenCode did not list the agent. Check the frontmatter, then restart OpenCode.",
          }),
  };
}

export async function removeAgentFile(
  ctx: Reloader,
  input: { scope: AgentScope; directory?: string; id: string },
): Promise<AgentRemoveResult> {
  const id = normalizeId(input.id);
  const scope: AgentScope = input.scope === "project" ? "project" : "global";
  const { target } = targetFor(scope, input.directory, id);

  try {
    await stat(target);
  } catch {
    throw new Error(`The agent file for "${id}" no longer exists.`);
  }

  await unlink(target);
  const result = await reload(ctx, id);

  return {
    removed: true,
    listed: result.listed,
    ...(result.warning ? { warning: result.warning } : {}),
  };
}

export type { AgentFile, AgentDraft, JsonValue };
