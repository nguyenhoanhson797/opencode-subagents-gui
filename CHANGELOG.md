# Changelog

## [0.1.0] - 2026-11-19

First release.

### Added

- Settings › Subagents page with project, global, built-in and config-defined agents.
- Create, edit, delete and override Markdown agent files.
- Model picker with provider groups and variants, or inherit the parent session model.
- Advanced agent fields: mode, steps, color, hidden, disabled, permissions, request headers and
  request body.
- Side panel tracker for child subagent sessions with status, model, tokens, cost, elapsed time,
  open and stop actions.
- Settings for the tracker tab, default scope, live refresh and hidden agents.
- Settings page shows the resolved global and project agents folders.
- One-command installers (`install.ps1`, `install.sh`) that place the built plugin in the global
  OpenCode plugin folder, so no config edit is needed.
- Tag-driven release workflow: GitHub release with the built plugin and installers, plus npm
  publish when `NPM_TOKEN` is set.
