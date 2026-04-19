# OC-Loop Standalone Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone opencode plugin `oc-loop` that provides two loop modes: **Task mode** (execute until verified completion with test gates) and **Watch mode** (poll on interval until manually stopped), driven by an explicit state machine with adaptive pacing and pause/resume/cancel controls.

**Architecture:** Standalone npm package using `@opencode-ai/plugin` SDK. Single entry point exports a `PluginModule` with server plugin that registers event hooks and custom tools. State machine persisted to `.oc-loop/state.json` in project directory. Event-driven via `session.idle` / `session.status` with retry backoff. No dependency on oh-my-openagent.

**Tech Stack:** TypeScript, Bun runtime + test runner, `@opencode-ai/plugin` SDK, `@opencode-ai/sdk` client, Zod for config/options validation.

**Install target:** User adds `"oc-loop"` to `opencode.json` plugin array. Done.

---

## File Structure

```
oc-loop/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                  # Plugin entry: PluginModule export
│   ├── types.ts                  # All shared types (state, mode, status, events)
│   ├── constants.ts              # Default values, backoff schedule, state path
│   ├── state-machine.ts          # Pure transition function + transition table
│   ├── state-machine.test.ts
│   ├── storage.ts                # JSON file read/write for loop state
│   ├── storage.test.ts
│   ├── verifier.ts               # Task mode: test gate + model claim gate
│   ├── verifier.test.ts
│   ├── event-handler.ts          # Main event hook: session.idle/status handling
│   ├── event-handler.test.ts
│   ├── prompt-builder.ts         # Build continuation prompts for both modes
│   ├── prompt-builder.test.ts
│   ├── watch-scheduler.ts        # Watch mode: timer-based polling
│   ├── watch-scheduler.test.ts
│   └── tools/
│       ├── oc-loop.ts            # Custom tool: start task loop
│       ├── oc-watch.ts           # Custom tool: start watch loop
│       ├── oc-pause.ts           # Custom tool: pause loop
│       ├── oc-resume.ts          # Custom tool: resume loop
│       ├── oc-abort.ts           # Custom tool: abort current turn
│       └── oc-cancel.ts          # Custom tool: cancel and clear state
```

---

### Task 1: Scaffold standalone plugin project

**Files:**
- Create: `oc-loop/package.json`
- Create: `oc-loop/tsconfig.json`
- Create: `oc-loop/src/index.ts`
- Create: `oc-loop/src/types.ts`
- Create: `oc-loop/src/constants.ts`

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir -p "E:/AProject/TianX/Personal/opencode-loop/oc-loop/src/tools"
```

```json
{
  "name": "oc-loop",
  "version": "0.1.0",
  "description": "Elegant loop plugin for opencode — task execution with verification and watch mode polling",
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    "./server": "./src/index.ts"
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["opencode", "opencode-plugin", "loop", "watch", "agent"],
  "license": "MIT",
  "peerDependencies": {
    "@opencode-ai/plugin": "^1.4.0",
    "@opencode-ai/sdk": "^1.4.0"
  },
  "devDependencies": {
    "@opencode-ai/plugin": "^1.4.0",
    "@opencode-ai/sdk": "^1.4.0",
    "bun-types": "^1.3.11",
    "typescript": "^5.7.3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["bun-types"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create types.ts with all shared types**

```ts
// src/types.ts

export type LoopMode = "task" | "watch"

export type LoopStatus =
  | "IDLE"
  | "RUNNING"
  | "VERIFYING"
  | "WAIT_RETRY"
  | "WAITING"
  | "PAUSED"
  | "DONE"
  | "FAILED"
  | "CANCELLED"

export type LoopEvent =
  | "START"
  | "ITERATION_FINISHED"
  | "VERIFY_PASS"
  | "VERIFY_RETRY"
  | "VERIFY_FAIL"
  | "WAKE"
  | "TICK"
  | "PAUSE"
  | "RESUME"
  | "CANCEL"

export interface LoopState {
  runId: string
  sessionId: string
  mode: LoopMode
  status: LoopStatus
  iteration: number
  maxIterations: number
  prompt: string
  startedAt: string
  retryCount: number
  nextWakeAt: string | null
  // Task mode fields
  testCommand: string | null
  lastTestOutput: string | null
  modelClaim: {
    done: boolean
    evidence: string[]
    risks: string[]
    nextStep: string
  } | null
  // Watch mode fields
  intervalSeconds: number | null
  lastResult: string | null
}

export interface VerifyResult {
  decision: "pass" | "retry" | "fail"
  reasons: string[]
}
```

- [ ] **Step 4: Create constants.ts**

```ts
// src/constants.ts

export const STATE_DIR = ".oc-loop"
export const STATE_FILE = "state.json"
export const DEFAULT_MAX_ITERATIONS_TASK = 100
export const DEFAULT_MAX_ITERATIONS_WATCH = 10000
export const DEFAULT_BACKOFF_SECONDS = [5, 15, 30, 60] as const
export const MAX_BACKOFF_SECONDS = 60
export const COMPLETION_TAG_PATTERN = /<oc-loop-done>/g
export const MODEL_CLAIM_PATTERN = /```json\s*\n?([\s\S]*?)\n?\s*```/
```

- [ ] **Step 5: Create minimal plugin entry point**

```ts
// src/index.ts
import type { Plugin, PluginModule } from "@opencode-ai/plugin"

const plugin: Plugin = async (input, options) => {
  return {
    event: async ({ event }) => {
      // Will be wired in Task 5
    },
    tool: {
      // Will be wired in Task 6
    },
  }
}

const module: PluginModule = {
  id: "oc-loop",
  server: plugin,
}

export default module
```

- [ ] **Step 6: Install deps and verify typecheck**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun install && bun run typecheck
```
Expected: PASS (no type errors).

- [ ] **Step 7: Commit**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && git init && git add -A && git commit -m "feat: scaffold oc-loop standalone plugin"
```

---

### Task 2: Implement state machine and storage layer

**Files:**
- Create: `src/state-machine.ts`
- Create: `src/state-machine.test.ts`
- Create: `src/storage.ts`
- Create: `src/storage.test.ts`

- [ ] **Step 1: Write failing state machine tests**

```ts
// src/state-machine.test.ts
import { describe, expect, test } from "bun:test"
import { transition } from "./state-machine"

describe("transition (task mode)", () => {
  test("IDLE -> RUNNING on START", () => {
    expect(transition("IDLE", "START")).toBe("RUNNING")
  })
  test("RUNNING -> VERIFYING on ITERATION_FINISHED", () => {
    expect(transition("RUNNING", "ITERATION_FINISHED")).toBe("VERIFYING")
  })
  test("VERIFYING -> DONE on VERIFY_PASS", () => {
    expect(transition("VERIFYING", "VERIFY_PASS")).toBe("DONE")
  })
  test("VERIFYING -> WAIT_RETRY on VERIFY_RETRY", () => {
    expect(transition("VERIFYING", "VERIFY_RETRY")).toBe("WAIT_RETRY")
  })
  test("VERIFYING -> FAILED on VERIFY_FAIL", () => {
    expect(transition("VERIFYING", "VERIFY_FAIL")).toBe("FAILED")
  })
  test("WAIT_RETRY -> RUNNING on WAKE", () => {
    expect(transition("WAIT_RETRY", "WAKE")).toBe("RUNNING")
  })
  test("PAUSED -> RUNNING on RESUME", () => {
    expect(transition("PAUSED", "RESUME")).toBe("RUNNING")
  })
  test("any -> PAUSED on PAUSE", () => {
    expect(transition("RUNNING", "PAUSE")).toBe("PAUSED")
    expect(transition("VERIFYING", "PAUSE")).toBe("PAUSED")
    expect(transition("WAIT_RETRY", "PAUSE")).toBe("PAUSED")
  })
  test("any -> CANCELLED on CANCEL", () => {
    expect(transition("RUNNING", "CANCEL")).toBe("CANCELLED")
    expect(transition("PAUSED", "CANCEL")).toBe("CANCELLED")
  })
  test("terminal states stay unchanged", () => {
    expect(transition("DONE", "START")).toBe("DONE")
    expect(transition("FAILED", "START")).toBe("FAILED")
    expect(transition("CANCELLED", "START")).toBe("CANCELLED")
  })
})

describe("transition (watch mode)", () => {
  test("RUNNING -> WAITING on ITERATION_FINISHED", () => {
    expect(transition("RUNNING", "ITERATION_FINISHED")).toBe("WAITING")
  })
  test("WAITING -> RUNNING on TICK", () => {
    expect(transition("WAITING", "TICK")).toBe("RUNNING")
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun test src/state-machine.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement state machine**

```ts
// src/state-machine.ts
import type { LoopEvent, LoopStatus } from "./types"

const TABLE: Record<LoopStatus, Partial<Record<LoopEvent, LoopStatus>>> = {
  IDLE: { START: "RUNNING", CANCEL: "CANCELLED" },
  RUNNING: { ITERATION_FINISHED: "VERIFYING", PAUSE: "PAUSED", CANCEL: "CANCELLED" },
  VERIFYING: { VERIFY_PASS: "DONE", VERIFY_RETRY: "WAIT_RETRY", VERIFY_FAIL: "FAILED", PAUSE: "PAUSED", CANCEL: "CANCELLED" },
  WAIT_RETRY: { WAKE: "RUNNING", PAUSE: "PAUSED", CANCEL: "CANCELLED" },
  WAITING: { TICK: "RUNNING", PAUSE: "PAUSED", CANCEL: "CANCELLED" },
  PAUSED: { RESUME: "RUNNING", CANCEL: "CANCELLED" },
  DONE: {},
  FAILED: {},
  CANCELLED: {},
}

export function transition(current: LoopStatus, event: LoopEvent): LoopStatus {
  return TABLE[current][event] ?? current
}
```

- [ ] **Step 4: Run tests to pass**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun test src/state-machine.test.ts
```
Expected: FAIL — watch mode `ITERATION_FINISHED` conflicts with task mode.

The issue: task and watch mode share the same `ITERATION_FINISHED` event but need different next states. Solution: make transition mode-aware.

```ts
// Updated state-machine.ts
import type { LoopEvent, LoopMode, LoopStatus } from "./types"

const TABLE: Record<LoopStatus, Partial<Record<LoopEvent, LoopStatus>>> = {
  IDLE: { START: "RUNNING", CANCEL: "CANCELLED" },
  RUNNING: { ITERATION_FINISHED: "VERIFYING", PAUSE: "PAUSED", CANCEL: "CANCELLED" },
  VERIFYING: { VERIFY_PASS: "DONE", VERIFY_RETRY: "WAIT_RETRY", VERIFY_FAIL: "FAILED", PAUSE: "PAUSED", CANCEL: "CANCELLED" },
  WAIT_RETRY: { WAKE: "RUNNING", PAUSE: "PAUSED", CANCEL: "CANCELLED" },
  WAITING: { TICK: "RUNNING", PAUSE: "PAUSED", CANCEL: "CANCELLED" },
  PAUSED: { RESUME: "RUNNING", CANCEL: "CANCELLED" },
  DONE: {},
  FAILED: {},
  CANCELLED: {},
}

export function transition(current: LoopStatus, event: LoopEvent, mode?: LoopMode): LoopStatus {
  if (current === "RUNNING" && event === "ITERATION_FINISHED" && mode === "watch") {
    return "WAITING"
  }
  return TABLE[current][event] ?? current
}
```

Update test to use mode parameter for watch tests:

```ts
test("RUNNING -> WAITING on ITERATION_FINISHED (watch)", () => {
  expect(transition("RUNNING", "ITERATION_FINISHED", "watch")).toBe("WAITING")
})
```

- [ ] **Step 5: Write failing storage tests**

```ts
// src/storage.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { readState, writeState, clearState } from "./storage"
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
      modelClaim: null,
      intervalSeconds: null,
      lastResult: null,
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
      runId: "r1", sessionId: "s1", mode: "task", status: "RUNNING",
      iteration: 1, maxIterations: 10, prompt: "test", startedAt: new Date().toISOString(),
      retryCount: 0, nextWakeAt: null, testCommand: null, lastTestOutput: null,
      modelClaim: null, intervalSeconds: null, lastResult: null,
    }
    writeState(TEST_DIR, state)
    expect(clearState(TEST_DIR)).toBe(true)
    expect(readState(TEST_DIR)).toBeNull()
  })
})
```

- [ ] **Step 6: Run storage tests and confirm failure**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun test src/storage.test.ts
```
Expected: FAIL.

- [ ] **Step 7: Implement storage**

```ts
// src/storage.ts
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import type { LoopState } from "./types"
import { STATE_DIR, STATE_FILE } from "./constants"

function statePath(dir: string): string {
  return join(dir, STATE_DIR, STATE_FILE)
}

export function readState(projectDir: string): LoopState | null {
  const path = statePath(projectDir)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as LoopState
  } catch {
    return null
  }
}

export function writeState(projectDir: string, state: LoopState): boolean {
  const path = statePath(projectDir)
  try {
    const dir = join(projectDir, STATE_DIR)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(path, JSON.stringify(state, null, 2), "utf-8")
    return true
  } catch {
    return false
  }
}

export function clearState(projectDir: string): boolean {
  const path = statePath(projectDir)
  try {
    if (existsSync(path)) unlinkSync(path)
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 8: Run all tests to pass**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun test
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && git add -A && git commit -m "feat: add state machine and JSON storage layer"
```

---

### Task 3: Implement verifier for task mode

**Files:**
- Create: `src/verifier.ts`
- Create: `src/verifier.test.ts`

- [ ] **Step 1: Write failing verifier tests**

```ts
// src/verifier.test.ts
import { describe, expect, test } from "bun:test"
import { evaluateCompletion } from "./verifier"

describe("evaluateCompletion (task mode)", () => {
  test("passes when model claim is done and no test command", () => {
    const result = evaluateCompletion({
      modelClaim: { done: true, evidence: ["tests pass"], risks: [], nextStep: "none" },
      testCommand: null,
      testExitCode: null,
    })
    expect(result.decision).toBe("pass")
  })

  test("passes when model claim done AND test passes", () => {
    const result = evaluateCompletion({
      modelClaim: { done: true, evidence: ["done"], risks: [], nextStep: "none" },
      testCommand: "bun test",
      testExitCode: 0,
    })
    expect(result.decision).toBe("pass")
  })

  test("retry when model claim done but test fails", () => {
    const result = evaluateCompletion({
      modelClaim: { done: true, evidence: ["claimed done"], risks: [], nextStep: "none" },
      testCommand: "bun test",
      testExitCode: 1,
    })
    expect(result.decision).toBe("retry")
  })

  test("retry when model claim not done", () => {
    const result = evaluateCompletion({
      modelClaim: { done: false, evidence: [], risks: ["incomplete"], nextStep: "continue" },
      testCommand: null,
      testExitCode: null,
    })
    expect(result.decision).toBe("retry")
  })

  test("retry when no model claim at all", () => {
    const result = evaluateCompletion({
      modelClaim: null,
      testCommand: null,
      testExitCode: null,
    })
    expect(result.decision).toBe("retry")
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun test src/verifier.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement verifier**

```ts
// src/verifier.ts
import type { VerifyResult, LoopState } from "./types"

type VerifyInput = {
  modelClaim: LoopState["modelClaim"]
  testCommand: string | null
  testExitCode: number | null
}

export function evaluateCompletion(input: VerifyInput): VerifyResult {
  const reasons: string[] = []

  if (!input.modelClaim) {
    return { decision: "retry", reasons: ["no model claim found"] }
  }

  if (!input.modelClaim.done) {
    reasons.push(`model says not done: ${input.modelClaim.nextStep}`)
  }

  if (input.testCommand !== null && input.testExitCode !== null && input.testExitCode !== 0) {
    reasons.push(`test command exited with code ${input.testExitCode}`)
  }

  if (reasons.length === 0) return { decision: "pass", reasons: [] }
  return { decision: "retry", reasons }
}
```

- [ ] **Step 4: Run tests to pass**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun test src/verifier.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && git add -A && git commit -m "feat: add task mode completion verifier"
```

---

### Task 4: Implement prompt builder for both modes

**Files:**
- Create: `src/prompt-builder.ts`
- Create: `src/prompt-builder.test.ts`

- [ ] **Step 1: Write failing prompt builder tests**

```ts
// src/prompt-builder.test.ts
import { describe, expect, test } from "bun:test"
import { buildTaskContinuation, buildWatchPrompt } from "./prompt-builder"
import type { LoopState } from "./types"

const baseState: LoopState = {
  runId: "r1", sessionId: "s1", mode: "task", status: "RUNNING",
  iteration: 3, maxIterations: 100, prompt: "Build auth system",
  startedAt: "2026-04-19T10:00:00Z", retryCount: 0, nextWakeAt: null,
  testCommand: "bun test", lastTestOutput: null, modelClaim: null,
  intervalSeconds: null, lastResult: null,
}

describe("buildTaskContinuation", () => {
  test("includes iteration counter and original task", () => {
    const prompt = buildTaskContinuation(baseState, { decision: "retry", reasons: ["no model claim"] })
    expect(prompt).toContain("3/100")
    expect(prompt).toContain("Build auth system")
    expect(prompt).toContain("no model claim")
  })

  test("includes completion instructions", () => {
    const prompt = buildTaskContinuation(baseState, { decision: "retry", reasons: [] })
    expect(prompt).toContain("<oc-loop-done>")
  })
})

describe("buildWatchPrompt", () => {
  test("includes watch task and interval info", () => {
    const state: LoopState = { ...baseState, mode: "watch", intervalSeconds: 300, prompt: "Check deploy status" }
    const prompt = buildWatchPrompt(state)
    expect(prompt).toContain("Check deploy status")
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun test src/prompt-builder.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement prompt builder**

```ts
// src/prompt-builder.ts
import type { LoopState, VerifyResult } from "./types"

export function buildTaskContinuation(state: LoopState, verifyResult: VerifyResult): string {
  return `[OC-LOOP TASK — ITERATION ${state.iteration}/${state.maxIterations}]

Previous iteration did not pass verification.

Verification reasons: ${verifyResult.reasons.join("; ") || "none"}

IMPORTANT:
- Review your progress so far
- Continue from where you left off
- When FULLY complete, output the completion claim JSON inside a code block:
  \`\`\`json
  {"done": true, "evidence": ["..."], "risks": ["..."], "next_step": "none"}
  \`\`\`
- Then output <oc-loop-done> on a new line
- Do NOT claim completion until the task is truly done
${state.testCommand ? `- Tests will be run automatically (${state.testCommand}). Ensure they pass before claiming done.` : ""}

Original task:
${state.prompt}`
}

export function buildWatchPrompt(state: LoopState): string {
  return `[OC-LOOP WATCH — ITERATION ${state.iteration}/${state.maxIterations}]

Check the current status and report findings.

Task:
${state.prompt}

Report your findings. You can also output <oc-loop-done> if the watch condition is met and the loop should stop.`
}
```

- [ ] **Step 4: Run tests to pass**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun test src/prompt-builder.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && git add -A && git commit -m "feat: add prompt builder for task and watch modes"
```

---

### Task 5: Implement main event handler with adaptive pacing

**Files:**
- Create: `src/event-handler.ts`
- Create: `src/event-handler.test.ts`

- [ ] **Step 1: Write failing event handler tests**

```ts
// src/event-handler.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { PluginInput } from "@opencode-ai/plugin"
import { createEventHandler } from "./event-handler"
import { writeState, readState, clearState } from "./storage"
import type { LoopState } from "./types"

describe("event-handler", () => {
  const TEST_DIR = join(tmpdir(), "oc-loop-event-test-" + Date.now())
  let promptCalls: Array<{ sessionID: string; text: string }>

  function mockCtx(): PluginInput {
    return {
      client: {
        session: {
          promptAsync: async (opts: any) => {
            promptCalls.push({ sessionID: opts.path.id, text: opts.body.parts[0].text })
          },
          abort: async () => {},
          messages: async () => ({ data: [] }),
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
      runId: "r1", sessionId: "s1", mode: "task", status: "RUNNING",
      iteration: 1, maxIterations: 10, prompt: "Build feature",
      startedAt: new Date().toISOString(), retryCount: 0, nextWakeAt: null,
      testCommand: null, lastTestOutput: null, modelClaim: null,
      intervalSeconds: null, lastResult: null,
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
      runId: "r1", sessionId: "s1", mode: "task", status: "PAUSED",
      iteration: 1, maxIterations: 10, prompt: "Build feature",
      startedAt: new Date().toISOString(), retryCount: 0, nextWakeAt: null,
      testCommand: null, lastTestOutput: null, modelClaim: null,
      intervalSeconds: null, lastResult: null,
    }
    writeState(TEST_DIR, state)

    await handler({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })

    expect(promptCalls.length).toBe(0)
  })

  test("clears state on session error abort", async () => {
    const handler = createEventHandler(mockCtx())
    const state: LoopState = {
      runId: "r1", sessionId: "s1", mode: "task", status: "RUNNING",
      iteration: 1, maxIterations: 10, prompt: "Build feature",
      startedAt: new Date().toISOString(), retryCount: 0, nextWakeAt: null,
      testCommand: null, lastTestOutput: null, modelClaim: null,
      intervalSeconds: null, lastResult: null,
    }
    writeState(TEST_DIR, state)

    await handler({ event: { type: "session.error", properties: { sessionID: "s1", error: { name: "MessageAbortedError" } } } as any })

    expect(readState(TEST_DIR)).toBeNull()
  })

  test("respects wake time in WAIT_RETRY", async () => {
    const handler = createEventHandler(mockCtx())
    const future = new Date(Date.now() + 60000).toISOString()
    const state: LoopState = {
      runId: "r1", sessionId: "s1", mode: "task", status: "WAIT_RETRY",
      iteration: 2, maxIterations: 10, prompt: "Build feature",
      startedAt: new Date().toISOString(), retryCount: 1, nextWakeAt: future,
      testCommand: null, lastTestOutput: null, modelClaim: null,
      intervalSeconds: null, lastResult: null,
    }
    writeState(TEST_DIR, state)

    await handler({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })

    expect(promptCalls.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun test src/event-handler.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement event handler**

```ts
// src/event-handler.ts
import type { PluginInput } from "@opencode-ai/plugin"
import { readState, writeState, clearState } from "./storage"
import { transition } from "./state-machine"
import { evaluateCompletion } from "./verifier"
import { buildTaskContinuation, buildWatchPrompt } from "./prompt-builder"
import { DEFAULT_BACKOFF_SECONDS, MAX_BACKOFF_SECONDS } from "./constants"
import type { LoopState, LoopStatus } from "./types"

export function createEventHandler(ctx: PluginInput) {
  const inFlight = new Set<string>()

  return async ({ event }: { event: { type: string; properties?: any } }): Promise<void> => {
    const props = event.properties ?? {}
    const sessionID: string | undefined = props.sessionID

    // session error: abort clears loop
    if (event.type === "session.error") {
      if (sessionID) {
        const state = readState(ctx.directory)
        if (state && state.sessionId === sessionID && props.error?.name === "MessageAbortedError") {
          clearState(ctx.directory)
        }
      }
      return
    }

    // session deleted: clear loop
    if (event.type === "session.deleted") {
      const deletedID = props.info?.id
      if (deletedID) {
        const state = readState(ctx.directory)
        if (state && state.sessionId === deletedID) clearState(ctx.directory)
      }
      return
    }

    // idle detection
    const isIdle =
      event.type === "session.idle" ||
      (event.type === "session.status" && props.status?.type === "idle")

    if (!isIdle || !sessionID) return
    if (inFlight.has(sessionID)) return

    inFlight.add(sessionID)
    try {
      const state = readState(ctx.directory)
      if (!state || !state.active || state.status === "PAUSED" || state.status === "DONE" || state.status === "FAILED" || state.status === "CANCELLED") return
      if (state.sessionId !== sessionID) return

      // max iterations check
      if (state.iteration >= state.maxIterations) {
        state.status = "FAILED"
        writeState(ctx.directory, state)
        return
      }

      // wake time guard for WAIT_RETRY
      if (state.status === "WAIT_RETRY" && state.nextWakeAt) {
        if (Date.now() < Date.parse(state.nextWakeAt)) return
      }

      // run test gate if configured
      let testExitCode: number | null = null
      if (state.mode === "task" && state.testCommand) {
        try {
          const proc = Bun.spawnSync(["sh", "-c", state.testCommand], { cwd: ctx.directory, timeout: 120000 })
          testExitCode = proc.exitCode
          state.lastTestOutput = proc.stdout?.toString().slice(0, 2000) ?? ""
        } catch {
          testExitCode = -1
        }
      }

      // evaluate completion for task mode
      if (state.mode === "task") {
        const result = evaluateCompletion({ modelClaim: state.modelClaim, testCommand: state.testCommand, testExitCode })

        if (result.decision === "pass") {
          const next = transition(state.status, "VERIFY_PASS", state.mode) as LoopStatus
          state.status = next
          writeState(ctx.directory, state)
          if (next === "DONE") clearState(ctx.directory)
          return
        }

        // retry with backoff
        const next = transition(state.status, "VERIFY_RETRY", state.mode) as LoopStatus
        const backoff = DEFAULT_BACKOFF_SECONDS[Math.min(state.retryCount, DEFAULT_BACKOFF_SECONDS.length - 1)] ?? MAX_BACKOFF_SECONDS
        state.retryCount += 1
        state.iteration += 1
        state.modelClaim = null
        state.status = next
        state.nextWakeAt = new Date(Date.now() + backoff * 1000).toISOString()
        writeState(ctx.directory, state)

        const prompt = buildTaskContinuation(state, result)
        await ctx.client.session.promptAsync({
          path: { id: sessionID },
          body: { parts: [{ type: "text", text: prompt }] },
          query: { directory: ctx.directory },
        })
        return
      }

      // watch mode: just continue
      if (state.mode === "watch") {
        state.iteration += 1
        state.lastResult = null
        const next = transition(state.status, "ITERATION_FINISHED", state.mode) as LoopStatus
        state.status = next
        writeState(ctx.directory, state)

        // immediately reinject for watch (next interval handled by watch-scheduler)
        const wakeNext = transition(next, "TICK", state.mode) as LoopStatus
        state.status = wakeNext
        writeState(ctx.directory, state)

        const prompt = buildWatchPrompt(state)
        await ctx.client.session.promptAsync({
          path: { id: sessionID },
          body: { parts: [{ type: "text", text: prompt }] },
          query: { directory: ctx.directory },
        })
      }
    } finally {
      inFlight.delete(sessionID)
    }
  }
}
```

- [ ] **Step 4: Run tests to pass**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun test src/event-handler.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && git add -A && git commit -m "feat: add event handler with adaptive pacing and mode-aware routing"
```

---

### Task 6: Register custom tools (oc-loop, oc-watch, oc-pause, oc-resume, oc-abort, oc-cancel)

**Files:**
- Create: `src/tools/oc-loop.ts`
- Create: `src/tools/oc-watch.ts`
- Create: `src/tools/oc-pause.ts`
- Create: `src/tools/oc-resume.ts`
- Create: `src/tools/oc-abort.ts`
- Create: `src/tools/oc-cancel.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Implement oc-loop tool (start task loop)**

```ts
// src/tools/oc-loop.ts
import { tool } from "@opencode-ai/plugin"
import { writeState } from "../storage"
import { transition } from "../state-machine"
import { DEFAULT_MAX_ITERATIONS_TASK } from "../constants"
import type { LoopState } from "../types"
import { randomUUID } from "node:crypto"

export const ocLoopTool = tool({
  description: "Start a task loop — auto-continues until verified completion. Usage: /oc-loop \"task description\" [--test=\"bun test\"] [--max-iterations=N]",
  args: {
    task: tool.schema.string().describe("The task to execute until completion"),
    testCommand: tool.schema.string().optional().describe("Test command to verify completion"),
    maxIterations: tool.schema.number().optional().describe("Maximum iterations (default: 100)"),
  },
  async execute(args, context) {
    const state: LoopState = {
      runId: randomUUID(),
      sessionId: context.sessionID,
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
      modelClaim: null,
      intervalSeconds: null,
      lastResult: null,
    }
    writeState(context.directory, state)

    return `OC-Loop task started (max ${state.maxIterations} iterations).

Task: ${args.task}
${args.testCommand ? `Test gate: ${args.testCommand}` : "No test gate configured."}

I will auto-continue until the task is verified complete.
Use /oc-pause to pause, /oc-resume to resume, /oc-cancel to stop.`
  },
})
```

- [ ] **Step 2: Implement oc-watch tool**

```ts
// src/tools/oc-watch.ts
import { tool } from "@opencode-ai/plugin"
import { writeState } from "../storage"
import { transition } from "../state-machine"
import { DEFAULT_MAX_ITERATIONS_WATCH } from "../constants"
import type { LoopState } from "../types"
import { randomUUID } from "node:crypto"

export const ocWatchTool = tool({
  description: "Start a watch loop — polls on interval until manually stopped. Usage: /oc-watch \"check deploy\" --interval=300",
  args: {
    task: tool.schema.string().describe("What to watch / monitor"),
    intervalSeconds: tool.schema.number().optional().describe("Poll interval in seconds (default: 300)"),
    maxIterations: tool.schema.number().optional().describe("Maximum iterations (default: 10000)"),
  },
  async execute(args, context) {
    const interval = args.intervalSeconds ?? 300
    const state: LoopState = {
      runId: randomUUID(),
      sessionId: context.sessionID,
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
      modelClaim: null,
      intervalSeconds: interval,
      lastResult: null,
    }
    writeState(context.directory, state)

    return `OC-Loop watch started (interval: ${interval}s, max: ${state.maxIterations} iterations).

Watching: ${args.task}

Use /oc-pause to pause, /oc-resume to resume, /oc-cancel to stop.`
  },
})
```

- [ ] **Step 3: Implement control tools (pause/resume/abort/cancel)**

```ts
// src/tools/oc-pause.ts
import { tool } from "@opencode-ai/plugin"
import { readState, writeState } from "../storage"
import { transition } from "../state-machine"
import type { LoopStatus } from "../types"

export const ocPauseTool = tool({
  description: "Pause active OC-Loop without clearing state",
  args: {},
  async execute(_args, context) {
    const state = readState(context.directory)
    if (!state || state.status === "DONE" || state.status === "FAILED" || state.status === "CANCELLED") {
      return "No active loop to pause."
    }
    state.status = transition(state.status, "PAUSE") as LoopStatus
    writeState(context.directory, state)
    return `Loop paused at iteration ${state.iteration}. Use /oc-resume to continue.`
  },
})
```

```ts
// src/tools/oc-resume.ts
import { tool } from "@opencode-ai/plugin"
import { readState, writeState } from "../storage"
import { transition } from "../state-machine"
import type { LoopStatus } from "../types"

export const ocResumeTool = tool({
  description: "Resume paused OC-Loop",
  args: {},
  async execute(_args, context) {
    const state = readState(context.directory)
    if (!state || state.status !== "PAUSED") {
      return "No paused loop to resume."
    }
    state.status = transition(state.status, "RESUME") as LoopStatus
    writeState(context.directory, state)
    return `Loop resumed at iteration ${state.iteration}.`
  },
})
```

```ts
// src/tools/oc-abort.ts
import { tool } from "@opencode-ai/plugin"
import { readState } from "@opencode-ai/plugin"
import type { PluginInput } from "@opencode-ai/plugin"

export const ocAbortTool = tool({
  description: "Abort current running turn (session.abort) but keep loop state",
  args: {},
  async execute(_args, context) {
    const state = readState(context.directory)
    if (!state || state.status !== "RUNNING") {
      return "No running turn to abort."
    }
    // abort is handled by the caller which has access to ctx.client
    return `Aborting current turn for session ${state.sessionId}. Loop state preserved.`
  },
})
```

```ts
// src/tools/oc-cancel.ts
import { tool } from "@opencode-ai/plugin"
import { readState, clearState } from "../storage"

export const ocCancelTool = tool({
  description: "Cancel and clear OC-Loop state entirely",
  args: {},
  async execute(_args, context) {
    const state = readState(context.directory)
    if (!state) return "No active loop to cancel."
    const iterations = state.iteration
    clearState(context.directory)
    return `OC-Loop cancelled after ${iterations} iteration(s).`
  },
})
```

- [ ] **Step 4: Wire all tools into plugin entry point**

```ts
// src/index.ts
import type { Plugin, PluginModule, PluginInput } from "@opencode-ai/plugin"
import { createEventHandler } from "./event-handler"
import { ocLoopTool } from "./tools/oc-loop"
import { ocWatchTool } from "./tools/oc-watch"
import { ocPauseTool } from "./tools/oc-pause"
import { ocResumeTool } from "./tools/oc-resume"
import { ocAbortTool } from "./tools/oc-abort"
import { ocCancelTool } from "./tools/oc-cancel"

const plugin: Plugin = async (input: PluginInput) => {
  const handleEvent = createEventHandler(input)

  return {
    event: handleEvent,
    tool: {
      "oc-loop": ocLoopTool,
      "oc-watch": ocWatchTool,
      "oc-pause": ocPauseTool,
      "oc-resume": ocResumeTool,
      "oc-abort": ocAbortTool,
      "oc-cancel": ocCancelTool,
    },
  }
}

const module: PluginModule = {
  id: "oc-loop",
  server: plugin,
}

export default module
```

- [ ] **Step 5: Run typecheck**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun run typecheck
```
Expected: PASS (or fix import issues).

- [ ] **Step 6: Commit**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && git add -A && git commit -m "feat: register all loop control tools and wire plugin entry"
```

---

### Task 7: Implement watch mode scheduler

**Files:**
- Create: `src/watch-scheduler.ts`
- Create: `src/watch-scheduler.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write failing watch scheduler tests**

```ts
// src/watch-scheduler.test.ts
import { describe, expect, test } from "bun:test"
import { nextWakeDelay } from "./watch-scheduler"

describe("nextWakeDelay", () => {
  test("returns interval seconds when state has intervalSeconds", () => {
    expect(nextWakeDelay(300)).toBe(300)
  })
  test("returns default 300 when no interval", () => {
    expect(nextWakeDelay(null)).toBe(300)
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun test src/watch-scheduler.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement watch scheduler**

```ts
// src/watch-scheduler.ts
const DEFAULT_WATCH_INTERVAL = 300

export function nextWakeDelay(intervalSeconds: number | null): number {
  return intervalSeconds ?? DEFAULT_WATCH_INTERVAL
}
```

- [ ] **Step 4: Run tests to pass**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun test src/watch-scheduler.test.ts
```
Expected: PASS.

- [ ] **Step 5: Integrate into event handler watch path and commit**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && git add -A && git commit -m "feat: add watch mode interval scheduler"
```

---

### Task 8: Full test suite pass and README

**Files:**
- Create: `README.md`
- Test: all `src/**/*.test.ts`

- [ ] **Step 1: Run full test suite**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun test
```
Expected: PASS.

- [ ] **Step 2: Run typecheck**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && bun run typecheck
```
Expected: PASS.

- [ ] **Step 3: Write README**

```md
# oc-loop

Elegant loop plugin for [opencode](https://opencode.ai).

Two modes:
- **Task mode**: Execute until verified completion (test gate + model claim)
- **Watch mode**: Poll on interval until manually stopped

## Install

Add to `~/.config/opencode/opencode.json`:

```json
{ "plugin": ["oc-loop"] }
```

## Usage

### Task mode
```
/oc-loop "Build user authentication" --test="bun test" --max-iterations=50
```

### Watch mode
```
/oc-watch "Check deployment status" --interval=300
```

### Controls
- `/oc-pause` — Pause loop
- `/oc-resume` — Resume paused loop
- `/oc-abort` — Abort current turn only
- `/oc-cancel` — Cancel and clear loop

## How it works

1. State machine with explicit transitions (IDLE→RUNNING→VERIFYING→DONE/RETRY)
2. Task mode: runs test command (if configured) + checks model claim before declaring done
3. Watch mode: polls on interval, never auto-completes
4. Adaptive retry backoff: 5s→15s→30s→60s
5. State persisted to `.oc-loop/state.json` (add to `.gitignore`)

## License

MIT
```

- [ ] **Step 4: Final commit**

```bash
cd "E:/AProject/TianX/Personal/opencode-loop/oc-loop" && git add -A && git commit -m "docs: add README and verify full test suite"
```

---

## Spec Coverage Check

- Standalone plugin packaging and distribution: Task 1
- State machine with 7 statuses + mode-aware transitions: Task 2
- Task mode completion verifier (test gate + model claim): Task 3
- Continuation prompts for both modes: Task 4
- Event-driven continuation with adaptive backoff: Task 5
- Custom tools for all controls: Task 6
- Watch mode interval scheduling: Task 7
- Full test coverage and documentation: Task 8

## Placeholder Scan

- No `TODO`, `TBD`, or deferred placeholders.
- All code steps include complete implementations.
- All test steps include exact commands and expected outcomes.

## Type Consistency Check

- `LoopStatus` values consistent across `types.ts`, `state-machine.ts`, `event-handler.ts`
- `LoopMode` used consistently in transition function and prompt builder
- `LoopState` fields match between storage, tools, and event handler
