import type { LoopState } from "../types"
import { getActiveStateBySession, getStateByRunId } from "../storage"

export type TargetArgs = {
  runId?: string
  sessionId?: string
}

export function resolveTargetState(directory: string, contextSessionID: string, args: TargetArgs): LoopState | null {
  if (args.runId) {
    return getStateByRunId(directory, args.runId)
  }

  if (args.sessionId) {
    return getActiveStateBySession(directory, args.sessionId)
  }

  return getActiveStateBySession(directory, contextSessionID)
}
