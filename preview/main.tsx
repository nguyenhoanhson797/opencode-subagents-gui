/**
 * The preview page: the plugin's real side-panel tracker and Settings agent manager rendered
 * against a mock context. Run `pnpm preview`, then open http://localhost:5199 (add
 * `?mode=light` for the light theme).
 *
 * The page is a styling aid. The markup comes from the plugin source, but the context, data and
 * UI primitives are mocks, so layout is representative while the app chrome around it is not.
 */
import { render } from "solid-js/web";
import { AgentManager } from "../src/gui/manage.js";
import { SubagentsPanel } from "../src/gui/panel.js";
import { STYLE } from "../src/gui/style.js";
import { createMock } from "./mock.js";

const mode = new URLSearchParams(location.search).get("mode") === "light" ? "light" : "dark";

function PanelFrame(props: { width: number; label: string }) {
  const mock = createMock(mode);
  return (
    <section class="pv-frame">
      <p class="pv-caption">{props.label}</p>
      <div class="pv-panel" style={{ width: `${props.width}px` }} data-mode={mode}>
        <SubagentsPanel
          ctx={mock.ctx}
          session={() => mock.session}
          prefs={{ refreshMs: () => 0, live: () => true }}
        />
      </div>
    </section>
  );
}

function ManagerFrame(props: { width: number; label: string }) {
  const mock = createMock(mode);
  return (
    <section class="pv-frame">
      <p class="pv-caption">{props.label}</p>
      <div class="pv-settings" style={{ width: `${props.width}px` }} data-mode={mode}>
        <AgentManager
          ctx={mock.ctx}
          directory={() => mock.session.directory}
          defaultScope={() => "global"}
          showHidden={() => true}
          newRequest={() => 0}
          onNewRequestConsumed={() => {}}
        />
      </div>
    </section>
  );
}

function App() {
  return (
    <div class="pv-page">
      <header class="pv-head">
        <div>
          <h1>Subagents preview</h1>
          <p>
            Side panel tracks runs; Settings manages files. Click <b>New subagent</b>, open
            <b> Advanced</b>, and open an agent to check the editor.
          </p>
        </div>
        <div class="pv-modes">
          <a class={mode === "dark" ? "on" : ""} href="?mode=dark">
            Dark
          </a>
          <a class={mode === "light" ? "on" : ""} href="?mode=light">
            Light
          </a>
        </div>
      </header>
      <div class="pv-frames">
        <PanelFrame width={340} label="Session side panel · tracker only · 340 px" />
        <ManagerFrame width={560} label="Settings › Subagents · manager" />
      </div>
    </div>
  );
}

const PAGE_CSS = `
:root {
  color-scheme: ${mode};
  --pv-bg: ${mode === "dark" ? "#0a0a0a" : "#f4f4f5"};
  --pv-page-text: ${mode === "dark" ? "#ededed" : "#171717"};
  --pv-muted: ${mode === "dark" ? "#8a8a8a" : "#6b7280"};
  --pv-frame: ${mode === "dark" ? "#101010" : "#ffffff"};
  --pv-border: ${mode === "dark" ? "#262626" : "#e4e4e7"};
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--pv-bg);
  color: var(--pv-page-text);
  font-family: var(--font-family-sans, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif);
}
.pv-page { padding: 28px 32px 48px; }
.pv-head { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; max-width: 980px; }
.pv-head h1 { margin: 0 0 4px; font-size: 20px; font-weight: 600; letter-spacing: -.01em; }
.pv-head p { margin: 0; color: var(--pv-muted); font-size: 13px; max-width: 620px; line-height: 1.5; }
.pv-modes { display: flex; gap: 6px; flex: none; }
.pv-modes a { color: var(--pv-muted); text-decoration: none; font-size: 12px; padding: 5px 10px; border-radius: 6px; border: 1px solid transparent; }
.pv-modes a.on { color: var(--pv-page-text); border-color: var(--pv-border); background: var(--pv-frame); }
.pv-frames { display: flex; gap: 30px; align-items: flex-start; margin-top: 26px; flex-wrap: wrap; }
.pv-frame { min-width: 0; }
.pv-caption { margin: 0 0 8px; color: var(--pv-muted); font-size: 12px; }
.pv-panel {
  height: 820px;
  overflow: hidden;
  background: ${mode === "dark" ? "#0c0c0c" : "#ffffff"};
  border: 1px solid var(--pv-border);
  border-radius: 10px;
}
.pv-settings {
  min-height: 820px;
  padding: 24px 26px 30px;
  background: ${mode === "dark" ? "#0c0c0c" : "#ffffff"};
  border: 1px solid var(--pv-border);
  border-radius: 10px;
}

/* Mock primitives: close enough to the app's controls to judge the panel's layout. */
.pv-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px;
  border: 1px solid var(--pv-border); border-radius: 6px; cursor: pointer;
  background: ${mode === "dark" ? "#171717" : "#ffffff"}; color: inherit; font: inherit; font-size: 12px;
}
.pv-btn:hover { background: ${mode === "dark" ? "#1f1f1f" : "#f4f4f5"}; }
.pv-btn-contrast { background: ${mode === "dark" ? "#ededed" : "#171717"}; color: ${mode === "dark" ? "#0c0c0c" : "#ffffff"}; border-color: transparent; font-weight: 500; }
.pv-btn-contrast:hover { background: ${mode === "dark" ? "#ffffff" : "#000000"}; }
.pv-btn-danger { color: #dc2626; }
.pv-btn:disabled { opacity: .6; cursor: default; }
.pv-icon { font-size: 13px; line-height: 1; }
.pv-icon-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px;
  padding: 0; border: 0; border-radius: 5px; background: transparent; color: inherit;
  cursor: pointer; font-size: 13px; line-height: 1;
}
.pv-icon-btn:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
.pv-switch { position: relative; width: 34px; height: 19px; padding: 0; border: 0; border-radius: 999px; cursor: pointer;
  background: ${mode === "dark" ? "#3f3f46" : "#d4d4d8"}; }
.pv-switch span { position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%;
  background: #ffffff; transition: left .12s ease; }
.pv-switch.on { background: #16a34a; }
.pv-switch.on span { left: 17px; }
.pv-spin { width: 10px; height: 10px; border: 1.5px solid currentColor; border-top-color: transparent; border-radius: 50%; display: inline-block; animation: pv-spin .8s linear infinite; }
@keyframes pv-spin { to { transform: rotate(360deg); } }
`;

const style = document.createElement("style");
style.textContent = `${STYLE}
${PAGE_CSS}`;
document.head.append(style);

render(() => <App />, document.getElementById("root")!);