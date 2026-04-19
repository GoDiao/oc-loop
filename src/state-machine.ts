import type { LoopEvent, LoopMode, LoopStatus } from "./types"

const TABLE: Record<LoopStatus, Partial<Record<LoopEvent, LoopStatus>>> = {
  IDLE: { START: "RUNNING", CANCEL: "CANCELLED" },
  RUNNING: { ITERATION_FINISHED: "VERIFYING", PAUSE: "PAUSED", CANCEL: "CANCELLED" },
  VERIFYING: {
    VERIFY_PASS: "DONE",
    VERIFY_RETRY: "WAIT_RETRY",
    VERIFY_FAIL: "FAILED",
    PAUSE: "PAUSED",
    CANCEL: "CANCELLED",
  },
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
