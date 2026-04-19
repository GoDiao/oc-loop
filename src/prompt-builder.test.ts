import { describe, expect, test } from "bun:test"
import { buildTaskContinuation, buildWatchPrompt } from "./prompt-builder"
import type { LoopState } from "./types"

const baseState: LoopState = {
  runId: "r1",
  sessionId: "s1",
  active: true,
  mode: "task",
  status: "RUNNING",
  iteration: 3,
  maxIterations: 100,
  prompt: "Build auth system",
  startedAt: "2026-04-19T10:00:00Z",
  retryCount: 0,
  nextWakeAt: null,
  testCommand: "bun test",
  lastTestOutput: null,
  planChecklist: null,
  intervalSeconds: null,
  lastResult: null,
}

describe("buildTaskContinuation", () => {
  test("includes iteration counter and original task", () => {
    const prompt = buildTaskContinuation(baseState, { decision: "retry", reasons: ["no model claim"] })
    expect(prompt).toContain("3/100")
    expect(prompt).toContain("Build auth system")
    expect(prompt).toContain("no model claim")
  })

  test("includes checklist completion instructions", () => {
    const prompt = buildTaskContinuation(baseState, { decision: "retry", reasons: [] })
    expect(prompt).toContain('"planChecklist"')
    expect(prompt).toContain('"done": false')
    expect(prompt).toContain("all checklist items are done")
  })
})

describe("buildWatchPrompt", () => {
  test("includes watch task and interval info", () => {
    const state: LoopState = {
      ...baseState,
      mode: "watch",
      intervalSeconds: 300,
      prompt: "Check deploy status",
    }
    const prompt = buildWatchPrompt(state)
    expect(prompt).toContain("Check deploy status")
    expect(prompt).toContain("/oc-cancel")
    expect(prompt).toContain("Only the user can decide to stop")
    expect(prompt).toContain("Do not call /oc-cancel")
  })
})
