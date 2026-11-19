/**
 * The agent manager used by the Settings page: the Markdown agent files in this project and
 * globally, the effective definitions OpenCode reports, and the editor for a new, existing or
 * overriding definition.
 *
 * The session side panel no longer renders this; it only tracks subagent runs.
 */
import type { Context } from "@opencode/plugin/gui";
import { createEffect, createMemo, createSignal, For, Show, type JSX } from "solid-js";
import {
  emptyDraft,
  type AgentDraft,
  type AgentFile,
  type AgentMode,
  type AgentScope,
  type JsonValue,
  type PermissionEffect,
  type PermissionRule,
} from "../types.js";
import {
  createAgentsData,
  createModelsData,
  errorText,
  type EffectiveAgent,
} from "./data.js";
import { AgentEditor, type AgentEditorSeed } from "./editor.js";
import { modelReference, shortModel } from "./format.js";

const MAINTENANCE = new Set(["compaction", "title", "summary"]);
const BUILTINS = new Set(["build", "plan", "general", "explore"]);

function modeKey(mode: AgentMode | undefined): string {
  return `editor.mode.${mode ?? "subagent"}`;
}

function draftFromEffective(agent: EffectiveAgent): AgentDraft {
  const model = agent.model
    ? modelReference(agent.model.providerID, agent.model.id, agent.model.variant)
    : "";
  const permissions: PermissionRule[] = (agent.permissions ?? [])
    .map((rule) => ({
      action: String(rule.action ?? ""),
      resource: String(rule.resource ?? ""),
      effect: rule.effect as PermissionEffect,
    }))
    .filter(
      (rule) =>
        rule.action &&
        rule.resource &&
        (rule.effect === "allow" || rule.effect === "ask" || rule.effect === "deny"),
    );

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(agent.request?.headers ?? {})) {
    headers[name] = String(value);
  }

  const body = agent.request?.body as JsonValue | undefined;
  return {
    description: agent.description ?? "",
    mode: agent.mode ?? "subagent",
    model,
    system: "",
    ...(agent.steps ? { steps: agent.steps } : {}),
    ...(agent.color ? { color: agent.color } : {}),
    hidden: agent.hidden ?? false,
    disabled: false,
    permissions,
    request: { headers, ...(body !== undefined ? { body } : {}) },
    extra: "",
  };
}

function matches(query: string, values: Array<string | undefined>): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => value?.toLowerCase().includes(needle));
}

function modelOf(agent: EffectiveAgent): string {
  if (!agent.model) return "";
  return shortModel(modelReference(agent.model.providerID, agent.model.id, agent.model.variant));
}

function AgentRow(props: {
  ctx: Context;
  title: string;
  id: string;
  description?: string;
  mode?: AgentMode;
  model?: string;
  scope?: AgentScope;
  source?: "builtin" | "config";
  hidden?: boolean;
  disabled?: boolean;
  shadowed?: boolean;
  parseError?: boolean;
  onOpen: () => void;
  onDelete?: () => void;
  onOverride?: () => void;
}) {
  const ctx = props.ctx;
  return (
    <div
      class="sa-agent"
      role="button"
      tabindex="0"
      onClick={props.onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onOpen();
        }
      }}
    >
      <div class="sa-agent-main">
        <div class="sa-agent-line">
          <span class="sa-agent-name" title={props.id}>
            {props.title}
          </span>
          <Show when={props.scope === "project"}>
            <span class="sa-badge sa-badge-project">{ctx.t("panel.group.project")}</span>
          </Show>
          <Show when={props.scope === "global"}>
            <span class="sa-badge sa-badge-global">{ctx.t("panel.group.global")}</span>
          </Show>
          <Show when={props.mode && props.mode !== "subagent"}>
            <span class="sa-badge">{ctx.t(modeKey(props.mode))}</span>
          </Show>
          <Show when={props.source}>
            {(source) => (
              <span class="sa-badge sa-badge-override">
                {ctx.t(
                  source() === "builtin" ? "panel.source.builtin" : "panel.source.config",
                )}
              </span>
            )}
          </Show>
          <Show when={props.hidden}>
            <span class="sa-badge sa-badge-hidden">{ctx.t("panel.badge.hidden")}</span>
          </Show>
          <Show when={props.disabled}>
            <span class="sa-badge sa-badge-disabled">{ctx.t("panel.badge.disabled")}</span>
          </Show>
          <Show when={props.shadowed}>
            <span class="sa-badge sa-badge-hidden" title={ctx.t("panel.shadowed")}>
              {ctx.t("panel.badge.override")}
            </span>
          </Show>
          <Show when={props.parseError}>
            <span class="sa-badge sa-badge-disabled">!</span>
          </Show>
        </div>
        <Show when={props.description}>
          <span class="sa-agent-desc">{props.description}</span>
        </Show>
        <span class="sa-agent-meta">
          {[props.id, props.model ? shortModel(props.model) : ""].filter(Boolean).join(" · ")}
        </span>
      </div>
      <span class="sa-agent-actions">
        <Show when={props.onOverride}>
          <ctx.ui.IconButton
            icon="plus"
            size="small"
            label={ctx.t("panel.override")}
            onClick={(event) => {
              event.stopPropagation();
              props.onOverride?.();
            }}
          />
        </Show>
        <Show when={props.onDelete}>
          <ctx.ui.IconButton
            icon="trash"
            size="small"
            label={ctx.t("panel.remove")}
            onClick={(event) => {
              event.stopPropagation();
              props.onDelete?.();
            }}
          />
        </Show>
      </span>
    </div>
  );
}

function Group(props: { ctx: Context; title: string; count: number; children: JSX.Element }) {
  return (
    <div class="sa-group">
      <h4 class="sa-group-title">
        {props.title}
        <span class="sa-section-count">{props.count}</span>
      </h4>
      {props.children}
    </div>
  );
}

export type AgentManagerProps = {
  ctx: Context;
  directory: () => string | undefined;
  defaultScope: () => AgentScope;
  showHidden: () => boolean;
  /** Increments when a command or menu asks for the new-agent editor. */
  newRequest: () => number;
  onNewRequestConsumed: () => void;
};

export function AgentManager(props: AgentManagerProps) {
  const ctx = props.ctx;

  const agentsData = createAgentsData(ctx, props.directory);
  const modelsData = createModelsData(ctx, props.directory);

  const [editing, setEditing] = createSignal<AgentEditorSeed>();
  const [query, setQuery] = createSignal("");

  createEffect(() => {
    // Re-read when Settings is opened with a different routed project.
    props.directory();
    void agentsData.load();
    void modelsData.load();
  });

  const openNew = () => {
    setEditing({
      mode: "new",
      scope: props.directory() && props.defaultScope() === "project" ? "project" : "global",
      id: "",
      draft: emptyDraft(),
    });
  };

  createEffect(() => {
    if (props.newRequest() > 0) {
      props.onNewRequestConsumed();
      openNew();
    }
  });

  const openEdit = (file: AgentFile) => {
    setEditing({
      mode: "edit",
      scope: file.scope,
      id: file.id,
      draft: file.draft,
      source: file,
      unknownKeys: file.unknownKeys,
      ...(file.error ? { parseError: file.error, raw: file.raw } : {}),
    });
  };

  const openOverride = (agent: EffectiveAgent) => {
    setEditing({
      mode: "override",
      scope: props.directory() && props.defaultScope() === "project" ? "project" : "global",
      id: agent.id,
      draft: draftFromEffective(agent),
      effective: agent,
    });
  };

  const removeFile = async (file: AgentFile) => {
    const confirmed = await ctx.dialogs.confirm({
      title: ctx.t("editor.delete.title"),
      description: ctx.t("editor.delete.description", { file: file.file }),
      confirm: ctx.t("editor.delete.confirm"),
      danger: true,
    });
    if (!confirmed) return;
    try {
      const result = await agentsData.remove({ scope: file.scope, id: file.id });
      if (result.warning) {
        ctx.toast.show({
          title: ctx.t("toast.deleted", { id: file.id }),
          description: result.warning,
          variant: result.listed ? "error" : "success",
          persistent: result.listed,
        });
      } else if (result.listed) {
        ctx.toast.show({
          title: ctx.t("toast.stillListed", { id: file.id }),
          variant: "error",
        });
      } else {
        ctx.toast.show({
          title: ctx.t("toast.deleted", { id: file.id }),
          variant: "success",
        });
      }
    } catch (failure) {
      ctx.toast.show({
        title: ctx.t("toast.removeFailed", { message: errorText(failure) }),
        variant: "error",
      });
    }
  };

  const files = () => agentsData.agents() ?? [];
  const effective = () => agentsData.effective();

  const fileIds = createMemo(() => new Set(files().map((file) => file.id)));
  const projectIds = createMemo(
    () => new Set(files().filter((file) => file.scope === "project").map((file) => file.id)),
  );

  const visibleFiles = createMemo(() =>
    files()
      .filter((file) =>
        matches(query(), [file.id, file.draft.description, file.draft.model, file.file]),
      )
      .sort((left, right) => left.id.localeCompare(right.id)),
  );

  const projectFiles = createMemo(() =>
    visibleFiles().filter((file) => file.scope === "project"),
  );
  const globalFiles = createMemo(() =>
    visibleFiles().filter((file) => file.scope === "global"),
  );

  const extraAgents = createMemo(() =>
    effective()
      .filter((agent) => !fileIds().has(agent.id))
      .filter((agent) => !MAINTENANCE.has(agent.id))
      .filter((agent) => (agent.mode ?? "subagent") !== "primary")
      .filter((agent) => props.showHidden() || !agent.hidden)
      .filter((agent) =>
        matches(query(), [agent.id, agent.name, agent.description, agent.model?.id]),
      )
      .sort((left, right) => left.id.localeCompare(right.id)),
  );

  const total = () => files().length + extraAgents().length;
  const filtered = () => visibleFiles().length + extraAgents().length;

  return (
    <div class="sa-root sa-manage" data-mode={ctx.appearance.mode()}>
      <Show
        when={editing()}
        fallback={
          <>
            <div class="sa-head">
              <div class="sa-head-main">
                <h2 class="sa-title">{ctx.t("panel.title")}</h2>
                <p class="sa-sub">{ctx.t("panel.count", { count: String(total()) })}</p>
              </div>
              <div class="sa-toolbar">
                <ctx.ui.IconButton
                  icon="refresh"
                  size="small"
                  label={ctx.t("panel.refresh")}
                  busy={agentsData.loading()}
                  onClick={() => {
                    void agentsData.load();
                    void modelsData.load();
                  }}
                />
                <ctx.ui.Button
                  size="small"
                  variant="contrast"
                  icon="plus"
                  onClick={openNew}
                >
                  {ctx.t("panel.new")}
                </ctx.ui.Button>
              </div>
            </div>

            <input
              class="sa-input sa-search"
              type="search"
              value={query()}
              placeholder={ctx.t("panel.search.placeholder")}
              aria-label={ctx.t("panel.search")}
              onInput={(event) => setQuery(event.currentTarget.value)}
            />

            <Show when={agentsData.error()}>
              {(message) => (
                <p class="sa-error">
                  {ctx.t("panel.error.load", { message: message() })}
                </p>
              )}
            </Show>

            <Show when={agentsData.warnings().length > 0}>
              <For each={agentsData.warnings()}>
                {(warning) => (
                  <p class="sa-warning">{ctx.t("panel.warning", { message: warning })}</p>
                )}
              </For>
            </Show>

            <Show
              when={!agentsData.loading() || total() > 0}
              fallback={
                <p class="sa-loading">
                  <span class="sa-spinner" />
                  {ctx.t("panel.loading")}
                </p>
              }
            >
              <Show
                when={filtered() > 0}
                fallback={
                  <p class="sa-empty">
                    {query().trim() ? ctx.t("panel.empty.filtered") : ctx.t("panel.empty")}
                  </p>
                }
              >
                <Show when={projectFiles().length > 0}>
                  <Group
                    ctx={ctx}
                    title={ctx.t("panel.group.project")}
                    count={projectFiles().length}
                  >
                    <For each={projectFiles()}>
                      {(file) => (
                        <AgentRow
                          ctx={ctx}
                          title={file.id}
                          id={file.id}
                          description={file.draft.description}
                          mode={file.draft.mode}
                          model={file.draft.model}
                          scope={file.scope}
                          hidden={file.draft.hidden}
                          disabled={file.draft.disabled}
                          parseError={Boolean(file.error)}
                          onOpen={() => openEdit(file)}
                          onDelete={() => void removeFile(file)}
                        />
                      )}
                    </For>
                  </Group>
                </Show>

                <Show when={globalFiles().length > 0}>
                  <Group
                    ctx={ctx}
                    title={ctx.t("panel.group.global")}
                    count={globalFiles().length}
                  >
                    <For each={globalFiles()}>
                      {(file) => (
                        <AgentRow
                          ctx={ctx}
                          title={file.id}
                          id={file.id}
                          description={file.draft.description}
                          mode={file.draft.mode}
                          model={file.draft.model}
                          scope={file.scope}
                          hidden={file.draft.hidden}
                          disabled={file.draft.disabled}
                          shadowed={projectIds().has(file.id)}
                          parseError={Boolean(file.error)}
                          onOpen={() => openEdit(file)}
                          onDelete={() => void removeFile(file)}
                        />
                      )}
                    </For>
                  </Group>
                </Show>

                <Show when={extraAgents().length > 0}>
                  <Group
                    ctx={ctx}
                    title={ctx.t("panel.group.builtin")}
                    count={extraAgents().length}
                  >
                    <For each={extraAgents()}>
                      {(agent) => (
                        <AgentRow
                          ctx={ctx}
                          title={agent.name ?? agent.id}
                          id={agent.id}
                          description={agent.description}
                          mode={agent.mode}
                          model={modelOf(agent)}
                          source={BUILTINS.has(agent.id) ? "builtin" : "config"}
                          hidden={agent.hidden}
                          onOpen={() => openOverride(agent)}
                          onOverride={() => openOverride(agent)}
                        />
                      )}
                    </For>
                  </Group>
                </Show>
              </Show>
            </Show>

            <p class="sa-note">{ctx.t("panel.aiNote")}</p>

            <Show when={agentsData.dirs()}>
              {(dirs) => (
                <div class="sa-paths">
                  <span class="sa-label">{ctx.t("panel.paths")}</span>
                  <span>{ctx.t("panel.paths.global", { path: dirs().global })}</span>
                  <Show when={dirs().project}>
                    {(project) => (
                      <span>{ctx.t("panel.paths.project", { path: project() })}</span>
                    )}
                  </Show>
                  <Show when={!dirs().project}>
                    <span>{ctx.t("panel.noProject")}</span>
                  </Show>
                </div>
              )}
            </Show>
          </>
        }
      >
        {(seed) => (
          <AgentEditor
            ctx={ctx}
            data={agentsData}
            models={modelsData}
            directory={props.directory}
            files={files}
            seed={seed()}
            onCancel={() => setEditing(undefined)}
            onSaved={() => setEditing(undefined)}
            onDeleted={() => setEditing(undefined)}
          />
        )}
      </Show>
    </div>
  );
}
