/**
 * A mock OpenCode GUI context and data set for the preview harness.
 *
 * It mirrors the handful of `ctx` surfaces the panel uses. Nothing here ships to OpenCode: the
 * preview is a styling and behaviour aid, not part of the plugin bundle.
 */
import type { Context, MountedSession } from "@opencode/plugin/gui";
import { en } from "../src/gui/i18n.js";
import type { AgentDraft, AgentFile } from "../src/types.js";

const NOW = Date.now();

const draft = (value: Partial<AgentDraft>): AgentDraft => ({
  description: "",
  mode: "subagent",
  model: "",
  system: "",
  hidden: false,
  disabled: false,
  permissions: [],
  request: { headers: {} },
  extra: "",
  ...value,
});

const file = (value: {
  id: string;
  scope: "global" | "project";
  file?: string;
  draft: Partial<AgentDraft>;
}): AgentFile => ({
  id: value.id,
  scope: value.scope,
  path:
    value.scope === "global"
      ? `C:\\Users\\you\\.config\\opencode\\agents\\${value.id.replaceAll("/", "\\")}.md`
      : `D:\\demo\\my-project\\.opencode\\agents\\${value.id.replaceAll("/", "\\")}.md`,
  file: value.file ?? `${value.id}.md`,
  mtimeMs: NOW - 86_400_000,
  size: 1_240,
  draft: draft(value.draft),
  unknownKeys: [],
});

const files: AgentFile[] = [
  file({
    id: "code-reviewer",
    scope: "global",
    draft: {
      description: "Reviews diffs for bugs, security issues and project style.",
      model: "anthropic/claude-sonnet-4-5",
      system: "You review code carefully and report only actionable findings.",
      permissions: [
        { action: "edit", resource: "*", effect: "deny" },
        { action: "shell", resource: "git diff*", effect: "allow" },
      ],
    },
  }),
  file({
    id: "docs-writer",
    scope: "project",
    draft: {
      description: "Writes and updates reference docs from the current code.",
      model: "openai/gpt-5#fast",
      system: "You write concise reference documentation.",
    },
  }),
  file({
    id: "team/researcher",
    scope: "global",
    file: "team/researcher.md",
    draft: {
      description: "Looks up library behaviour and reports sources.",
      model: "opencode-go/deepseek-v4.1-flash",
      system: "You research and cite primary sources.",
    },
  }),
  file({
    id: "legacy-helper",
    scope: "global",
    draft: {
      description: "Old helper kept for a archived workflow.",
      hidden: true,
    },
  }),
];

const effective = () => [
  { id: "build", name: "Build", mode: "primary" as const, description: "The default coding agent." },
  { id: "plan", name: "Plan", mode: "primary" as const, description: "Plans without editing." },
  {
    id: "general",
    name: "General",
    mode: "subagent" as const,
    description: "General-purpose agent for parallel work.",
    model: { providerID: "opencode-go", id: "deepseek-v4.1-flash" },
  },
  {
    id: "explore",
    name: "Explore",
    mode: "subagent" as const,
    description: "Fast read-only search across the project.",
    model: { providerID: "opencode-go", id: "qwen4-max" },
  },
  {
    id: "reviewer",
    name: "Reviewer",
    mode: "subagent" as const,
    description: "Config-defined reviewer from opencode.json.",
    model: { providerID: "anthropic", id: "claude-haiku-4-5" },
  },
  {
    id: "hidden-helper",
    name: "Hidden helper",
    mode: "subagent" as const,
    description: "A hidden config agent.",
    hidden: true,
  },
  {
    id: "code-reviewer",
    name: "Code reviewer",
    mode: "subagent" as const,
    description: "Reviews diffs for bugs, security issues and project style.",
    model: { providerID: "anthropic", id: "claude-sonnet-4-5" },
  },
  {
    id: "docs-writer",
    name: "Docs writer",
    mode: "subagent" as const,
    description: "Writes and updates reference docs from the current code.",
    model: { providerID: "openai", id: "gpt-5", variant: "fast" },
  },
  {
    id: "team/researcher",
    name: "Researcher",
    mode: "subagent" as const,
    description: "Looks up library behaviour and reports sources.",
    model: { providerID: "opencode-go", id: "deepseek-v4.1-flash" },
  },
];

const models = [
  {
    id: "claude-sonnet-4-5",
    modelID: "claude-sonnet-4-5",
    providerID: "anthropic",
    name: "Claude Sonnet 4.5",
    enabled: true,
    variants: [{ id: "thinking" }, { id: "fast" }],
    limit: { context: 200_000, output: 64_000 },
  },
  {
    id: "claude-haiku-4-5",
    modelID: "claude-haiku-4-5",
    providerID: "anthropic",
    name: "Claude Haiku 4.5",
    enabled: true,
    variants: [],
    limit: { context: 200_000, output: 32_000 },
  },
  {
    id: "gpt-5",
    modelID: "gpt-5",
    providerID: "openai",
    name: "GPT-5",
    enabled: true,
    variants: [{ id: "fast" }, { id: "reasoning" }],
    limit: { context: 400_000, output: 128_000 },
  },
  {
    id: "deepseek-v4.1-flash",
    modelID: "deepseek-v4.1-flash",
    providerID: "opencode-go",
    name: "DeepSeek V4.1 Flash",
    enabled: true,
    variants: [],
    limit: { context: 1_000_000, output: 64_000 },
  },
  {
    id: "qwen4-max",
    modelID: "qwen4-max",
    providerID: "opencode-go",
    name: "Qwen4 Max",
    enabled: true,
    variants: [],
    limit: { context: 262_000, output: 32_000 },
  },
];

const providers = [
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
  { id: "opencode-go", name: "OpenCode Go" },
];

function sessionsFor(parentID: string) {
  if (parentID === "ses_preview") {
    return [
      {
        id: "ses_child_reviewer",
        parentID,
        title: "Review src/gui/panel.tsx",
        agent: "code-reviewer",
        model: { providerID: "anthropic", id: "claude-sonnet-4-5" },
        cost: 0.0842,
        tokens: { input: 18_400, output: 3_120, reasoning: 960, cache: { read: 12_000, write: 2_400 } },
        time: { created: NOW - 154_000, updated: NOW - 2_000, busy: NOW - 154_000 },
      },
      {
        id: "ses_child_docs",
        parentID,
        title: "Write the parser reference",
        agent: "docs-writer",
        model: { providerID: "openai", id: "gpt-5", variant: "fast" },
        cost: 0.031,
        tokens: { input: 9_800, output: 2_050, reasoning: 0, cache: { read: 5_600, write: 1_200 } },
        outcome: "succeeded" as const,
        time: { created: NOW - 726_000, updated: NOW - 512_000, idle: NOW - 512_000 },
      },
      {
        id: "ses_child_search",
        parentID,
        title: "Search for model picker examples",
        agent: "explore",
        model: { providerID: "opencode-go", id: "qwen4-max" },
        cost: 0.0021,
        tokens: { input: 4_100, output: 620, reasoning: 0, cache: { read: 2_000, write: 500 } },
        outcome: "failed" as const,
        time: { created: NOW - 1_480_000, updated: NOW - 1_440_000, idle: NOW - 1_440_000 },
      },
    ];
  }
  if (parentID === "ses_child_reviewer") {
    return [
      {
        id: "ses_grand_css",
        parentID,
        title: "Check overflow in a narrow panel",
        agent: "explore",
        model: { providerID: "opencode-go", id: "qwen4-max" },
        cost: 0.0008,
        tokens: { input: 1_900, output: 340, reasoning: 0, cache: { read: 900, write: 200 } },
        time: { created: NOW - 72_000, updated: NOW - 4_000, busy: NOW - 72_000 },
      },
    ];
  }
  return [];
}

export type Mock = {
  ctx: Context;
  session: MountedSession;
  toasts: Array<{ title: string; description?: string; variant?: string }>;
};

export function createMock(mode: "dark" | "light" = "dark"): Mock {
  const toasts: Mock["toasts"] = [];

  const client = {
    rpc: () => ({
      list: async () => ({
        agents: files.slice(),
        dirs: {
          global: "C:\\Users\\you\\.config\\opencode\\agents",
          project: "D:\\demo\\my-project\\.opencode\\agents",
        },
        warnings: [],
      }),
      save: async (input: { id: string; scope: "global" | "project"; draft: AgentDraft }) => {
        const saved = file({ id: input.id, scope: input.scope, draft: input.draft });
        const index = files.findIndex(
          (entry) => entry.id === input.id && entry.scope === input.scope,
        );
        if (index === -1) files.push(saved);
        else files[index] = saved;
        return { agent: saved, listed: true };
      },
      remove: async (input: { id: string; scope: "global" | "project" }) => {
        const index = files.findIndex(
          (entry) => entry.id === input.id && entry.scope === input.scope,
        );
        if (index !== -1) files.splice(index, 1);
        return { removed: true, listed: false };
      },
    }),
    agent: { list: async () => ({ data: effective() }) },
    model: { list: async () => ({ data: models }) },
    provider: { list: async () => ({ data: providers }) },
    session: {
      list: async (input?: { parentID?: string }) => ({
        data: input?.parentID ? sessionsFor(input.parentID) : [],
      }),
      active: async () => ({
        ses_child_reviewer: { type: "running" },
        ses_grand_css: { type: "running" },
      } as Record<string, { type: string }>),
      interrupt: async () => ({}),
    },
  };

  const t = (key: string, values?: Record<string, string>) => {
    const text = (en as Record<string, string>)[key] ?? key;
    if (!values) return text;
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) => values[name] ?? "");
  };

  const ctx = {
    id: "opencode-subagents",
    t,
    appearance: { mode: () => mode },
    ui: {
      Button: (props: {
        children?: unknown;
        icon?: string;
        variant?: string;
        size?: string;
        busy?: boolean;
        disabled?: boolean;
        class?: string;
        onClick?: (event: MouseEvent) => void;
      }) => (
        <button
          type="button"
          class={`pv-btn pv-btn-${props.variant ?? "neutral"}`}
          disabled={props.disabled || props.busy}
          onClick={props.onClick}
        >
          {props.busy ? <span class="pv-spin" /> : props.icon ? <span class="pv-icon">{glyph(props.icon)}</span> : null}
          {props.children}
        </button>
      ),
      IconButton: (props: {
        icon: string;
        label: string;
        size?: string;
        busy?: boolean;
        disabled?: boolean;
        onClick?: (event: MouseEvent) => void;
      }) => (
        <button
          type="button"
          class="pv-icon-btn"
          title={props.label}
          aria-label={props.label}
          disabled={props.disabled || props.busy}
          onClick={props.onClick}
        >
          {props.busy ? <span class="pv-spin" /> : glyph(props.icon)}
        </button>
      ),
      Switch: (props: { checked: boolean; label: string; hideLabel?: boolean; onChange: (checked: boolean) => void }) => (
        <button
          type="button"
          role="switch"
          aria-checked={props.checked}
          class={`pv-switch${props.checked ? " on" : ""}`}
          title={props.label}
          onClick={() => props.onChange(!props.checked)}
        >
          <span />
        </button>
      ),
      Tooltip: (props: { value: string; children?: unknown }) => (
        <span title={props.value}>{props.children}</span>
      ),
    },
    dialogs: { confirm: async () => true },
    toast: {
      show: (toast: { title: string; description?: string; variant?: string }) => {
        toasts.push(toast);
        console.log("[toast]", toast.title, toast.description ?? "");
      },
    },
    client,
    layout: {
      open: () => {},
      settings: () => {},
      state: () => "closed" as const,
    },
    tabs: { open: () => {} },
  } as unknown as Context;

  const session = {
    id: "ses_preview",
    directory: "D:\\demo\\my-project",
    server: { id: "local", client },
    background: [],
  } as unknown as MountedSession;

  return { ctx, session, toasts };
}

function glyph(icon: string): string {
  switch (icon) {
    case "plus":
      return "+";
    case "trash":
      return "🗑";
    case "refresh":
      return "⟳";
    case "arrow-left":
      return "←";
    case "arrow-up-right":
      return "↗";
    case "check":
      return "✓";
    case "close":
    case "close-small":
      return "×";
    case "stop":
      return "■";
    case "branch":
      return "⌥";
    default:
      return "•";
  }
}
