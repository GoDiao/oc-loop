import { tool } from "@opencode-ai/plugin"
import { listStates } from "../storage"

export const ocListTool = tool({
  description: "List active OC-Loop runs",
  args: {},
  async execute(_args, context) {
    const runs = listStates(context.directory)
    if (runs.length === 0) return "No active loop runs."

    const lines = runs
      .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
      .map(
        (run) =>
          `- runId=${run.runId} session=${run.sessionId} mode=${run.mode} status=${run.status} iteration=${run.iteration}/${run.maxIterations} startedAt=${run.startedAt}${run.nextWakeAt ? ` nextWakeAt=${run.nextWakeAt}` : ""}`,
      )

    return `Active runs (${runs.length}):\n${lines.join("\n")}`
  },
})