import { randomUUID } from "node:crypto"
import { tool } from "@opencode-ai/plugin"
import { DEFAULT_MAX_ITERATIONS_WATCH, DEFAULT_WATCH_INTERVAL } from "../constants"
import { transition } from "../state-machine"
import { upsertState } from "../storage"
import type { LoopState } from "../types"

function parseIntervalToSeconds(input?: string): number | null {
  if (!input) return null
  const matched = input.trim().toLowerCase().match(/^(\d+)([smh])$/)
  if (!matched) return null

  const value = Number(matched[1])
  const unit = matched[2]
  if (!Number.isFinite(value) || value <= 0) return null

  if (unit === "s") return value
  if (unit === "m") return value * 60
  if (unit === "h") return value * 3600
  return null
}

export const ocWatchTool = tool({
  description:
    "Start watch mode — interval-based polling until manually stopped. Usage: /oc-watch \"check deploy\" --interval=5m [--maxIterations=10000]",
  args: {
    task: tool.schema.string().describe("What to watch / monitor"),
    interval: tool.schema
      .string()
      .optional()
      .describe("Poll interval with unit: 30s, 5m, 1h (default: 5m)"),
    intervalSeconds: tool.schema
      .number()
      .optional()
      .describe("Poll interval in seconds (legacy option, default: 300)"),
    maxIterations: tool.schema
      .number()
      .optional()
      .describe("Maximum iterations (default: 10000)"),
  },
  async execute(args, context) {
    const parsed = parseIntervalToSeconds(args.interval)
    const interval = parsed ?? args.intervalSeconds ?? DEFAULT_WATCH_INTERVAL
    const state: LoopState = {
      runId: randomUUID(),
      sessionId: context.sessionID,
      active: true,
      mode: "watch",
      status: transition("IDLE", "START"),
      iteration: 1,
      maxIterations: args.maxIterations ?? DEFAULT_MAX_ITERATIONS_WATCH,
      prompt: args.task,
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: new Date(Date.now() + interval * 1000).toISOString(),
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: interval,
      lastResult: null,
    }
    upsertState(context.directory, state)

    return `OC-Loop watch mode started (interval: ${interval}s, max: ${state.maxIterations} iterations).\nRun ID: ${state.runId}\nSession: ${state.sessionId}\n\nWatching: ${args.task}\n\nThis mode keeps polling on idle-aware cadence until manually stopped.\nIf a turn finishes after the scheduled time, next watch run triggers immediately on idle, then interval is recalculated from that point.\nUse /oc-pause to pause, /oc-resume to resume, /oc-cancel to stop.`
  },
})
