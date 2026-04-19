import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { STATE_DIR, STATE_FILE } from "./constants"
import type { LoopState, LoopStore } from "./types"

function getStatePath(projectDir: string): string {
  return join(projectDir, STATE_DIR, STATE_FILE)
}

function emptyStore(): LoopStore {
  return {
    version: 2,
    runs: {},
    activeRunBySession: {},
    updatedAt: new Date().toISOString(),
  }
}

function toStore(raw: unknown): LoopStore {
  if (!raw || typeof raw !== "object") return emptyStore()
  const candidate = raw as Partial<LoopStore>

  if (
    candidate.version === 2 &&
    candidate.runs &&
    typeof candidate.runs === "object" &&
    candidate.activeRunBySession &&
    typeof candidate.activeRunBySession === "object"
  ) {
    return {
      version: 2,
      runs: candidate.runs as Record<string, LoopState>,
      activeRunBySession: candidate.activeRunBySession as Record<string, string>,
      updatedAt:
        typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString(),
    }
  }

  const legacy = raw as Partial<LoopState>
  if (typeof legacy.runId === "string" && typeof legacy.sessionId === "string") {
    return {
      version: 2,
      runs: { [legacy.runId]: legacy as LoopState },
      activeRunBySession: legacy.active ? { [legacy.sessionId]: legacy.runId } : {},
      updatedAt: new Date().toISOString(),
    }
  }

  return emptyStore()
}

export function readStore(projectDir: string): LoopStore {
  const path = getStatePath(projectDir)
  if (!existsSync(path)) return emptyStore()

  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown
    return toStore(raw)
  } catch {
    return emptyStore()
  }
}

export function writeStore(projectDir: string, store: LoopStore): boolean {
  const path = getStatePath(projectDir)
  const dir = join(projectDir, STATE_DIR)

  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const normalized: LoopStore = {
      version: 2,
      runs: store.runs,
      activeRunBySession: store.activeRunBySession,
      updatedAt: new Date().toISOString(),
    }
    writeFileSync(path, JSON.stringify(normalized, null, 2), "utf-8")
    return true
  } catch {
    return false
  }
}

export function listStates(projectDir: string): LoopState[] {
  const store = readStore(projectDir)
  return Object.values(store.runs)
}

export function getStateByRunId(projectDir: string, runId: string): LoopState | null {
  const store = readStore(projectDir)
  return store.runs[runId] ?? null
}

export function getActiveStateBySession(projectDir: string, sessionId: string): LoopState | null {
  const store = readStore(projectDir)
  const runId = store.activeRunBySession[sessionId]
  if (!runId) return null
  return store.runs[runId] ?? null
}

export function upsertState(projectDir: string, state: LoopState): boolean {
  const store = readStore(projectDir)
  store.runs[state.runId] = state
  if (state.active) {
    store.activeRunBySession[state.sessionId] = state.runId
  } else if (store.activeRunBySession[state.sessionId] === state.runId) {
    delete store.activeRunBySession[state.sessionId]
  }
  return writeStore(projectDir, store)
}

export function clearStateByRunId(projectDir: string, runId: string): boolean {
  const store = readStore(projectDir)
  const target = store.runs[runId]
  if (!target) return false

  delete store.runs[runId]
  if (store.activeRunBySession[target.sessionId] === runId) {
    delete store.activeRunBySession[target.sessionId]
  }

  if (Object.keys(store.runs).length === 0) {
    return clearState(projectDir)
  }

  return writeStore(projectDir, store)
}

export function readState(projectDir: string): LoopState | null {
  const states = listStates(projectDir)
  if (states.length === 0) return null
  states.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
  return states[0] ?? null
}

export function writeState(projectDir: string, state: LoopState): boolean {
  return upsertState(projectDir, state)
}

export function clearState(projectDir: string): boolean {
  const path = getStatePath(projectDir)

  try {
    if (existsSync(path)) unlinkSync(path)
    return true
  } catch {
    return false
  }
}
