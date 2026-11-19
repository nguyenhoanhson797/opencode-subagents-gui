/**
 * The plugin's GUI part for OpenCode Desktop: the package's `./gui-experimental` entry.
 *
 * It contributes a Subagents tab to a session's side panel that tracks the subagents running in
 * that session, a Settings page that creates, edits, overrides and deletes the Markdown agent
 * files, a panel-menu entry and palette commands. The window reads and writes agent files only
 * through the plugin's own server part over RPC; it never touches disk.
 */
import {
  Command,
  MenuItem,
  Panel,
  type PanelTab,
  Plugin,
  SettingsPage,
  Store,
  Style,
} from "@opencode/plugin/gui";
import { Schema } from "effect";
import { createSignal } from "solid-js";
import type { AgentScope } from "../types.js";
import { en } from "./i18n.js";
import { PANEL_ID, SETTINGS_PAGE_ID } from "./ids.js";
import { SubagentsPanel } from "./panel.js";
import { SubagentsSettings } from "./settings.js";
import { STYLE } from "./style.js";

const Prefs = Schema.Struct({
  panel: Schema.Boolean,
  live: Schema.Boolean,
  /** "global" or "project"; kept as a string so an older stored value falls back instead of rejecting. */
  defaultScope: Schema.String,
  /** "0" turns polling off; otherwise seconds between live reads. */
  refreshSeconds: Schema.String,
  showHidden: Schema.Boolean,
});

export default Plugin.define({
  i18n: { en },
  stores: {
    prefs: Store.global(Prefs, {
      panel: true,
      live: true,
      defaultScope: "global",
      refreshSeconds: "3",
      showHidden: false,
    }),
  },
  setup(ctx) {
    const prefs = ctx.stores.prefs;
    const panelKey = `${ctx.id}:${PANEL_ID}`;
    // A command can ask the Settings page to open the editor for a new agent.
    const [newAgentRequest, setNewAgentRequest] = createSignal(0);

    const openPanel = (session = ctx.sessions.current()) => {
      if (!session) {
        ctx.toast.show({ title: ctx.t("toast.noSession") });
        return false;
      }
      ctx.layout.open(panelKey, session, { tab: "select" });
      return true;
    };

    const openSettings = () => {
      ctx.layout.settings(SETTINGS_PAGE_ID);
    };

    const requestNewAgent = () => {
      setNewAgentRequest((value) => value + 1);
      openSettings();
    };

    const defaultScope = (): AgentScope =>
      prefs.value.defaultScope === "project" ? "project" : "global";

    const refreshSeconds = () =>
      ["0", "2", "3", "5", "10"].includes(prefs.value.refreshSeconds)
        ? prefs.value.refreshSeconds
        : "3";

    const refreshMs = () => {
      const seconds = Number(refreshSeconds());
      return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1_000) : 0;
    };

    ctx.add(Style, STYLE);

    ctx.add(Command, () => ({
      id: "subagents",
      title: ctx.t("command.open"),
      description: ctx.t("command.open.description"),
      keywords: "agents subagents subagent markdown model permissions review",
      featured: true as const,
      slash: { name: "subagents" },
      run: () => void openPanel(),
    }));

    ctx.add(Command, () => ({
      id: "subagents-new",
      title: ctx.t("panel.new"),
      description: ctx.t("command.new.description"),
      keywords: "new agent subagent create",
      section: "session" as const,
      run: requestNewAgent,
    }));

    let tab: PanelTab | undefined;
    const panelTab = () => {
      const title = ctx.t("panel.title");
      if (tab?.title !== title) tab = { id: PANEL_ID, title, closable: "compact" };
      return tab;
    };

    ctx.add(Panel, {
      id: PANEL_ID,
      region: "side",
      width: "narrow",
      mobile: {
        get title() {
          return ctx.t("panel.title");
        },
        order: 41,
        kind: "menu" as const,
        icon: "branch" as const,
      },
      list: () => (prefs.value.panel ? [panelTab()] : []),
      render: (props) => (
        <SubagentsPanel
          ctx={ctx}
          session={() => props.session}
          prefs={{
            refreshMs,
            live: () => prefs.value.live,
          }}
        />
      ),
    });

    ctx.add(MenuItem, () => {
      const session = ctx.sessions.current();
      if (!prefs.value.panel || !session) return undefined;
      const state = ctx.layout.state(panelKey, session);
      return {
        menu: "session.panel" as const,
        id: PANEL_ID,
        title: ctx.t("panel.title"),
        icon: "branch" as const,
        ...(state !== undefined && state !== "closed" ? { opened: true } : {}),
        run: () => void openPanel(session),
      };
    });

    ctx.add(SettingsPage, {
      id: SETTINGS_PAGE_ID,
      icon: "branch",
      get title() {
        return ctx.t("settings.title");
      },
      get entries() {
        return [
          { id: "agents", title: ctx.t("settings.agents") },
          { id: "panel", title: ctx.t("settings.panel") },
          { id: "live", title: ctx.t("settings.live") },
          { id: "defaultScope", title: ctx.t("settings.defaultScope") },
          { id: "refresh", title: ctx.t("settings.refresh") },
          { id: "showHidden", title: ctx.t("settings.showHidden") },
          { id: "paths", title: ctx.t("settings.data") },
        ];
      },
      render: () => (
        <SubagentsSettings
          ctx={ctx}
          directory={() => ctx.sessions.current()?.directory}
          newRequest={newAgentRequest}
          onNewRequestConsumed={() => setNewAgentRequest(0)}
          panel={prefs.value.panel}
          onPanel={(value) =>
            prefs.update((draft) => {
              draft.panel = value;
            })
          }
          live={prefs.value.live}
          onLive={(value) =>
            prefs.update((draft) => {
              draft.live = value;
            })
          }
          defaultScope={defaultScope()}
          onDefaultScope={(value) =>
            prefs.update((draft) => {
              draft.defaultScope = value;
            })
          }
          refreshSeconds={refreshSeconds()}
          onRefreshSeconds={(value) =>
            prefs.update((draft) => {
              draft.refreshSeconds = value;
            })
          }
          showHidden={prefs.value.showHidden}
          onShowHidden={(value) =>
            prefs.update((draft) => {
              draft.showHidden = value;
            })
          }
        />
      ),
    });
  },
});
