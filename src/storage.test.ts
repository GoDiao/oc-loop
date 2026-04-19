import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  clearState,
  clearStateByRunId,
  getActiveStateBySession,
  getStateByRunId,
  listStates,
  readState,
  readStore,
  upsertState,
  writeState,
} from "./storage"
import type { LoopState } from "./types"

describe("storage", () => {
  const TEST_DIR = join(tmpdir(), "oc-loop-test-" + Date.now())

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
  })

  test("write and read roundtrip", () => {
    const state: LoopState = {
      runId: "run-1",
      sessionId: "ses-1",
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
      active: true,
    }
    expect(writeState(TEST_DIR, state)).toBe(true)
    const read = readState(TEST_DIR)
    expect(read).not.toBeNull()
    expect(read!.runId).toBe("run-1")
    expect(read!.status).toBe("RUNNING")
    expect(read!.mode).toBe("task")
    expect(read!.testCommand).toBe("bun test")
  })

  test("returns null when no state file", () => {
    expect(readState(TEST_DIR)).toBeNull()
  })

  test("clear removes state file", () => {
    const state: LoopState = {
      runId: "r1",
      sessionId: "s1",
      mode: "task",
      status: "RUNNING",
      iteration: 1,
      maxIterations: 10,
      prompt: "test",
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: null,
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: null,
      lastResult: null,
      active: true,
    }
    writeState(TEST_DIR, state)
    expect(clearState(TEST_DIR)).toBe(true)
    expect(readState(TEST_DIR)).toBeNull()
  })

  test("supports multiple runs and session-active lookup", () => {
    const a: LoopState = {
      runId: "run-a",
      sessionId: "s1",
      mode: "task",
      status: "RUNNING",
      iteration: 1,
      maxIterations: 10,
      prompt: "A",
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: null,
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: null,
      lastResult: null,
      active: true,
    }
    const b: LoopState = {
      ...a,
      runId: "run-b",
      sessionId: "s2",
      prompt: "B",
    }

    expect(upsertState(TEST_DIR, a)).toBe(true)
    expect(upsertState(TEST_DIR, b)).toBe(true)

    const all = listStates(TEST_DIR)
    expect(all.length).toBe(2)
    expect(getStateByRunId(TEST_DIR, "run-a")?.sessionId).toBe("s1")
    expect(getStateByRunId(TEST_DIR, "run-b")?.sessionId).toBe("s2")
    expect(getActiveStateBySession(TEST_DIR, "s1")?.runId).toBe("run-a")
    expect(getActiveStateBySession(TEST_DIR, "s2")?.runId).toBe("run-b")
  })

  test("migrates legacy singleton state into v2 store", () => {
    const legacyState: LoopState = {
      runId: "legacy-1",
      sessionId: "legacy-session",
      mode: "task",
      status: "RUNNING",
      iteration: 1,
      maxIterations: 10,
      prompt: "legacy",
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: null,
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: null,
      lastResult: null,
      active: true,
    }

    const statePath = join(TEST_DIR, ".oc-loop", "state.json")
    mkdirSync(join(TEST_DIR, ".oc-loop"), { recursive: true })
    writeFileSync(statePath, JSON.stringify(legacyState, null, 2), "utf-8")

    const store = readStore(TEST_DIR)
    expect(store.version).toBe(2)
    expect(store.runs["legacy-1"]?.sessionId).toBe("legacy-session")
    expect(store.activeRunBySession["legacy-session"]).toBe("legacy-1")
  })

  test("clearStateByRunId removes only target run", () => {
    const a: LoopState = {
      runId: "run-a",
      sessionId: "s1",
      mode: "task",
      status: "RUNNING",
      iteration: 1,
      maxIterations: 10,
      prompt: "A",
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: null,
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: null,
      lastResult: null,
      active: true,
    }
    const b: LoopState = {
      ...a,
      runId: "run-b",
      sessionId: "s2",
      prompt: "B",
    }

    upsertState(TEST_DIR, a)
    upsertState(TEST_DIR, b)

    expect(clearStateByRunId(TEST_DIR, "run-a")).toBe(true)
    expect(getStateByRunId(TEST_DIR, "run-a")).toBeNull()
    expect(getStateByRunId(TEST_DIR, "run-b")?.prompt).toBe("B")
  })
})
