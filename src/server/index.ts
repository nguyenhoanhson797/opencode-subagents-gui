/**
 * The plugin's server part: RPC methods that read, write and delete subagent Markdown files.
 *
 * Deliberately small. It registers no tools for the model, hooks no session, makes no network
 * request, and writes only inside the global or project `agents` directory. After a write it
 * asks OpenCode to reload its agents so the new definition is available without a restart.
 *
 * It exports the plugin object directly instead of calling `Plugin.define`, which only returns
 * its argument: the server part then has no runtime import at all.
 */
import type { Plugin } from "@opencode/plugin";
import { AgentsRpc } from "../rpc.js";
import { listAgentFiles, removeAgentFile, saveAgentFile } from "./agents.js";

const plugin: Plugin.Plugin = {
  id: "subagents-desktop",
  async setup(ctx) {
    await ctx.rpc.register(AgentsRpc, {
      list: async (input) => listAgentFiles({ directory: input.directory }),
      save: async (input) =>
        saveAgentFile(ctx, {
          scope: input.scope,
          directory: input.directory,
          id: input.id,
          create: input.create,
          draft: input.draft,
        }),
      remove: async (input) =>
        removeAgentFile(ctx, {
          scope: input.scope,
          directory: input.directory,
          id: input.id,
        }),
    });
  },
};

export default plugin;
