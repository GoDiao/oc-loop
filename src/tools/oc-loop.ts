import { randomUUID } from "node:crypto"
import { tool } from "@opencode-ai/plugin"
import { DEFAULT_MAX_ITERATIONS_TASK } from "../constants"
import { transition } from "../state-machine"
import { upsertState } from "../storage"
import type { LoopState } from "../types"

export const ocLoopTool = tool({
  description:
    "Start a plan-driven loop — auto-continues until plan checklist is fully done. Usage: /oc-loop \"task description\" [--testCommand=\"bun test\"] [--maxIterations=N]",
  args: {
    task: tool.schema.string().describe("The task to execute until completion"),
    testCommand: tool.schema
      .string()
      .optional()
      .describe("Test command to verify completion"),
    maxIterations: tool.schema
      .number()
      .optional()
      .describe("Maximum iterations (default: 100)"),
  },
  async execute(args, context) {
    const state: LoopState = {
      runId: randomUUID(),
      sessionId: context.sessionID,
      active: true,
      mode: "task",
      status: transition("IDLE", "START"),
      iteration: 1,
      maxIterations: args.maxIterations ?? DEFAULT_MAX_ITERATIONS_TASK,
      prompt: args.task,
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: null,
      testCommand: args.testCommand ?? null,
      lastTestOutput: null,
      planChecklist: [
        { title: "Clarify and refine implementation plan", done: false },
        { title: "Implement planned changes", done: false },
        { title: "Run verification and tests", done: false },
      ],
      intervalSeconds: null,
      lastResult: null,
    }
    upsertState(context.directory, state)

    return `OC-Loop started (plan-driven mode, max ${state.maxIterations} iterations).\nRun ID: ${state.runId}\nSession: ${state.sessionId}\n\nTask: ${args.task}\n${args.testCommand ? `Test gate: ${args.testCommand}` : "No test gate configured."}\n\nEach iteration should update a JSON plan checklist.\nLoop stops when all checklist items are done.\nUse /oc-pause to pause, /oc-resume to resume, /oc-cancel to stop.`
  },
})
