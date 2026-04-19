import type { LoopState, VerifyResult } from "./types"

export function buildTaskContinuation(state: LoopState, verifyResult: VerifyResult): string {
  return `[OC-LOOP TASK — ITERATION ${state.iteration}/${state.maxIterations}]

Previous iteration did not pass verification.

Verification reasons: ${verifyResult.reasons.join("; ") || "none"}

IMPORTANT:
- Review your progress so far
- Continue from where you left off
- Keep and update a plan checklist in your response as JSON code block:
  \`\`\`json
  {"planChecklist": [{"title": "step 1", "done": false}, {"title": "step 2", "done": true}]}
  \`\`\`
- Mark every finished item with \`done: true\`
- Loop will stop only when all checklist items are done
${state.testCommand ? `- Tests will be run automatically (${state.testCommand}). Ensure they pass before marking the checklist fully done.` : ""}

Original task:
${state.prompt}`
}

export function buildWatchPrompt(state: LoopState): string {
  return `[OC-LOOP WATCH — ITERATION ${state.iteration}/${state.maxIterations}]

Check the current status and report findings.

Task:
${state.prompt}

Report your findings.
Only the user can decide to stop this watch loop.
Do not call /oc-cancel yourself.
If stopping is needed, tell the user to run /oc-cancel manually.`
}
