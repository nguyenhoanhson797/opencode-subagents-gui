/**
 * The Subagents page in OpenCode's Settings: the full agent manager (create, edit, override and
 * delete Markdown files), surface switches, editor defaults, live refresh and where the files
 * live. Everything saves through the plugin's own store or RPC.
 */
import type { Context } from "@opencode/plugin/gui";
import { onMount, Show } from "solid-js";
import type { AgentDirs, AgentScope } from "../types.js";
import { createAgentsData, type AgentsData } from "./data.js";
import { AgentManager } from "./manage.js";

const REFRESH_OPTIONS = ["0", "2", "3", "5", "10"] as const;

export type SubagentsSettingsProps = {
  ctx: Context;
  directory: () => string | undefined;
  newRequest: () => number;
  onNewRequestConsumed: () => void;
  panel: boolean;
  onPanel: (value: boolean) => void;
  live: boolean;
  onLive: (value: boolean) => void;
  defaultScope: AgentScope;
  onDefaultScope: (value: AgentScope) => void;
  refreshSeconds: string;
  onRefreshSeconds: (value: string) => void;
  showHidden: boolean;
  onShowHidden: (value: boolean) => void;
};

function SettingsPaths(props: { ctx: Context; data: AgentsData }) {
  const ctx = props.ctx;
  onMount(() => void props.data.load());
  const dirs = (): AgentDirs | undefined => props.data.dirs();

  return (
    <Show
      when={dirs()}
      fallback={<span class="sa-small sa-muted">{ctx.t("panel.loading")}</span>}
    >
      {(value) => (
        <div class="sa-paths" style={{ "border-top": "none", "padding-top": "0" }}>
          <span>{ctx.t("panel.paths.global", { path: value().global })}</span>
          <Show
            when={value().project}
            fallback={<span>{ctx.t("settings.data.noProject")}</span>}
          >
            {(project) => (
              <span>{ctx.t("panel.paths.project", { path: project() })}</span>
            )}
          </Show>
        </div>
      )}
    </Show>
  );
}

export function SubagentsSettings(props: SubagentsSettingsProps) {
  const ctx = props.ctx;
  const ui = ctx.ui;
  const data = createAgentsData(ctx, () => undefined);

  return (
    <ui.SettingsLayout title={ctx.t("settings.title")} description={ctx.t("settings.description")}>
      <ui.SettingsSection title={ctx.t("settings.agents")}>
        <div class="sa-settings-manage" data-action="agents">
          <AgentManager
            ctx={ctx}
            directory={props.directory}
            defaultScope={() => props.defaultScope}
            showHidden={() => props.showHidden}
            newRequest={props.newRequest}
            onNewRequestConsumed={props.onNewRequestConsumed}
          />
        </div>
      </ui.SettingsSection>

      <ui.SettingsSection title={ctx.t("settings.section.surfaces")}>
        <ui.SettingsRow
          id="panel"
          title={ctx.t("settings.panel")}
          description={ctx.t("settings.panel.description")}
        >
          <ui.Switch
            label={ctx.t("settings.panel")}
            hideLabel
            checked={props.panel}
            onChange={props.onPanel}
          />
        </ui.SettingsRow>
        <ui.SettingsRow
          id="live"
          title={ctx.t("settings.live")}
          description={ctx.t("settings.live.description")}
        >
          <ui.Switch
            label={ctx.t("settings.live")}
            hideLabel
            checked={props.live}
            disabled={!props.panel}
            onChange={props.onLive}
          />
        </ui.SettingsRow>
      </ui.SettingsSection>

      <ui.SettingsSection title={ctx.t("settings.section.editor")}>
        <ui.SettingsRow
          id="defaultScope"
          title={ctx.t("settings.defaultScope")}
          description={ctx.t("settings.defaultScope.description")}
        >
          <ui.Select
            label={ctx.t("settings.defaultScope")}
            value={props.defaultScope}
            options={[
              { value: "global", label: ctx.t("panel.scope.global") },
              { value: "project", label: ctx.t("panel.scope.project") },
            ]}
            onChange={(value) => props.onDefaultScope(value as AgentScope)}
          />
        </ui.SettingsRow>
        <ui.SettingsRow
          id="refresh"
          title={ctx.t("settings.refresh")}
          description={ctx.t("settings.refresh.description")}
        >
          <ui.Select
            label={ctx.t("settings.refresh")}
            value={props.refreshSeconds}
            options={REFRESH_OPTIONS.map((value) => ({
              value,
              label:
                value === "0"
                  ? ctx.t("settings.refresh.off")
                  : ctx.t("settings.refresh.seconds", { count: value }),
            }))}
            onChange={props.onRefreshSeconds}
          />
        </ui.SettingsRow>
        <ui.SettingsRow
          id="showHidden"
          title={ctx.t("settings.showHidden")}
          description={ctx.t("settings.showHidden.description")}
        >
          <ui.Switch
            label={ctx.t("settings.showHidden")}
            hideLabel
            checked={props.showHidden}
            onChange={props.onShowHidden}
          />
        </ui.SettingsRow>
      </ui.SettingsSection>

      <ui.SettingsSection
        title={ctx.t("settings.section.data")}
        footer={<p class="sa-note">{ctx.t("settings.privacy.description")}</p>}
      >
        <ui.SettingsRow
          id="paths"
          title={ctx.t("settings.data")}
          description={ctx.t("settings.data.description")}
        >
          <SettingsPaths ctx={ctx} data={data} />
        </ui.SettingsRow>
        <ui.SettingsRow
          id="privacy"
          title={ctx.t("settings.privacy")}
          description={ctx.t("settings.privacy.description")}
        />
      </ui.SettingsSection>
    </ui.SettingsLayout>
  );
}
