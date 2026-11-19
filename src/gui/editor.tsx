/**
 * The subagent editor: identity, model picker, system prompt and the advanced properties OpenCode
 * accepts in an agent's frontmatter (mode, steps, color, visibility, permissions, request overlay).
 */
import type { Context } from "@opencode/plugin/gui";
import { createEffect, createMemo, createSignal, For, Index, Show, type JSX } from "solid-js";
import {
  AGENT_MODES,
  COMMON_ACTIONS,
  PERMISSION_EFFECTS,
  type AgentDraft,
  type AgentFile,
  type AgentMode,
  type AgentScope,
  type JsonValue,
  type PermissionEffect,
} from "../types.js";
import type { AgentsData, EffectiveAgent, ModelInfoLike, ModelsData } from "./data.js";
import { errorText } from "./data.js";
import {
  formatContext,
  modelReference,
  splitModel,
} from "./format.js";

export type AgentEditorSeed = {
  mode: "new" | "edit" | "override";
  scope: AgentScope;
  id: string;
  draft: AgentDraft;
  source?: AgentFile;
  effective?: EffectiveAgent;
  unknownKeys?: string[];
  parseError?: string;
  raw?: string;
};

type HeaderRow = { name: string; value: string };

const ID_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function validId(value: string): boolean {
  const id = value.trim().replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\.md$/i, "");
  if (!id) return false;
  const parts = id.split("/");
  return parts.length <= 6 && parts.every((part) => ID_SEGMENT.test(part));
}

function normalizeId(value: string): string {
  return value
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\.md$/i, "")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

function validModel(value: string): boolean {
  if (!value.trim()) return true;
  if (/\s/.test(value)) return false;
  const parsed = splitModel(value);
  return Boolean(parsed.providerID && parsed.modelID);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function modelKey(model: ModelInfoLike): string {
  return `${model.providerID}/${model.id}`;
}

function modeLabel(ctx: Context, mode: AgentMode): string {
  return ctx.t(`editor.mode.${mode}`);
}

function effectLabel(ctx: Context, effect: PermissionEffect): string {
  return ctx.t(`editor.effect.${effect}`);
}

export type AgentEditorProps = {
  ctx: Context;
  data: AgentsData;
  models: ModelsData;
  directory: () => string | undefined;
  files: () => readonly AgentFile[];
  seed: AgentEditorSeed;
  onCancel(): void;
  onSaved(): void;
  onDeleted(): void;
};

export function AgentEditor(props: AgentEditorProps): JSX.Element {
  const ctx = props.ctx;
  const seed = props.seed;
  const locked = () => seed.mode !== "new";

  const [id, setId] = createSignal(seed.id);
  const [scope, setScope] = createSignal<AgentScope>(seed.scope);
  const [draft, setDraft] = createSignal<AgentDraft>(clone(seed.draft));
  const [stepsText, setStepsText] = createSignal(seed.draft.steps?.toString() ?? "");
  const [colorText, setColorText] = createSignal(seed.draft.color ?? "");
  const [headers, setHeaders] = createSignal<HeaderRow[]>(
    Object.entries(seed.draft.request.headers).map(([name, value]) => ({ name, value })),
  );
  const [bodyText, setBodyText] = createSignal(
    seed.draft.request.body !== undefined ? JSON.stringify(seed.draft.request.body, null, 2) : "",
  );
  const [errors, setErrors] = createSignal<string[]>([]);
  const [saving, setSaving] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);

  const patch = (value: Partial<AgentDraft>) => setDraft({ ...draft(), ...value });
  const parsedModel = createMemo(() => splitModel(draft().model));
  const projectAvailable = () => Boolean(props.directory());

  const providerName = (providerID: string) =>
    props.models.providers().find((provider) => provider.id === providerID)?.name ?? providerID;

  const groups = createMemo(() => {
    const map = new Map<string, ModelInfoLike[]>();
    for (const model of props.models.models()) {
      const list = map.get(model.providerID);
      if (list) list.push(model);
      else map.set(model.providerID, [model]);
    }
    return [...map.entries()].sort((left, right) =>
      providerName(left[0]).localeCompare(providerName(right[0])),
    );
  });

  const unlistedModel = createMemo(() => {
    const base = parsedModel().base;
    if (!base) return undefined;
    return props.models.models().some((model) => modelKey(model) === base) ? undefined : base;
  });

  const selectedModel = createMemo(() =>
    props.models.models().find((model) => modelKey(model) === parsedModel().base),
  );

  const variantIds = createMemo(() => {
    const current = parsedModel().variant;
    const ids = (selectedModel()?.variants ?? []).map((variant) => variant.id);
    if (current && !ids.includes(current)) ids.push(current);
    return ids;
  });

  let modelSelect: HTMLSelectElement | undefined;
  createEffect(() => {
    // Read the groups so the value is re-applied after model options arrive.
    groups();
    const value = parsedModel().base;
    if (modelSelect && modelSelect.value !== value) modelSelect.value = value;
  });

  let variantSelect: HTMLSelectElement | undefined;
  createEffect(() => {
    variantIds();
    const value = parsedModel().variant;
    if (variantSelect && variantSelect.value !== value) variantSelect.value = value;
  });

  const changeModel = (base: string) => {
    const parsed = splitModel(base);
    const current = parsedModel();
    const keepVariant =
      base === current.base && current.variant && variantIds().includes(current.variant)
        ? current.variant
        : "";
    patch({
      model: base ? modelReference(parsed.providerID, parsed.modelID, keepVariant) : "",
    });
  };

  const changeVariant = (variant: string) => {
    const parsed = parsedModel();
    patch({
      model: parsed.base
        ? modelReference(parsed.providerID, parsed.modelID, variant || undefined)
        : "",
    });
  };

  const updateHeader = (index: number, value: Partial<HeaderRow>) => {
    setHeaders(headers().map((row, rowIndex) => (rowIndex === index ? { ...row, ...value } : row)));
  };

  const addHeader = () => setHeaders([...headers(), { name: "", value: "" }]);
  const removeHeader = (index: number) =>
    setHeaders(headers().filter((_row, rowIndex) => rowIndex !== index));

  const updateRule = (index: number, value: Partial<AgentDraft["permissions"][number]>) => {
    const permissions = draft().permissions.map((rule, ruleIndex) =>
      ruleIndex === index ? { ...rule, ...value } : rule,
    );
    patch({ permissions });
  };

  const addRule = () =>
    patch({
      permissions: [
        ...draft().permissions,
        { action: "shell", resource: "*", effect: "ask" },
      ],
    });

  const removeRule = (index: number) =>
    patch({
      permissions: draft().permissions.filter((_rule, ruleIndex) => ruleIndex !== index),
    });

  const parsedBody = () => {
    const text = bodyText().trim();
    if (!text) return { value: undefined as JsonValue | undefined };
    try {
      const value = JSON.parse(text) as unknown;
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { error: ctx.t("editor.error.body") };
      }
      return { value: value as JsonValue };
    } catch (failure) {
      return { error: ctx.t("editor.error.json", { message: errorText(failure) }) };
    }
  };
  const bodyError = createMemo(() => parsedBody().error);

  const headerObject = () => {
    const result: Record<string, string> = {};
    for (const row of headers()) {
      const name = row.name.trim();
      if (!name && !row.value) continue;
      if (!name) return undefined;
      result[name] = row.value;
    }
    return result;
  };

  const stepsValue = () => {
    const text = stepsText().trim();
    if (!text) return undefined;
    const value = Number(text);
    if (!Number.isInteger(value) || value < 1 || value > 1000) return Number.NaN;
    return value;
  };

  const colorValue = () => {
    const text = colorText().trim();
    if (!text) return undefined;
    return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : text;
  };

  const conflicts = createMemo(() => {
    if (!validId(id())) return { same: undefined, other: undefined };
    const normalized = normalizeId(id());
    return {
      same: props.files().find((file) => file.scope === scope() && file.id === normalized),
      other: props.files().find(
        (file) => file.scope !== scope() && file.id === normalized,
      ),
    };
  });

  const validate = (): string[] => {
    const problems: string[] = [];
    const normalized = normalizeId(id());
    if (!validId(id())) problems.push(ctx.t("editor.error.id"));
    if (draft().mode !== "primary" && !draft().description.trim()) {
      problems.push(ctx.t("editor.error.description"));
    }
    if (!validModel(draft().model)) problems.push(ctx.t("editor.error.model"));
    if (Number.isNaN(stepsValue())) problems.push(ctx.t("editor.error.steps"));
    const color = colorValue();
    if (color && !/^#[0-9a-f]{6}$/.test(color)) problems.push(ctx.t("editor.error.color"));
    const body = parsedBody();
    if (body.error) problems.push(body.error);
    if (headerObject() === undefined) problems.push(ctx.t("editor.error.header"));
    if (
      draft().permissions.some(
        (rule) => !rule.action.trim() || !rule.resource.trim() || !rule.effect,
      )
    ) {
      problems.push(ctx.t("editor.permission.invalid"));
    }
    if (seed.mode !== "edit" && conflicts().same) {
      problems.push(ctx.t("editor.conflict.same"));
    }
    return problems;
  };

  const payload = (): AgentDraft => {
    const body = parsedBody();
    const color = colorValue();
    const steps = stepsValue();
    return {
      ...draft(),
      description: draft().description.trim(),
      model: draft().model.trim(),
      ...(color ? { color } : {}),
      ...(steps !== undefined && !Number.isNaN(steps) ? { steps } : {}),
      permissions: draft().permissions.map((rule) => ({
        action: rule.action.trim(),
        resource: rule.resource.trim(),
        effect: rule.effect,
      })),
      request: {
        headers: headerObject() ?? {},
        ...(body.value !== undefined ? { body: body.value } : {}),
      },
      extra: seed.draft.extra,
    };
  };

  const snapshot = () =>
    JSON.stringify({
      id: id(),
      scope: scope(),
      draft: draft(),
      steps: stepsText(),
      color: colorText(),
      headers: headers(),
      body: bodyText(),
    });
  const initial = snapshot();
  const dirty = () => snapshot() !== initial;

  const save = async () => {
    if (saving() || seed.parseError) return;
    setErrors([]);
    const problems = validate();
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }

    setSaving(true);
    try {
      const clean = payload();
      const result = await props.data.save({
        scope: scope(),
        id: normalizeId(id()),
        create: seed.mode !== "edit",
        draft: clean,
      });

      if (result.warning) {
        ctx.toast.show({
          title: result.listed
            ? ctx.t("toast.saved", { id: normalizeId(id()) })
            : ctx.t("toast.notListed"),
          description: result.warning,
          variant: result.listed ? "success" : "error",
          persistent: !result.listed,
        });
      } else {
        ctx.toast.show({
          title: ctx.t("toast.saved", { id: normalizeId(id()) }),
          variant: "success",
        });
      }
      props.onSaved();
    } catch (failure) {
      setErrors([ctx.t("toast.saveFailed", { message: errorText(failure) })]);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!seed.source || deleting()) return;
    const confirmed = await ctx.dialogs.confirm({
      title: ctx.t("editor.delete.title"),
      description: ctx.t("editor.delete.description", { file: seed.source.file }),
      confirm: ctx.t("editor.delete.confirm"),
      danger: true,
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      const result = await props.data.remove({
        scope: seed.source.scope,
        id: seed.source.id,
      });
      if (result.warning) {
        ctx.toast.show({
          title: ctx.t("toast.deleted", { id: seed.source.id }),
          description: result.warning,
          variant: result.listed ? "error" : "success",
          persistent: result.listed,
        });
      } else if (result.listed) {
        ctx.toast.show({
          title: ctx.t("toast.stillListed", { id: seed.source.id }),
          variant: "error",
        });
      } else {
        ctx.toast.show({
          title: ctx.t("toast.deleted", { id: seed.source.id }),
          variant: "success",
        });
      }
      props.onDeleted();
    } catch (failure) {
      ctx.toast.show({
        title: ctx.t("toast.removeFailed", { message: errorText(failure) }),
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const close = async () => {
    if (!dirty()) {
      props.onCancel();
      return;
    }
    const confirmed = await ctx.dialogs.confirm({
      title: ctx.t("editor.unsaved.title"),
      description: ctx.t("editor.unsaved.description"),
      confirm: ctx.t("editor.unsaved.discard"),
      danger: true,
    });
    if (confirmed) props.onCancel();
  };

  const errorList = () => errors();

  const title = () => {
    if (seed.mode === "override") return ctx.t("editor.override", { id: seed.id });
    return seed.mode === "new" ? ctx.t("editor.new") : ctx.t("editor.edit");
  };

  return (
    <div class="sa-editor">
      <div class="sa-editor-head">
        <ctx.ui.IconButton
          icon="arrow-left"
          size="small"
          label={ctx.t("editor.back")}
          onClick={() => void close()}
        />
        <span class="sa-editor-title">{title()}</span>
      </div>

      <Show when={seed.parseError}>
        <div class="sa-parse-error">
          <p class="sa-error">{ctx.t("editor.parseError")}</p>
          <p class="sa-hint">{seed.parseError}</p>
          <Show when={seed.raw}>
            {(raw) => (
              <>
                <span class="sa-label">{ctx.t("editor.raw")}</span>
                <pre class="sa-pre">{raw()}</pre>
              </>
            )}
          </Show>
        </div>
      </Show>

      <Show when={!seed.parseError}>
        <Show when={errorList().length > 0}>
          <div class="sa-parse-error">
            <p class="sa-label">{ctx.t("editor.error.summary")}</p>
            <For each={errorList()}>
              {(message) => <p class="sa-inline-error">{message}</p>}
            </For>
          </div>
        </Show>

        <div class="sa-row2 sa-row-wide">
          <label class="sa-field">
            <span class="sa-label">
              {ctx.t("editor.id")} <span class="sa-required">*</span>
            </span>
            <input
              class="sa-input"
              classList={{ "sa-invalid": errorList().includes(ctx.t("editor.error.id")) }}
              value={id()}
              disabled={locked()}
              spellcheck={false}
              onInput={(event) => setId(event.currentTarget.value)}
            />
            <span class="sa-hint">{ctx.t("editor.id.hint")}</span>
          </label>

          <label class="sa-field">
            <span class="sa-label">{ctx.t("editor.scope")}</span>
            <select
              class="sa-select"
              value={scope()}
              disabled={locked()}
              onChange={(event) => setScope(event.currentTarget.value as AgentScope)}
            >
              <option value="global">{ctx.t("panel.scope.global")}</option>
              <option value="project" disabled={!projectAvailable()}>
                {ctx.t("panel.scope.project")}
              </option>
            </select>
            <span class="sa-hint">{ctx.t("editor.scope.hint")}</span>
          </label>
        </div>

        <Show when={conflicts().other}>
          <p class="sa-warning">{ctx.t("editor.conflict.other")}</p>
        </Show>

        <label class="sa-field">
          <span class="sa-label">
            {ctx.t("editor.description")} <span class="sa-required">*</span>
          </span>
          <input
            class="sa-input"
            classList={{
              "sa-invalid": errorList().includes(ctx.t("editor.error.description")),
            }}
            value={draft().description}
            onInput={(event) => patch({ description: event.currentTarget.value })}
          />
          <span class="sa-hint">{ctx.t("editor.description.hint")}</span>
        </label>

        <div class="sa-row2">
          <label class="sa-field">
            <span class="sa-label">{ctx.t("editor.mode")}</span>
            <select
              class="sa-select"
              value={draft().mode}
              onChange={(event) => patch({ mode: event.currentTarget.value as AgentMode })}
            >
              <For each={AGENT_MODES}>
                {(mode) => <option value={mode}>{modeLabel(ctx, mode)}</option>}
              </For>
            </select>
            <span class="sa-hint">{ctx.t("editor.mode.hint")}</span>
          </label>
        </div>

        <div class="sa-row2 sa-row-wide">
          <label class="sa-field">
            <span class="sa-label">{ctx.t("editor.model")}</span>
            <select
              ref={modelSelect}
              class="sa-select"
              classList={{ "sa-invalid": errorList().includes(ctx.t("editor.error.model")) }}
              value={parsedModel().base}
              onChange={(event) => changeModel(event.currentTarget.value)}
            >
              <option value="">{ctx.t("editor.model.inherit")}</option>
              <Show when={unlistedModel()}>
                {(value) => <option value={value()}>{value()}</option>}
              </Show>
              <For each={groups()}>
                {([providerID, models]) => (
                  <optgroup label={providerName(providerID)}>
                    <For each={models}>
                      {(model) => <option value={modelKey(model)}>{model.name}</option>}
                    </For>
                  </optgroup>
                )}
              </For>
            </select>
            <span class="sa-hint">
              {selectedModel()
                ? ctx.t("editor.model.meta", {
                    context: formatContext(selectedModel()!.limit?.context ?? 0),
                    output: formatContext(selectedModel()!.limit?.output ?? 0),
                    variants:
                      (selectedModel()!.variants?.length ?? 0) > 0
                        ? ctx.t("editor.model.variants", {
                            count: String(selectedModel()!.variants!.length),
                          })
                        : "",
                  })
                : ctx.t("editor.model.hint")}
            </span>
          </label>

          <label class="sa-field">
            <span class="sa-label">{ctx.t("editor.variant")}</span>
            <select
              ref={variantSelect}
              class="sa-select"
              value={parsedModel().variant}
              disabled={!parsedModel().base || variantIds().length === 0}
              onChange={(event) => changeVariant(event.currentTarget.value)}
            >
              <option value="">{ctx.t("editor.variant.default")}</option>
              <For each={variantIds()}>
                {(variant) => <option value={variant}>{variant}</option>}
              </For>
            </select>
            <Show when={props.models.error()}>
              {(message) => <span class="sa-hint">{message()}</span>}
            </Show>
          </label>
        </div>

        <label class="sa-field">
          <span class="sa-label">{ctx.t("editor.system")}</span>
          <textarea
            class="sa-textarea sa-body"
            value={draft().system}
            spellcheck={false}
            onInput={(event) => patch({ system: event.currentTarget.value })}
          />
          <span class="sa-hint">{ctx.t("editor.system.hint")}</span>
        </label>

        <details class="sa-advanced">
          <summary>
            {ctx.t("editor.advanced")}
            <span class="sa-summary-hint">{ctx.t("editor.advanced.summary")}</span>
          </summary>
          <div class="sa-advanced-body">
            <div class="sa-row2">
              <label class="sa-field">
                <span class="sa-label">{ctx.t("editor.steps")}</span>
                <input
                  class="sa-input"
                  classList={{ "sa-invalid": errorList().includes(ctx.t("editor.error.steps")) }}
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  value={stepsText()}
                  onInput={(event) => setStepsText(event.currentTarget.value)}
                />
                <span class="sa-hint">{ctx.t("editor.steps.hint")}</span>
              </label>

              <label class="sa-field">
                <span class="sa-label">{ctx.t("editor.color")}</span>
                <div class="sa-color">
                  <input
                    class="sa-input"
                    classList={{
                      "sa-invalid": errorList().includes(ctx.t("editor.error.color")),
                    }}
                    value={colorText()}
                    placeholder="#ff6b6b"
                    spellcheck={false}
                    onInput={(event) => setColorText(event.currentTarget.value)}
                  />
                  <span
                    class="sa-swatch"
                    style={{
                      background: /^#[0-9a-fA-F]{6}$/.test(colorText().trim())
                        ? colorText().trim()
                        : "transparent",
                    }}
                    aria-hidden="true"
                  />
                </div>
                <span class="sa-hint">{ctx.t("editor.color.hint")}</span>
              </label>
            </div>

            <div class="sa-row2">
              <div class="sa-field">
                <span class="sa-label">{ctx.t("editor.hidden")}</span>
                <ctx.ui.Switch
                  label={ctx.t("editor.hidden")}
                  hideLabel
                  checked={draft().hidden}
                  onChange={(checked) => patch({ hidden: checked })}
                />
                <span class="sa-hint">{ctx.t("editor.hidden.hint")}</span>
              </div>
              <div class="sa-field">
                <span class="sa-label">{ctx.t("editor.disabled")}</span>
                <ctx.ui.Switch
                  label={ctx.t("editor.disabled")}
                  hideLabel
                  checked={draft().disabled}
                  onChange={(checked) => patch({ disabled: checked })}
                />
                <span class="sa-hint">{ctx.t("editor.disabled.hint")}</span>
              </div>
            </div>

            <div class="sa-field">
              <div class="sa-subhead">
                <span class="sa-label">{ctx.t("editor.permissions")}</span>
                <span class="sa-spacer" />
                <ctx.ui.Button
                  size="small"
                  variant="ghost"
                  icon="plus"
                  onClick={addRule}
                >
                  {ctx.t("editor.permissions.add")}
                </ctx.ui.Button>
              </div>
              <span class="sa-hint">{ctx.t("editor.permissions.hint")}</span>
              <Show
                when={draft().permissions.length > 0}
                fallback={<p class="sa-hint">{ctx.t("editor.permissions.empty")}</p>}
              >
                <Index each={draft().permissions}>
                  {(rule, index) => (
                    <div class="sa-perm">
                      <input
                        class="sa-input"
                        list="sa-actions"
                        value={rule().action}
                        placeholder={ctx.t("editor.permission.action")}
                        onInput={(event) =>
                          updateRule(index, { action: event.currentTarget.value })
                        }
                      />
                      <input
                        class="sa-input sa-perm-resource"
                        value={rule().resource}
                        placeholder="*"
                        spellcheck={false}
                        onInput={(event) =>
                          updateRule(index, { resource: event.currentTarget.value })
                        }
                      />
                      <select
                        class="sa-select"
                        value={rule().effect}
                        onChange={(event) =>
                          updateRule(index, {
                            effect: event.currentTarget.value as PermissionEffect,
                          })
                        }
                      >
                        <For each={PERMISSION_EFFECTS}>
                          {(effect) => <option value={effect}>{effectLabel(ctx, effect)}</option>}
                        </For>
                      </select>
                      <span class="sa-perm-remove">
                        <ctx.ui.IconButton
                          icon="close-small"
                          size="small"
                          label={ctx.t("editor.permission.remove")}
                          onClick={() => removeRule(index)}
                        />
                      </span>
                    </div>
                  )}
                </Index>
              </Show>
              <datalist id="sa-actions">
                <For each={COMMON_ACTIONS}>{(action) => <option value={action} />}</For>
              </datalist>
            </div>

            <div class="sa-field">
              <div class="sa-subhead">
                <span class="sa-label">{ctx.t("editor.headers")}</span>
                <span class="sa-spacer" />
                <ctx.ui.Button
                  size="small"
                  variant="ghost"
                  icon="plus"
                  onClick={addHeader}
                >
                  {ctx.t("editor.headers.add")}
                </ctx.ui.Button>
              </div>
              <span class="sa-hint">{ctx.t("editor.request.hint")}</span>
              <Show
                when={headers().length > 0}
                fallback={<p class="sa-hint">{ctx.t("editor.headers.empty")}</p>}
              >
                <Index each={headers()}>
                  {(header, index) => (
                    <div class="sa-header-row">
                      <input
                        class="sa-input"
                        value={header().name}
                        placeholder={ctx.t("editor.header.name")}
                        spellcheck={false}
                        onInput={(event) =>
                          updateHeader(index, { name: event.currentTarget.value })
                        }
                      />
                      <input
                        class="sa-input sa-header-value"
                        value={header().value}
                        placeholder={ctx.t("editor.header.value")}
                        spellcheck={false}
                        onInput={(event) =>
                          updateHeader(index, { value: event.currentTarget.value })
                        }
                      />
                      <span class="sa-perm-remove">
                        <ctx.ui.IconButton
                          icon="close-small"
                          size="small"
                          label={ctx.t("editor.header.remove")}
                          onClick={() => removeHeader(index)}
                        />
                      </span>
                    </div>
                  )}
                </Index>
              </Show>
            </div>

            <label class="sa-field">
              <span class="sa-label">{ctx.t("editor.body")}</span>
              <textarea
                class="sa-textarea"
                classList={{
                  "sa-invalid": Boolean(bodyError()),
                }}
                value={bodyText()}
                spellcheck={false}
                placeholder={'{\\n  "temperature": 0.1\\n}'}
                onInput={(event) => setBodyText(event.currentTarget.value)}
              />
              <span class="sa-hint">{ctx.t("editor.body.hint")}</span>
            </label>

            <Show when={(seed.unknownKeys?.length ?? 0) > 0}>
              <p class="sa-hint">
                {ctx.t("editor.extra.note", { keys: (seed.unknownKeys ?? []).join(", ") })}
              </p>
            </Show>
          </div>
        </details>
      </Show>

      <div class="sa-actions">
        <ctx.ui.Button
          variant="contrast"
          icon="check"
          busy={saving()}
          disabled={Boolean(seed.parseError)}
          onClick={() => void save()}
        >
          {saving() ? ctx.t("editor.saving") : ctx.t("editor.save")}
        </ctx.ui.Button>
        <ctx.ui.Button variant="neutral" icon="close" onClick={() => void close()}>
          {ctx.t("editor.cancel")}
        </ctx.ui.Button>
        <Show when={seed.source}>
          <ctx.ui.Button
            class="sa-delete"
            variant="danger"
            icon="trash"
            busy={deleting()}
            onClick={() => void remove()}
          >
            {ctx.t("editor.delete")}
          </ctx.ui.Button>
        </Show>
      </div>
    </div>
  );
}
