import { tool } from "@opencode-ai/plugin"
import { clearStateByRunId } from "../storage"
import { resolveTargetState } from "./resolve-target"

export const ocCancelTool = tool({
  description: "Cancel and clear OC-Loop state entirely",
  args: {
    runId: tool.schema.string().optional().describe("Target run ID"),
    sessionId: tool.schema.string().optional().describe("Target session ID"),
  },
  async execute(args, context) {
    const state = resolveTargetState(context.directory, context.sessionID, args)
    if (!state) return "No active loop to cancel."

    const iterations = state.iteration
    clearStateByRunId(context.directory, state.runId)
    return `OC-Loop ${state.runId} cancelled after ${iterations} iteration(s).`
  },
})
