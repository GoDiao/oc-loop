import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { PluginInput } from "@opencode-ai/plugin"
import { createEventHandler } from "./event-handler"
import { clearState, readState, writeState } from "./storage"
import type { LoopState } from "./types"
import { COMPLETION_TAG } from "./constants"

describe("event-handler", () => {
  const TEST_DIR = join(tmpdir(), `oc-loop-event-test-${Date.now()}`)
  let promptCalls: Array<{ sessionID: string; text: string }>

  function mockCtx(options?: { messages?: any[] }): PluginInput {
    return {
      client: {
        session: {
          promptAsync: async (opts: any) => {
            promptCalls.push({ sessionID: opts.path.id, text: opts.body.parts[0].text })
          },
          abort: async () => {},
          messages: async () => ({
            data:
              options?.messages ?? [
                {
                  info: { role: "assistant" },
                  parts: [],
                },
              ],
          }),
        },
      },
      directory: TEST_DIR,
    } as unknown as PluginInput
  }

  beforeEach(() => {
    promptCalls = []
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    clearState(TEST_DIR)
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
  })

  test("injects continuation on session.idle for active task loop", async () => {
    const handler = createEventHandler(mockCtx())
    const state: LoopState = {
      runId: "r1",
      sessionId: "s1",
      active: true,
      mode: "task",
      status: "RUNNING",
      iteration: 1,
      maxIterations: 10,
      prompt: "Build feature",
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: null,
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: null,
      lastResult: null,
    }
    writeState(TEST_DIR, state)

    await handler({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })

    expect(promptCalls.length).toBe(1)
    expect(promptCalls[0].text).toContain("OC-LOOP TASK")
  })

  test("does nothing when no active loop", async () => {
    const handler = createEventHandler(mockCtx())
    await handler({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })
    expect(promptCalls.length).toBe(0)
  })

  test("skips when paused", async () => {
    const handler = createEventHandler(mockCtx())
    const state: LoopState = {
      runId: "r1",
      sessionId: "s1",
      active: true,
      mode: "task",
      status: "PAUSED",
      iteration: 1,
      maxIterations: 10,
      prompt: "Build feature",
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: null,
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: null,
      lastResult: null,
    }
    writeState(TEST_DIR, state)

    await handler({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })

    expect(promptCalls.length).toBe(0)
  })

  test("clears state on external session abort error", async () => {
    const handler = createEventHandler(mockCtx())
    const state: LoopState = {
      runId: "r1",
      sessionId: "s1",
      active: true,
      mode: "task",
      status: "RUNNING",
      iteration: 1,
      maxIterations: 10,
      prompt: "Build feature",
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: null,
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: null,
      lastResult: null,
    }
    writeState(TEST_DIR, state)

    await handler({
      event: {
        type: "session.error",
        properties: { sessionID: "s1", error: { name: "MessageAbortedError" } },
      } as any,
    })

    expect(readState(TEST_DIR)).toBeNull()
  })

  test("keeps state when abort was user requested via oc-abort", async () => {
    const handler = createEventHandler(mockCtx())
    const state: LoopState = {
      runId: "r1",
      sessionId: "s1",
      active: true,
      mode: "task",
      status: "RUNNING",
      iteration: 1,
      maxIterations: 10,
      prompt: "Build feature",
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: null,
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: null,
      lastResult: null,
      abortRequestedAt: new Date().toISOString(),
    }
    writeState(TEST_DIR, state)

    await handler({
      event: {
        type: "session.error",
        properties: { sessionID: "s1", error: { name: "MessageAbortedError" } },
      } as any,
    })

    const updated = readState(TEST_DIR)
    expect(updated).not.toBeNull()
    expect(updated?.active).toBe(true)
    expect(updated?.status).toBe("RUNNING")
    expect(updated?.abortRequestedAt).toBeUndefined()
  })

  test("respects wake time in WAIT_RETRY", async () => {
    const handler = createEventHandler(mockCtx())
    const future = new Date(Date.now() + 60000).toISOString()
    const state: LoopState = {
      runId: "r1",
      sessionId: "s1",
      active: true,
      mode: "task",
      status: "WAIT_RETRY",
      iteration: 2,
      maxIterations: 10,
      prompt: "Build feature",
      startedAt: new Date().toISOString(),
      retryCount: 1,
      nextWakeAt: future,
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: null,
      lastResult: null,
    }
    writeState(TEST_DIR, state)

    await handler({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })

    expect(promptCalls.length).toBe(0)
  })

  test("completes task loop only when checklist all done and done tag present", async () => {
    const handler = createEventHandler(
      mockCtx({
        messages: [
          {
            info: { role: "assistant" },
            parts: [
              {
                type: "text",
                text: `\`\`\`json\n{"planChecklist":[{"title":"a","done":true},{"title":"b","done":true}]}\n\`\`\`\n${COMPLETION_TAG}`,
              },
            ],
          },
        ],
      }),
    )

    const state: LoopState = {
      runId: "r1",
      sessionId: "s1",
      active: true,
      mode: "task",
      status: "RUNNING",
      iteration: 1,
      maxIterations: 10,
      prompt: "Build feature",
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: null,
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: null,
      lastResult: null,
    }
    writeState(TEST_DIR, state)

    await handler({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })

    expect(readState(TEST_DIR)).toBeNull()
    expect(promptCalls.length).toBe(0)
  })

  test("retries task loop when checklist is all done but done tag is missing", async () => {
    const handler = createEventHandler(
      mockCtx({
        messages: [
          {
            info: { role: "assistant" },
            parts: [
              {
                type: "text",
                text: "```json\n{\"planChecklist\":[{\"title\":\"a\",\"done\":true},{\"title\":\"b\",\"done\":true}]}\n```",
              },
            ],
          },
        ],
      }),
    )

    const state: LoopState = {
      runId: "r1",
      sessionId: "s1",
      active: true,
      mode: "task",
      status: "RUNNING",
      iteration: 1,
      maxIterations: 10,
      prompt: "Build feature",
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: null,
      testCommand: null,
      lastTestOutput: null,
      planChecklist: [{ title: "seed", done: false }],
      intervalSeconds: null,
      lastResult: null,
    }
    writeState(TEST_DIR, state)

    await handler({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })

    const updated = readState(TEST_DIR)
    expect(updated).not.toBeNull()
    expect(updated?.planChecklist).toEqual([
      { title: "a", done: true },
      { title: "b", done: true },
    ])
    expect(promptCalls.length).toBe(1)
    expect(promptCalls[0].text).toContain("OC-LOOP TASK")
  })

  test("retries task loop when plan-checklist still has unfinished items", async () => {
    const handler = createEventHandler(
      mockCtx({
        messages: [
          {
            info: { role: "assistant" },
            parts: [
              {
                type: "text",
                text: "```json\n{\"planChecklist\":[{\"title\":\"a\",\"done\":true},{\"title\":\"b\",\"done\":false}]}\n```",
              },
            ],
          },
        ],
      }),
    )

    const state: LoopState = {
      runId: "r1",
      sessionId: "s1",
      active: true,
      mode: "task",
      status: "RUNNING",
      iteration: 1,
      maxIterations: 10,
      prompt: "Build feature",
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: null,
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: null,
      lastResult: null,
    }
    writeState(TEST_DIR, state)

    await handler({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })

    expect(promptCalls.length).toBe(1)
    expect(promptCalls[0].text).toContain("OC-LOOP TASK")
  })

  test("watch triggers immediately when scheduled time has already passed", async () => {
    const handler = createEventHandler(mockCtx())

    const state: LoopState = {
      runId: "r1",
      sessionId: "s1",
      active: true,
      mode: "watch",
      status: "WAITING",
      iteration: 1,
      maxIterations: 10,
      prompt: "Watch deploy",
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: new Date(Date.now() - 1000).toISOString(),
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: 30,
      lastResult: null,
    }
    writeState(TEST_DIR, state)

    await handler({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })

    expect(promptCalls.length).toBe(1)
    expect(promptCalls[0].text).toContain("OC-LOOP WATCH")

    const updated = readState(TEST_DIR)
    expect(updated).not.toBeNull()
    expect(updated?.status).toBe("RUNNING")
    expect(updated?.nextWakeAt).not.toBeNull()
  })

  test("watch in RUNNING state triggers immediately on idle when nextWakeAt is overdue", async () => {
    const handler = createEventHandler(mockCtx())

    const state: LoopState = {
      runId: "r2",
      sessionId: "s1",
      active: true,
      mode: "watch",
      status: "RUNNING",
      iteration: 3,
      maxIterations: 10,
      prompt: "Watch deploy",
      startedAt: new Date().toISOString(),
      retryCount: 0,
      nextWakeAt: new Date(Date.now() - 1000).toISOString(),
      testCommand: null,
      lastTestOutput: null,
      planChecklist: null,
      intervalSeconds: 30,
      lastResult: null,
    }
    writeState(TEST_DIR, state)

    await handler({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })

    expect(promptCalls.length).toBe(1)
    expect(promptCalls[0].text).toContain("OC-LOOP WATCH")

    const updated = readState(TEST_DIR)
    expect(updated).not.toBeNull()
    expect(updated?.status).toBe("RUNNING")
    expect(updated?.iteration).toBe(4)
    expect(updated?.nextWakeAt).not.toBeNull()
  })
})
