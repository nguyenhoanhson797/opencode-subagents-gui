/**
 * Reading and writing an agent's Markdown file.
 *
 * OpenCode reads agents from `~/.config/opencode/agents/<id>.md` and
 * `<project>/.opencode/agents/<id>.md`. The YAML frontmatter carries the settings and the
 * Markdown body is the system prompt. This module implements the small YAML subset those files
 * use, and preserves frontmatter keys this editor does not know about.
 */
import {
  AGENT_MODES,
  PERMISSION_EFFECTS,
  emptyDraft,
  type AgentDraft,
  type AgentMode,
  type JsonValue,
  type PermissionEffect,
  type PermissionRule,
  type RequestSpec,
} from "../types.js";

const KNOWN_KEYS = new Set([
  "description",
  "mode",
  "model",
  "system",
  "steps",
  "color",
  "hidden",
  "disabled",
  "permissions",
  "request",
]);

type Chunk = {
  key: string;
  /** The text after `key:` on the first line. */
  value: string;
  /** Every raw line of the chunk, including its first line. */
  lines: string[];
};

/** Splits frontmatter into top-level keys with their indented continuation lines. */
function splitChunks(frontmatter: string): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Chunk | undefined;

  for (const line of frontmatter.split("\n")) {
    const match = /^([A-Za-z0-9_.-]+)\s*:(.*)$/.exec(line);
    if (match) {
      current = { key: match[1]!, value: match[2]!, lines: [line] };
      chunks.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }

  return chunks;
}

/** Strips a `#` comment that is outside quoted strings. */
function stripComment(input: string): string {
  let quote = "";
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (quote) {
      if (char === "\\" && quote === '"') {
        index += 1;
        continue;
      }
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "#" && (index === 0 || /\s/.test(input[index - 1]!))) {
      return input.slice(0, index).trimEnd();
    }
  }
  return input.trimEnd();
}

function leadingSpaces(line: string): number {
  return /^\s*/.exec(line)![0].length;
}

function isSkippable(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === "" || trimmed.startsWith("#");
}

function unquoteKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return String(JSON.parse(trimmed));
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  return trimmed;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function parseScalar(text: string): unknown {
  const value = stripComment(text).trim();
  if (value === "") return "";
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value);
  if (
    (value.startsWith("[") && value.endsWith("]")) ||
    (value.startsWith("{") && value.endsWith("}"))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function minIndent(lines: string[]): number {
  let result = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    if (isSkippable(line)) continue;
    result = Math.min(result, leadingSpaces(line));
  }
  return result === Number.POSITIVE_INFINITY ? 0 : result;
}

function parseBlockScalar(lines: string[], kind: string): string {
  const indent = minIndent(lines);
  const parts = lines
    .filter((line) => !isSkippable(line))
    .map((line) => line.slice(Math.min(indent, leadingSpaces(line))));
  const joined = kind.startsWith(">") ? parts.join(" ") : parts.join("\n");
  return kind.endsWith("-") ? joined.trimEnd() : `${joined}\n`;
}

/** Parses nested block maps such as `request: { headers: {...}, body: {...} }`. */
function parseNested(lines: string[], indent: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;
    if (isSkippable(line)) {
      index += 1;
      continue;
    }
    const match = /^(\s*)([^:#]+?)\s*:(.*)$/.exec(line);
    if (!match || match[1]!.length !== indent) {
      index += 1;
      continue;
    }
    const key = unquoteKey(match[2]!);
    const rest = match[3]!.trim();
    index += 1;

    const children: string[] = [];
    while (index < lines.length) {
      const next = lines[index]!;
      if (!isSkippable(next) && leadingSpaces(next) <= indent) break;
      children.push(next);
      index += 1;
    }

    if (rest === "") {
      const childIndent = minIndent(children);
      const hasList = children.some(
        (child) => !isSkippable(child) && child.trim().startsWith("-"),
      );
      result[key] = hasList
        ? parseList(children, childIndent)
        : parseNested(children, childIndent);
    } else if (/^[|>][+-]?$/.test(rest)) {
      result[key] = parseBlockScalar(children, rest);
    } else {
      result[key] = parseScalar(rest);
    }
  }

  return result;
}

function parseList(lines: string[], indent: number): unknown[] {
  const result: unknown[] = [];
  let current: Record<string, unknown> | undefined;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;
    if (isSkippable(line)) {
      index += 1;
      continue;
    }
    const ownIndent = leadingSpaces(line);
    const trimmed = line.trim();

    if (trimmed.startsWith("-") && ownIndent === indent) {
      const rest = trimmed.slice(1).trim();
      if (rest.startsWith("{")) {
        result.push(parseScalar(rest));
        current = undefined;
        index += 1;
        continue;
      }
      current = {};
      result.push(current);
      if (rest !== "") {
        const pair = /^([^:]+?)\s*:(.*)$/.exec(rest);
        if (pair) current[unquoteKey(pair[1]!)] = parseScalar(pair[2]!);
      }
      index += 1;
      continue;
    }

    if (current && ownIndent > indent) {
      const pair = /^([^:]+?)\s*:(.*)$/.exec(trimmed);
      if (pair) current[unquoteKey(pair[1]!)] = parseScalar(pair[2]!);
    }
    index += 1;
  }

  return result;
}

function parsePermissions(chunk: Chunk): PermissionRule[] {
  const value = stripComment(chunk.value).trim();
  if (value !== "") {
    const parsed = parseScalar(value);
    if (Array.isArray(parsed)) return asPermissions(parsed);
    return [];
  }

  const lines = chunk.lines.slice(1);
  const indent = minIndent(lines);
  const parsed = parseList(lines, indent);
  return asPermissions(parsed);
}

function asPermissions(value: unknown): PermissionRule[] {
  if (!Array.isArray(value)) return [];
  const rules: PermissionRule[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const action = asString(record.action).trim();
    const resource = asString(record.resource).trim();
    const effect = asString(record.effect).trim() as PermissionEffect;
    if (!action || !resource) continue;
    if (!(PERMISSION_EFFECTS as readonly string[]).includes(effect)) continue;
    rules.push({ action, resource, effect });
  }
  return rules;
}

function parseRequest(chunk: Chunk): RequestSpec {
  const value = stripComment(chunk.value).trim();
  let parsed: unknown;

  if (value !== "") {
    parsed = parseScalar(value);
  } else {
    const lines = chunk.lines.slice(1);
    parsed = parseNested(lines, minIndent(lines));
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { headers: {} };
  }

  const record = parsed as Record<string, unknown>;
  const headers: Record<string, string> = {};
  if (
    typeof record.headers === "object" &&
    record.headers !== null &&
    !Array.isArray(record.headers)
  ) {
    for (const [key, headerValue] of Object.entries(record.headers as Record<string, unknown>)) {
      headers[key] = asString(headerValue);
    }
  }

  const request: RequestSpec = { headers };
  if (Object.prototype.hasOwnProperty.call(record, "body") && record.body !== undefined) {
    request.body = record.body as JsonValue;
  }
  return request;
}

export type ParsedAgent = {
  draft: AgentDraft;
  body: string;
  unknownKeys: string[];
  error?: string;
};

function chunkString(chunk: Chunk): string {
  const value = stripComment(chunk.value).trim();
  if (/^[|>][+-]?$/.test(value)) {
    return parseBlockScalar(chunk.lines.slice(1), value).trim();
  }
  return asString(parseScalar(value));
}

/** Reads the frontmatter and Markdown body of an agent file. */
export function parseAgentMarkdown(raw: string): ParsedAgent {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  if ((lines[0] ?? "").trim() !== "---") {
    return {
      draft: emptyDraft(),
      body: text.trim(),
      unknownKeys: [],
      error: "The file does not start with a YAML frontmatter block (---).",
    };
  }

  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closing === -1) {
    return {
      draft: emptyDraft(),
      body: text.trim(),
      unknownKeys: [],
      error: "The YAML frontmatter block is not closed by a second --- line.",
    };
  }

  const frontmatter = lines.slice(1, closing).join("\n");
  const bodyLines = lines.slice(closing + 1);
  while (bodyLines.length > 0 && bodyLines[0]!.trim() === "") bodyLines.shift();
  const body = bodyLines.join("\n").trimEnd();
  const chunks = splitChunks(frontmatter);

  const draft = emptyDraft();
  const unknownKeys: string[] = [];
  const extra: string[] = [];

  for (const chunk of chunks) {
    const value = stripComment(chunk.value).trim();

    switch (chunk.key) {
      case "description":
        draft.description = chunkString(chunk);
        break;
      case "mode": {
        const mode = asString(parseScalar(value)).trim() as AgentMode;
        if ((AGENT_MODES as readonly string[]).includes(mode)) draft.mode = mode;
        break;
      }
      case "model":
        draft.model = asString(parseScalar(value));
        break;
      case "steps": {
        const parsed = parseScalar(value);
        const steps = typeof parsed === "number" ? parsed : Number(parsed);
        if (Number.isFinite(steps) && steps > 0) draft.steps = Math.floor(steps);
        break;
      }
      case "color":
        draft.color = asString(parseScalar(value));
        break;
      case "hidden":
        draft.hidden = asBoolean(parseScalar(value));
        break;
      case "disabled":
        draft.disabled = asBoolean(parseScalar(value));
        break;
      case "permissions":
        draft.permissions = parsePermissions(chunk);
        break;
      case "request":
        draft.request = parseRequest(chunk);
        break;
      case "system":
        // V1 files put the prompt in frontmatter. Keep it so the editor can show it.
        draft.system = chunkString(chunk);
        break;
      default:
        unknownKeys.push(chunk.key);
        extra.push(chunk.lines.join("\n"));
        break;
    }
  }

  draft.extra = extra.join("\n").trim();
  if (draft.system === "") draft.system = body;

  return { draft, body, unknownKeys };
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function yamlKey(key: string): string {
  return /^[A-Za-z0-9_.-]+$/.test(key) ? key : yamlString(key);
}

/** Drops known keys and separators from preserved frontmatter. */
function sanitizeExtra(extra: string): string {
  if (!extra.trim()) return "";
  const chunks = splitChunks(extra.replace(/\r\n?/g, "\n"));
  const lines: string[] = [];
  for (const chunk of chunks) {
    if (KNOWN_KEYS.has(chunk.key)) continue;
    const cleaned = chunk.lines.filter((line) => line.trim() !== "---");
    if (cleaned.length > 0) lines.push(cleaned.join("\n"));
  }
  return lines.join("\n").trim();
}

/** Renders an agent's Markdown file from an editor draft. */
export function renderAgentMarkdown(draft: AgentDraft): string {
  const lines: string[] = ["---"];

  if (draft.description.trim()) {
    lines.push(`description: ${yamlString(draft.description.trim())}`);
  }
  lines.push(`mode: ${draft.mode}`);
  if (draft.model.trim()) lines.push(`model: ${yamlString(draft.model.trim())}`);
  if (draft.color?.trim()) lines.push(`color: ${yamlString(draft.color.trim())}`);
  if (draft.steps !== undefined) lines.push(`steps: ${draft.steps}`);
  if (draft.hidden) lines.push("hidden: true");
  if (draft.disabled) lines.push("disabled: true");

  if (draft.permissions.length > 0) {
    lines.push("permissions:");
    for (const rule of draft.permissions) {
      lines.push(`  - action: ${yamlString(rule.action)}`);
      lines.push(`    resource: ${yamlString(rule.resource)}`);
      lines.push(`    effect: ${yamlString(rule.effect)}`);
    }
  }

  const headers = Object.entries(draft.request.headers);
  const hasBody = draft.request.body !== undefined;
  if (headers.length > 0 || hasBody) {
    lines.push("request:");
    if (headers.length > 0) {
      lines.push("  headers:");
      for (const [name, value] of headers) {
        lines.push(`    ${yamlKey(name)}: ${yamlString(value)}`);
      }
    }
    if (hasBody) {
      lines.push(`  body: ${JSON.stringify(draft.request.body)}`);
    }
  }

  const extra = sanitizeExtra(draft.extra);
  if (extra) lines.push(extra);
  lines.push("---");

  const body = draft.system.replace(/\r\n?/g, "\n").trimEnd();
  const text = lines.join("\n") + "\n";
  return body ? `${text}\n${body}\n` : `${text}\n`;
}
