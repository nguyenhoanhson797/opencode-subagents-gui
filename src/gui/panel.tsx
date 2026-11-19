/**
 * The Subagents tab in a session's side panel: only the live tracker for the routed session.
 *
 * Creating, editing, overriding and deleting agent files happens in Settings › Subagents, which
 * renders `AgentManager`. This panel keeps a shortcut there.
 */
import type { Context, MountedSession } from "@opencode/plugin/gui";
import { Show } from "solid-js";
import { createLiveData } from "./data.js";
import { SETTINGS_PAGE_ID } from "./ids.js";
import { LiveSection } from "./live.js";

export type PanelPrefs = {
  refreshMs: () => number;
  live: () => boolean;
};

export type SubagentsPanelProps = {
  ctx: Context;
  session: () => MountedSession;
  prefs: PanelPrefs;
};

export function SubagentsPanel(props: SubagentsPanelProps) {
  const ctx = props.ctx;
  const liveData = createLiveData(ctx, props.session, () => props.prefs.refreshMs());
  const running = () =>
    Math.max(
      liveData.running(),
      props.session().background.filter((task) => task.type === "subagent").length,
    );

  return (
    <div class="sa-root" data-mode={ctx.appearance.mode()}>
      <div class="sa-head">
        <div class="sa-head-main">
          <h2 class="sa-title">{ctx.t("panel.title")}</h2>
          <p class="sa-sub">
            {ctx.t("panel.live.summary", {
              running: String(running()),
              total: String(liveData.total()),
            })}
          </p>
        </div>
        <div class="sa-toolbar">
          <ctx.ui.IconButton
            icon="refresh"
            size="small"
            label={ctx.t("panel.refresh")}
            busy={liveData.loading()}
            onClick={() => void liveData.load()}
          />
          <ctx.ui.Button
            size="small"
            variant="neutral"
            icon="edit"
            onClick={() => ctx.layout.settings(SETTINGS_PAGE_ID)}
          >
            {ctx.t("panel.manage")}
          </ctx.ui.Button>
        </div>
      </div>

      <Show
        when={props.prefs.live()}
        fallback={<p class="sa-empty">{ctx.t("panel.live.off")}</p>}
      >
        <LiveSection ctx={ctx} data={liveData} session={props.session} />
      </Show>

      <p class="sa-note">{ctx.t("panel.panelNote")}</p>
    </div>
  );
}
