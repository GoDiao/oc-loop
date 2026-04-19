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

export interface PlanChecklistItem {
  title: string
  done: boolean
}

export interface LoopState {
  runId: string
  sessionId: string
  active: boolean
  mode: LoopMode
  status: LoopStatus
  iteration: number
  maxIterations: number
  prompt: string
  startedAt: string
  retryCount: number
  nextWakeAt: string | null
  // Task mode
  testCommand: string | null
  lastTestOutput: string | null
  planChecklist: PlanChecklistItem[] | null
  // Watch mode
  intervalSeconds: number | null
  lastResult: string | null
  abortRequestedAt?: string
}

export interface VerifyResult {
  decision: "pass" | "retry" | "fail"
  reasons: string[]
}

export interface LoopStore {
  version: 2
  runs: Record<string, LoopState>
  activeRunBySession: Record<string, string>
  updatedAt: string
}
