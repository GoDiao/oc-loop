import { describe, expect, test } from "bun:test"
import { mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { upsertState, getStateByRunId } from "../storage"
import type { LoopState } from "../types"
import { ocPauseTool } from "./oc-pause"
import { ocResumeTool } from "./oc-resume"
import { ocCancelTool } from "./oc-cancel"

function makeState(partial: Partial<LoopState>): LoopState {
  return {
    runId: "r1",
    sessionId: "s1",
    active: true,
    mode: "task",
    status: "RUNNING",
    iteration: 1,
    maxIterations: 10,
    prompt: "x",
    startedAt: new Date().toISOString(),
    retryCount: 0,
    nextWakeAt: null,
    testCommand: null,
    lastTestOutput: null,
    planChecklist: null,
    intervalSeconds: null,
    lastResult: null,
    ...partial,
  }
}

describe("oc control tools targeting", () => {
  test("pause targets runId", async () => {
    const dir = join(tmpdir(), `oc-loop-control-${Date.now()}-a`)
    mkdirSync(dir, { recursive: true })

    try {
      upsertState(dir, makeState({ runId: "r1", sessionId: "s1", status: "RUNNING" }))
      upsertState(dir, makeState({ runId: "r2", sessionId: "s2", status: "RUNNING" }))

      await ocPauseTool.execute({ runId: "r2" } as any, { directory: dir, sessionID: "s1" } as any)

      expect(getStateByRunId(dir, "r1")?.status).toBe("RUNNING")
      expect(getStateByRunId(dir, "r2")?.status).toBe("PAUSED")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("resume targets sessionId", async () => {
    const dir = join(tmpdir(), `oc-loop-control-${Date.now()}-b`)
    mkdirSync(dir, { recursive: true })

    try {
      upsertState(dir, makeState({ runId: "r1", sessionId: "s1", status: "PAUSED" }))
      upsertState(dir, makeState({ runId: "r2", sessionId: "s2", status: "PAUSED" }))

      await ocResumeTool.execute({ sessionId: "s2" } as any, { directory: dir, sessionID: "s1" } as any)

      expect(getStateByRunId(dir, "r1")?.status).toBe("PAUSED")
      expect(getStateByRunId(dir, "r2")?.status).toBe("RUNNING")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("cancel targets runId", async () => {
    const dir = join(tmpdir(), `oc-loop-control-${Date.now()}-c`)
    mkdirSync(dir, { recursive: true })

    try {
      upsertState(dir, makeState({ runId: "r1", sessionId: "s1", status: "RUNNING" }))
      upsertState(dir, makeState({ runId: "r2", sessionId: "s2", status: "RUNNING" }))

      await ocCancelTool.execute({ runId: "r1" } as any, { directory: dir, sessionID: "s2" } as any)

      expect(getStateByRunId(dir, "r1")).toBeNull()
      expect(getStateByRunId(dir, "r2")?.status).toBe("RUNNING")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
