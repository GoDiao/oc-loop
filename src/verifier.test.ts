import { describe, expect, test } from "bun:test"
import { evaluateCompletion } from "./verifier"

describe("evaluateCompletion (task mode)", () => {
  test("passes when checklist fully done, done tag present, and no test command", () => {
    const result = evaluateCompletion({
      planChecklist: [
        { title: "A", done: true },
        { title: "B", done: true },
      ],
      hasDoneTag: true,
      testCommand: null,
      testExitCode: null,
    })
    expect(result.decision).toBe("pass")
  })

  test("passes when checklist completed and test command passes", () => {
    const result = evaluateCompletion({
      planChecklist: [{ title: "A", done: true }],
      hasDoneTag: true,
      testCommand: "bun test",
      testExitCode: 0,
    })
    expect(result.decision).toBe("pass")
  })

  test("retry when checklist has unfinished item", () => {
    const result = evaluateCompletion({
      planChecklist: [
        { title: "A", done: true },
        { title: "B", done: false },
      ],
      hasDoneTag: false,
      testCommand: null,
      testExitCode: null,
    })
    expect(result.decision).toBe("retry")
  })

  test("retry when checklist missing", () => {
    const result = evaluateCompletion({
      planChecklist: null,
      hasDoneTag: false,
      testCommand: null,
      testExitCode: null,
    })
    expect(result.decision).toBe("retry")
  })

  test("retry when checklist done but done tag missing", () => {
    const result = evaluateCompletion({
      planChecklist: [{ title: "A", done: true }],
      hasDoneTag: false,
      testCommand: null,
      testExitCode: null,
    })
    expect(result.decision).toBe("retry")
  })

  test("retry when checklist done but test command fails", () => {
    const result = evaluateCompletion({
      planChecklist: [{ title: "A", done: true }],
      hasDoneTag: true,
      testCommand: "bun test",
      testExitCode: 1,
    })
    expect(result.decision).toBe("retry")
  })
})
