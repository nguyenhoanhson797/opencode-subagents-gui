/**
 * A dependency-free self-test for the Markdown parser and the file CRUD. Run it with
 * `pnpm selftest`; it writes only under the operating system's temp directory.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { emptyDraft } from "../dist/types.js";
import { parseAgentMarkdown, renderAgentMarkdown } from "../dist/server/markdown.js";
import { listAgentFiles, removeAgentFile, saveAgentFile } from "../dist/server/agents.js";

const sample = {
  ...emptyDraft(),
  description: 'Reviews "changes" #1',
  mode: "subagent",
  model: "anthropic/claude-sonnet-5-5#high",
  system: "Review only.\nList findings first.",
  steps: 8,
  color: "#ff6b6b",
  hidden: true,
  permissions: [
    { action: "edit", resource: "*", effect: "deny" },
    { action: "read", resource: "src/**", effect: "allow" },
  ],
  request: {
    headers: { "x-agent": "reviewer", "x-note": "a: b" },
    body: { temperature: 0.1, nested: { ok: true } },
  },
  extra: "temperature: 0.2\nlegacy:\n  nested: yes",
};

const rendered = renderAgentMarkdown(sample);
const parsed = parseAgentMarkdown(rendered);
assert.equal(parsed.error, undefined);
assert.equal(parsed.draft.description, sample.description);
assert.equal(parsed.draft.mode, "subagent");
assert.equal(parsed.draft.model, sample.model);
assert.equal(parsed.draft.steps, 8);
assert.equal(parsed.draft.color, "#ff6b6b");
assert.equal(parsed.draft.hidden, true);
assert.deepEqual(parsed.draft.permissions, sample.permissions);
assert.deepEqual(parsed.draft.request, sample.request);
assert.equal(parsed.draft.system, sample.system);
assert.match(parsed.draft.extra, /temperature: 0\.2/);

const docsStyle = `---
description: "Reviews changes"
mode: subagent
model: anthropic/claude-sonnet-5-5#high
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: shell
    resource: "*"
    effect: deny
request:
  headers:
    x-agent: reviewer
  body: {"temperature":0.1}
---

Review the changes.
`;
const docsParsed = parseAgentMarkdown(docsStyle);
assert.equal(docsParsed.error, undefined);
assert.equal(docsParsed.draft.system, "Review the changes.");
assert.deepEqual(docsParsed.draft.permissions, [
  { action: "edit", resource: "*", effect: "deny" },
  { action: "shell", resource: "*", effect: "deny" },
]);
assert.deepEqual(docsParsed.draft.request, {
  headers: { "x-agent": "reviewer" },
  body: { temperature: 0.1 },
});

const withoutFrontmatter = parseAgentMarkdown("Just a prompt.");
assert.ok(withoutFrontmatter.error);

const temp = await mkdtemp(path.join(tmpdir(), "opencode-subagents-"));
const directory = path.join(temp, "project");
// Keep the global scan inside the temp tree: a developer's real agents folder must not affect
// the counts below.
const previousConfigDir = process.env.OPENCODE_CONFIG_DIR;
process.env.OPENCODE_CONFIG_DIR = path.join(temp, "config");
const context = {
  agent: {
    async reload() {},
    async list() {
      return { data: [] };
    },
  },
};

try {
  const created = await saveAgentFile(context, {
    scope: "project",
    directory,
    id: "team/reviewer",
    create: true,
    draft: sample,
  });
  assert.equal(created.agent.id, "team/reviewer");
  assert.equal(created.agent.file, "team/reviewer.md");

  const listed = await listAgentFiles({ directory });
  assert.equal(listed.dirs.project, path.join(directory, ".opencode", "agents"));
  assert.equal(listed.agents.length, 1);
  assert.equal(listed.agents[0].id, "team/reviewer");
  assert.deepEqual(listed.agents[0].draft.request, sample.request);

  let traversal = false;
  await saveAgentFile(context, {
    scope: "project",
    directory,
    id: "../../escape",
    create: true,
    draft: sample,
  }).catch(() => {
    traversal = true;
  });
  assert.equal(traversal, true, "path traversal must be rejected");

  let reserved = false;
  await saveAgentFile(context, {
    scope: "project",
    directory,
    id: "CON",
    create: true,
    draft: sample,
  }).catch(() => {
    reserved = true;
  });
  assert.equal(reserved, true, "Windows reserved names must be rejected");

  let badColor = false;
  await saveAgentFile(context, {
    scope: "project",
    directory,
    id: "bad-color",
    create: true,
    draft: { ...sample, color: "red" },
  }).catch(() => {
    badColor = true;
  });
  assert.equal(badColor, true, "invalid colors must be rejected");

  const removed = await removeAgentFile(context, {
    scope: "project",
    directory,
    id: "team/reviewer",
  });
  assert.equal(removed.removed, true);

  const after = await listAgentFiles({ directory });
  assert.equal(after.agents.length, 0);

  console.log("selftest: ok");
} finally {
  if (previousConfigDir === undefined) delete process.env.OPENCODE_CONFIG_DIR;
  else process.env.OPENCODE_CONFIG_DIR = previousConfigDir;
  await rm(temp, { recursive: true, force: true });
}
