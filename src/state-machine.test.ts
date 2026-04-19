import { describe, expect, test } from "bun:test"
import { transition } from "./state-machine"

describe("transition (task mode)", () => {
  test("IDLE -> RUNNING on START", () => {
    expect(transition("IDLE", "START")).toBe("RUNNING")
  })

  test("RUNNING -> VERIFYING on ITERATION_FINISHED", () => {
    expect(transition("RUNNING", "ITERATION_FINISHED", "task")).toBe("VERIFYING")
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
    expect(transition("RUNNING", "ITERATION_FINISHED", "watch")).toBe("WAITING")
  })

  test("WAITING -> RUNNING on TICK", () => {
    expect(transition("WAITING", "TICK", "watch")).toBe("RUNNING")
  })
})
