import { tool } from "@opencode-ai/plugin"
import { transition } from "../state-machine"
import { upsertState } from "../storage"
import { resolveTargetState } from "./resolve-target"

export const ocPauseTool = tool({
  description: "Pause active OC-Loop without clearing state",
  args: {
    runId: tool.schema.string().optional().describe("Target run ID"),
    sessionId: tool.schema.string().optional().describe("Target session ID"),
  },
  async execute(args, context) {
    const state = resolveTargetState(context.directory, context.sessionID, args)
    if (!state || !state.active) {
      return "No active loop to pause."
    }

    state.status = transition(state.status, "PAUSE", state.mode)
    upsertState(context.directory, state)
    return `Loop ${state.runId} paused at iteration ${state.iteration}. Use /oc-resume to continue.`
  },
})
