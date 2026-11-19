/**
 * The live tracker: subagent child sessions under the routed session, with their status, model,
 * token count and cost. Running rows can be opened or stopped.
 */
import type { Context, MountedSession } from "@opencode/plugin/gui";
import { createSignal, Index, onCleanup, Show } from "solid-js";
import type { LiveData, RunNode } from "./data.js";
import { errorText } from "./data.js";
import {
  formatAgo,
  formatCost,
  formatElapsed,
  formatTokens,
  modelReference,
  shortModel,
  statusLabelKey,
  totalTokens,
} from "./format.js";

function clock(): () => number {
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 1_000);
  onCleanup(() => clearInterval(timer));
  return now;
}

function RunRow(props: {
  ctx: Context;
  data: LiveData;
  row: () => RunNode;
  now: () => number;
}) {
  const ctx = props.ctx;
  const [stopping, setStopping] = createSignal(false);
  const session = () => props.row().session;

  const statusKey = () => statusLabelKey(session().outcome, props.row().running);
  const dotClass = () => {
    if (props.row().running) return "sa-dot sa-dot-live";
    if (session().outcome === "failed") return "sa-dot sa-dot-fail";
    if (session().outcome === "interrupted") return "sa-dot sa-dot-warn";
    return "sa-dot";
  };

  const model = () => {
    const value = session().model;
    if (!value) return "";
    return shortModel(modelReference(value.providerID, value.id, value.variant));
  };

  const stop = async () => {
    if (stopping()) return;
    setStopping(true);
    try {
      await props.data.stop(session().id);
      ctx.toast.show({ title: ctx.t("toast.stopped", { id: session().agent ?? session().id }) });
    } catch (failure) {
      ctx.toast.show({
        title: ctx.t("toast.stopFailed", { message: errorText(failure) }),
        variant: "error",
      });
    } finally {
      setStopping(false);
    }
  };

  return (
    <div
      class="sa-run"
      classList={{ "sa-running": props.row().running }}
      style={{ "margin-left": `${Math.max(0, props.row().depth - 1) * 10}px` }}
    >
      <div class="sa-run-top">
        <span class={dotClass()} aria-hidden="true" />
        <span class="sa-run-agent" title={session().agent ?? ""}>
          {session().agent ?? ctx.t("panel.unknown")}
        </span>
        <span class="sa-run-title" title={session().title ?? session().id}>
          {session().title ?? session().id}
        </span>
        <span class="sa-run-actions">
          <Show when={props.row().running}>
            <ctx.ui.IconButton
              icon="stop"
              size="small"
              label={ctx.t("panel.live.stop")}
              busy={stopping()}
              onClick={(event) => {
                event.stopPropagation();
                void stop();
              }}
            />
          </Show>
          <ctx.ui.IconButton
            icon="arrow-up-right"
            size="small"
            label={ctx.t("panel.live.open")}
            onClick={(event) => {
              event.stopPropagation();
              props.data.open(session().id);
            }}
          />
        </span>
      </div>

      <div class="sa-run-meta">
        <span>{ctx.t(statusKey())}</span>
        <Show when={model()}>
          <span title={model()}>{model()}</span>
        </Show>
        <span>{formatTokens(totalTokens(session().tokens))} tok</span>
        <span>{formatCost(session().cost)}</span>
        <Show
          when={props.row().running}
          fallback={
            <span>{formatAgo(session().time.updated, props.now())}</span>
          }
        >
          <span>{formatElapsed(props.now() - session().time.created)}</span>
        </Show>
      </div>
    </div>
  );
}

export function LiveSection(props: {
  ctx: Context;
  data: LiveData;
  session: () => MountedSession;
}) {
  const ctx = props.ctx;
  const now = clock();
  const rows = () => props.data.rows();

  return (
    <section class="sa-section">
      <Show when={props.data.error()}>
        {(message) => <p class="sa-warning">{message()}</p>}
      </Show>

      <Show
        when={rows().length > 0}
        fallback={
          <Show
            when={props.data.loading()}
            fallback={<p class="sa-empty">{ctx.t("panel.live.empty")}</p>}
          >
            <p class="sa-loading">
              <span class="sa-spinner" />
              {ctx.t("panel.loading")}
            </p>
          </Show>
        }
      >
        <Index each={rows()}>
          {(row) => (
            <RunRow ctx={ctx} data={props.data} row={row} now={now} />
          )}
        </Index>
      </Show>
    </section>
  );
}
