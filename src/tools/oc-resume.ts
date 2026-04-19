import { tool } from "@opencode-ai/plugin"
import { transition } from "../state-machine"
import { upsertState } from "../storage"
import { resolveTargetState } from "./resolve-target"

export const ocResumeTool = tool({
  description: "Resume paused OC-Loop",
  args: {
    runId: tool.schema.string().optional().describe("Target run ID"),
    sessionId: tool.schema.string().optional().describe("Target session ID"),
  },
  async execute(args, context) {
    const state = resolveTargetState(context.directory, context.sessionID, args)
    if (!state || state.status !== "PAUSED") {
      return "No paused loop to resume."
    }

    state.status = transition(state.status, "RESUME", state.mode)
    upsertState(context.directory, state)
    return `Loop ${state.runId} resumed at iteration ${state.iteration}.`
  },
})
