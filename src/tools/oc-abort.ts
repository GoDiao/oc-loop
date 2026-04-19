import { tool } from "@opencode-ai/plugin"
import type { PluginInput } from "@opencode-ai/plugin"
import { upsertState } from "../storage"
import { resolveTargetState } from "./resolve-target"

export function createOcAbortTool(client: PluginInput["client"]) {
  return tool({
    description: "Abort current running turn (session.abort) for this session",
    args: {
      runId: tool.schema.string().optional().describe("Target run ID"),
      sessionId: tool.schema.string().optional().describe("Target session ID"),
    },
    async execute(args, context) {
      const state = resolveTargetState(context.directory, context.sessionID, args)
      const sessionId = state?.sessionId ?? args.sessionId ?? context.sessionID
      if (!sessionId) {
        return "No active session to abort."
      }

      if (state && state.active && state.sessionId === sessionId) {
        state.abortRequestedAt = new Date().toISOString()
        upsertState(context.directory, state)
      }

      await client.session.abort({ path: { id: sessionId } }).catch(() => {})
      return `Requested abort for session ${sessionId}. Loop state preserved.`
    },
  })
}
