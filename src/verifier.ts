import type { LoopState, VerifyResult } from "./types"

type VerifyInput = {
  planChecklist: LoopState["planChecklist"]
  hasDoneTag: boolean
  testCommand: string | null
  testExitCode: number | null
}

function allChecklistDone(planChecklist: LoopState["planChecklist"]): boolean {
  if (!planChecklist || planChecklist.length === 0) return false
  return planChecklist.every((item) => item.done)
}

export function evaluateCompletion(input: VerifyInput): VerifyResult {
  const reasons: string[] = []

  if (!allChecklistDone(input.planChecklist)) {
    reasons.push("plan checklist has unfinished items")
  }

  if (!input.hasDoneTag) {
    reasons.push("completion tag missing")
  }

  if (input.testCommand !== null && input.testExitCode !== null && input.testExitCode !== 0) {
    reasons.push(`test command exited with code ${input.testExitCode}`)
  }

  if (reasons.length === 0) return { decision: "pass", reasons: [] }
  return { decision: "retry", reasons }
}
