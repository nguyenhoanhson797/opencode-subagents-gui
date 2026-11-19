/**
 * The plugin's CSS, added once with the `Style` registry.
 *
 * It uses the app's theme variables where they exist and falls back to neutral light/dark
 * values. Every class starts with `sa-`, and `data-mode` comes from `ctx.appearance.mode()`.
 */
export const STYLE = `
.sa-root {
  --sa-text: var(--text-strong, #0b0b0b);
  --sa-text-2: var(--text-base, #444444);
  --sa-muted: var(--text-weak, #6b7280);
  --sa-card: var(--surface-raised-base, #ffffff);
  --sa-border: var(--border-weak-base, #e5e5e5);
  --sa-track: color-mix(in srgb, var(--sa-border) 45%, transparent);
  --sa-hover: var(--surface-base-hover, rgba(127, 127, 127, .10));
  --sa-field-bg: #ffffff;
  --sa-field-border: #cfcfd6;
  color-scheme: light;
  --sa-green: #16a34a;
  --sa-amber: #d97706;
  --sa-red: #dc2626;
  --sa-blue: #2563eb;
  color: var(--sa-text);
  font-size: 13px;
  line-height: 1.45;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 12px 18px;
  box-sizing: border-box;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  container-type: inline-size;
}
.sa-root[data-mode="dark"] {
  --sa-text: var(--text-strong, #ededed);
  --sa-text-2: var(--text-base, #b3b3b3);
  --sa-muted: var(--text-weak, #8a8a8a);
  --sa-card: var(--surface-raised-base, #121212);
  --sa-border: var(--border-weak-base, #262626);
  --sa-track: #2a2a2a;
  --sa-hover: var(--surface-base-hover, rgba(127, 127, 127, .14));
  --sa-field-bg: #191919;
  --sa-field-border: #41414a;
  color-scheme: dark;
  --sa-green: #43d17a;
  --sa-amber: #f0a23a;
  --sa-red: #f06464;
  --sa-blue: #6ea8ff;
}
.sa-head { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
.sa-head-main { min-width: 0; flex: 1; }
.sa-title { margin: 0; font-size: 15px; font-weight: 650; letter-spacing: -.01em; }
.sa-sub { margin: 2px 0 0; color: var(--sa-muted); font-size: 11.5px; }
.sa-spacer { margin-left: auto; }
.sa-toolbar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sa-search { width: 100%; }
.sa-muted { color: var(--sa-muted); }
.sa-small { font-size: 11.5px; }
.sa-empty { margin: 0; padding: 14px 10px; border: 1px dashed var(--sa-border); border-radius: 9px;
  color: var(--sa-muted); text-align: center; font-size: 12px; }
.sa-loading { display: flex; align-items: center; gap: 8px; color: var(--sa-muted); font-size: 12px; padding: 8px 0; }
.sa-error, .sa-warning { margin: 0; padding: 8px 10px; border-radius: 8px; font-size: 12px; }
.sa-error { color: var(--sa-red); background: color-mix(in srgb, var(--sa-red) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--sa-red) 28%, transparent); }
.sa-warning { color: var(--sa-amber); background: color-mix(in srgb, var(--sa-amber) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--sa-amber) 28%, transparent); }
.sa-section { display: flex; flex-direction: column; gap: 8px; }
.sa-section-head { display: flex; align-items: baseline; gap: 8px; }
.sa-section-title { margin: 0; font-size: 11px; font-weight: 650; text-transform: uppercase;
  letter-spacing: .06em; color: var(--sa-muted); }
.sa-section-count { color: var(--sa-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.sa-section-note { margin-left: auto; color: var(--sa-muted); font-size: 11px; }

.sa-run { border: 1px solid var(--sa-border); border-radius: 9px; background: var(--sa-card);
  padding: 8px 10px; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.sa-run.sa-running { border-color: color-mix(in srgb, var(--sa-green) 45%, var(--sa-border)); }
.sa-run-top { display: flex; align-items: center; gap: 7px; min-width: 0; }
.sa-run-agent { font-weight: 650; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-run-title { color: var(--sa-muted); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; min-width: 0; flex: 1; }
.sa-run-actions { margin-left: auto; display: flex; gap: 2px; flex: none; }
.sa-run-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px;
  color: var(--sa-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.sa-run-meta b { color: var(--sa-text-2); font-weight: 600; }
.sa-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--sa-muted); flex: none; }
.sa-dot.sa-dot-live { background: var(--sa-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sa-green) 20%, transparent); }
.sa-dot.sa-dot-fail { background: var(--sa-red); }
.sa-dot.sa-dot-warn { background: var(--sa-amber); }
.sa-spinner { width: 11px; height: 11px; border-radius: 50%; border: 1.5px solid var(--sa-track);
  border-top-color: var(--sa-green); animation: sa-spin .8s linear infinite; flex: none; }
@keyframes sa-spin { to { transform: rotate(360deg); } }
.sa-tree { border-left: 1px solid var(--sa-border); margin-left: 7px; padding-left: 8px; }

.sa-group { display: flex; flex-direction: column; gap: 5px; }
.sa-group-title { display: flex; align-items: center; gap: 6px; margin: 0 0 2px;
  font-size: 11px; font-weight: 600; color: var(--sa-muted); }
.sa-agent { display: flex; align-items: flex-start; gap: 8px; border: 1px solid transparent;
  border-radius: 8px; padding: 7px 8px; min-width: 0; cursor: pointer; background: transparent; }
.sa-agent:hover { background: var(--sa-hover); border-color: var(--sa-border); }
.sa-agent-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.sa-agent-line { display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap; }
.sa-agent-name { font-weight: 650; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; min-width: 0; }
.sa-agent-desc { color: var(--sa-muted); font-size: 11.5px; overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.sa-agent-meta { color: var(--sa-muted); font-size: 10.5px; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.sa-agent-actions { display: flex; align-items: center; gap: 1px; flex: none; margin-top: -2px; }
.sa-badge { display: inline-flex; align-items: center; height: 16px; padding: 0 5px; border-radius: 4px;
  font-size: 9.5px; font-weight: 650; letter-spacing: .02em; text-transform: uppercase;
  border: 1px solid var(--sa-border); color: var(--sa-muted); white-space: nowrap; }
.sa-badge.sa-badge-project { color: var(--sa-blue); border-color: color-mix(in srgb, var(--sa-blue) 35%, var(--sa-border)); }
.sa-badge.sa-badge-global { color: var(--sa-green); border-color: color-mix(in srgb, var(--sa-green) 35%, var(--sa-border)); }
.sa-badge.sa-badge-hidden { color: var(--sa-amber); border-color: color-mix(in srgb, var(--sa-amber) 35%, var(--sa-border)); }
.sa-badge.sa-badge-disabled { color: var(--sa-red); border-color: color-mix(in srgb, var(--sa-red) 35%, var(--sa-border)); }
.sa-badge.sa-badge-override { color: var(--sa-text-2); }
.sa-paths { display: flex; flex-direction: column; gap: 2px; color: var(--sa-muted); font-size: 10.5px;
  overflow-wrap: anywhere; border-top: 1px solid var(--sa-border); padding-top: 7px; }
.sa-note { color: var(--sa-muted); font-size: 10.5px; margin: 0; }

.sa-editor { display: flex; flex-direction: column; gap: 11px; min-width: 0; }
.sa-editor-head { display: flex; align-items: center; gap: 6px; position: sticky; top: -12px; z-index: 2;
  margin: -12px -12px 0; padding: 10px 12px 8px; background: var(--sa-card);
  border-bottom: 1px solid var(--sa-border); }
.sa-editor-title { font-weight: 650; font-size: 14px; min-width: 0; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.sa-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.sa-label { font-size: 11.5px; font-weight: 600; color: var(--sa-text-2); }
.sa-label .sa-required { color: var(--sa-red); }
.sa-hint { margin: 0; font-size: 10.5px; color: var(--sa-muted); overflow-wrap: anywhere; }
.sa-input, .sa-textarea, .sa-select {
  width: 100%; box-sizing: border-box; border: 1px solid var(--sa-field-border); border-radius: 7px;
  background: var(--sa-field-bg); color: var(--sa-text); font: inherit; font-size: 12px;
  padding: 7px 10px; min-width: 0; outline: none;
}
.sa-input::placeholder, .sa-textarea::placeholder { color: var(--sa-muted); opacity: .9; }
.sa-input:hover:not(:disabled), .sa-textarea:hover:not(:disabled), .sa-select:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--sa-field-border) 55%, var(--sa-text) 45%);
}
.sa-input, .sa-select { height: 32px; }
.sa-textarea { resize: vertical; min-height: 76px; line-height: 1.5; }
.sa-textarea.sa-body { min-height: 150px; font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11.5px; }
.sa-input:focus, .sa-textarea:focus, .sa-select:focus { border-color: color-mix(in srgb, var(--sa-blue) 65%, var(--sa-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--sa-blue) 16%, transparent); }
.sa-input:disabled, .sa-textarea:disabled, .sa-select:disabled { opacity: .62; cursor: not-allowed; }
.sa-input.sa-invalid, .sa-textarea.sa-invalid { border-color: var(--sa-red); }
.sa-row2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
.sa-row2.sa-row-wide { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); }
.sa-inline { display: flex; align-items: center; gap: 7px; min-width: 0; }
.sa-color { display: flex; align-items: center; gap: 7px; }
.sa-swatch { width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--sa-border);
  flex: none; background: var(--sa-card); }
.sa-advanced { border: 1px solid var(--sa-border); border-radius: 9px; background: var(--sa-card); }
.sa-advanced > summary { cursor: pointer; padding: 8px 10px; font-size: 12px; font-weight: 600;
  list-style: none; display: flex; align-items: center; gap: 6px; }
.sa-advanced > summary::-webkit-details-marker { display: none; }
.sa-advanced > summary::before { content: "▸"; color: var(--sa-muted); font-size: 10px; transition: transform .12s ease; }
.sa-advanced[open] > summary::before { transform: rotate(90deg); }
.sa-advanced > summary .sa-summary-hint { color: var(--sa-muted); font-weight: 400; font-size: 10.5px; margin-left: auto; }
.sa-advanced-body { display: flex; flex-direction: column; gap: 11px; padding: 2px 10px 11px;
  border-top: 1px solid var(--sa-border); padding-top: 10px; }
.sa-perm, .sa-header-row { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.2fr) 92px auto;
  gap: 6px; align-items: center; }
.sa-header-row { grid-template-columns: minmax(0, .85fr) minmax(0, 1.2fr) auto; }
.sa-perm-remove { display: flex; align-items: center; }
.sa-subhead { display: flex; align-items: center; gap: 6px; }
.sa-subhead .sa-label { margin: 0; }
.sa-subhead .sa-spacer { margin-left: auto; }
.sa-inline-error { margin: 0; color: var(--sa-red); font-size: 10.5px; }
.sa-actions { display: flex; align-items: center; gap: 7px; position: sticky; bottom: -18px;
  margin: 2px -12px -18px; padding: 9px 12px 12px; background: var(--sa-card);
  border-top: 1px solid var(--sa-border); z-index: 2; }
.sa-actions .sa-delete { margin-left: auto; }
.sa-save-note { font-size: 10.5px; color: var(--sa-muted); }
.sa-pre { margin: 0; max-height: 220px; overflow: auto; background: var(--sa-track); border-radius: 7px;
  padding: 8px; font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 10.5px; white-space: pre-wrap; overflow-wrap: anywhere; }
.sa-parse-error { display: flex; flex-direction: column; gap: 7px; }

/* The Settings page renders the manager without the panel's full-height scroll box. */
.sa-manage { height: auto; min-height: 0; overflow: visible; padding: 0; gap: 12px; }
.sa-settings-manage { display: flex; flex-direction: column; min-width: 0; padding: 16px 0 18px; }
.sa-settings-manage .sa-root { container-type: normal; }
/* Inside Settings the editor flows in the page; sticky bars would cover the last fields. */
.sa-manage .sa-editor-head { position: static; margin: 0 0 2px; padding: 0 0 10px; background: transparent; }
.sa-manage .sa-actions { position: static; margin: 6px 0 0; padding: 12px 0 0; background: transparent; }

@container (max-width: 420px) {
  .sa-row2, .sa-row2.sa-row-wide { grid-template-columns: minmax(0, 1fr); }
  .sa-perm { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 76px auto; }
  .sa-header-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) auto; }
  .sa-agent-desc { -webkit-line-clamp: 3; }
  .sa-run-title { display: none; }
}
@container (max-width: 300px) {
  .sa-perm { grid-template-columns: minmax(0, 1fr) 70px auto; }
  .sa-perm .sa-perm-resource { grid-column: 1 / -1; }
  .sa-header-row { grid-template-columns: minmax(0, 1fr) auto; }
  .sa-header-row .sa-header-value { grid-column: 1 / -1; }
  .sa-head { flex-wrap: wrap; }
}
`;
