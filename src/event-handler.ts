import type { PluginInput } from "@opencode-ai/plugin"
import { COMPLETION_TAG, DEFAULT_BACKOFF_SECONDS, MAX_BACKOFF_SECONDS } from "./constants"
import type { PlanChecklistItem } from "./types"
import { buildTaskContinuation, buildWatchPrompt } from "./prompt-builder"
import { transition } from "./state-machine"
import { clearStateByRunId, getActiveStateBySession, getStateByRunId, upsertState } from "./storage"
import { evaluateCompletion } from "./verifier"
import { createWatchScheduler, nextWakeDelay } from "./watch-scheduler"

type SessionMessagePart = { type?: string; text?: string }
type SessionMessage = { info?: { role?: string }; parts?: SessionMessagePart[] }

type CompletionSignals = {
  hasDoneTag: boolean
  planChecklist: PlanChecklistItem[] | null
}

function extractJsonCodeBlocks(text: string): string[] {
  const blocks: string[] = []
  const regex = /```json\s*([\s\S]*?)```/gi
  let matched: RegExpExecArray | null = regex.exec(text)
  while (matched) {
    if (matched[1]) blocks.push(matched[1].trim())
    matched = regex.exec(text)
  }
  return blocks
}

function toPlanChecklist(raw: unknown): PlanChecklistItem[] | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  const checklistRaw = obj.planChecklist
  if (!Array.isArray(checklistRaw) || checklistRaw.length === 0) return null

  const checklist: PlanChecklistItem[] = []
  for (const item of checklistRaw) {
    if (!item || typeof item !== "object") return null
    const row = item as Record<string, unknown>
    const title = row.title
    const done = row.done
    if (typeof title !== "string" || typeof done !== "boolean") return null
    checklist.push({ title, done })
  }

  return checklist
}

function parseCompletionSignalsFromText(text: string): CompletionSignals {
  const hasDoneTag = text.includes(COMPLETION_TAG)
  const blocks = extractJsonCodeBlocks(text)

  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(blocks[i] ?? "")
      const planChecklist = toPlanChecklist(parsed)
      if (planChecklist) return { hasDoneTag, planChecklist }
    } catch {
      continue
    }
  }

  return { hasDoneTag, planChecklist: null }
}

function latestAssistantText(messages: SessionMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]
    if (msg?.info?.role !== "assistant") continue
    const text = (msg.parts ?? [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join("\n")
      .trim()
    if (text) return text
  }
  return ""
}

async function readCompletionSignals(ctx: PluginInput, sessionID: string): Promise<CompletionSignals> {
  try {
    const response = await ctx.client.session.messages({
      path: { id: sessionID },
      query: { directory: ctx.directory },
    })

    const raw = response as unknown
    const data =
      typeof raw === "object" && raw !== null && "data" in raw
        ? (raw as { data?: unknown }).data
        : undefined

    const messages = (Array.isArray(raw) ? raw : Array.isArray(data) ? data : []) as SessionMessage[]
    const assistantText = latestAssistantText(messages)
    if (!assistantText) return { hasDoneTag: false, planChecklist: null }

    return parseCompletionSignalsFromText(assistantText)
  } catch {
    return { hasDoneTag: false, planChecklist: null }
  }
}

export function createEventHandler(ctx: PluginInput) {
  const inFlight = new Set<string>()
  const scheduler = createWatchScheduler()

  return async ({ event }: { event: { type: string; properties?: any } }): Promise<void> => {
    const props = event.properties ?? {}
    const sessionID: string | undefined = props.sessionID

    if (event.type === "session.error") {
      if (sessionID) {
        const state = getActiveStateBySession(ctx.directory, sessionID)
        if (state) scheduler.cancel(state.runId)
        if (state && state.sessionId === sessionID && props.error?.name === "MessageAbortedError") {
          if (state.abortRequestedAt) {
            state.abortRequestedAt = undefined
            state.status = "RUNNING"
            upsertState(ctx.directory, state)
          } else {
            clearStateByRunId(ctx.directory, state.runId)
          }
        }
      }
      return
    }

    if (event.type === "session.deleted") {
      const deletedID = props.info?.id
      if (deletedID) {
        const state = getActiveStateBySession(ctx.directory, deletedID)
        if (!state) return
        scheduler.cancel(state.runId)
        if (state.sessionId === deletedID) clearStateByRunId(ctx.directory, state.runId)
      }
      return
    }

    const isIdle =
      event.type === "session.idle" ||
      (event.type === "session.status" && props.status?.type === "idle")

    if (!isIdle || !sessionID) return
    if (inFlight.has(sessionID)) return

    inFlight.add(sessionID)
    try {
      const state = getActiveStateBySession(ctx.directory, sessionID)
      if (!state || !state.active) return
      if (state.sessionId !== sessionID) return
      if (["PAUSED", "DONE", "FAILED", "CANCELLED"].includes(state.status)) return

      if (state.iteration >= state.maxIterations) {
        state.status = "FAILED"
        upsertState(ctx.directory, state)
        return
      }

      if (state.status === "WAIT_RETRY" && state.nextWakeAt) {
        const wakeAt = Date.parse(state.nextWakeAt)
        if (!Number.isNaN(wakeAt) && Date.now() < wakeAt) return
      }

      if (state.mode === "watch" && state.nextWakeAt) {
        const wakeAt = Date.parse(state.nextWakeAt)
        if (!Number.isNaN(wakeAt) && Date.now() < wakeAt) return

        if (state.status === "WAITING" || state.status === "RUNNING") {
          if (state.status === "WAITING") {
            state.status = transition(state.status, "TICK", state.mode)
          }
          state.iteration += 1
          state.lastResult = null
          const delaySeconds = nextWakeDelay(state.intervalSeconds)
          state.nextWakeAt = new Date(Date.now() + delaySeconds * 1000).toISOString()
          upsertState(ctx.directory, state)

          const prompt = buildWatchPrompt(state)
          await ctx.client.session.promptAsync({
            path: { id: sessionID },
            body: { parts: [{ type: "text", text: prompt }] },
            query: { directory: ctx.directory },
          })
          return
        }
      }

      const completionSignals = await readCompletionSignals(ctx, sessionID)
      if (completionSignals.planChecklist) {
        state.planChecklist = completionSignals.planChecklist
      }

      let testExitCode: number | null = null
      if (state.mode === "task" && state.testCommand) {
        try {
          const proc = Bun.spawnSync(["sh", "-c", state.testCommand], {
            cwd: ctx.directory,
            timeout: 120000,
          })
          testExitCode = proc.exitCode
          state.lastTestOutput = proc.stdout.toString().slice(0, 2000)
        } catch {
          testExitCode = -1
        }
      }

      if (state.mode === "task") {
        state.status = transition(state.status, "ITERATION_FINISHED", state.mode)

        const result = evaluateCompletion({
          planChecklist: state.planChecklist,
          hasDoneTag: completionSignals.hasDoneTag,
          testCommand: state.testCommand,
          testExitCode,
        })

        if (result.decision === "pass") {
          state.status = transition(state.status, "VERIFY_PASS", state.mode)
          upsertState(ctx.directory, state)
          if (state.status === "DONE") {
            scheduler.cancel(state.runId)
            clearStateByRunId(ctx.directory, state.runId)
          }
          return
        }

        state.status = transition(state.status, "VERIFY_RETRY", state.mode)
        const backoff =
          DEFAULT_BACKOFF_SECONDS[Math.min(state.retryCount, DEFAULT_BACKOFF_SECONDS.length - 1)] ??
          MAX_BACKOFF_SECONDS
        const delaySeconds = state.retryCount === 0 ? 0 : backoff

        state.retryCount += 1
        state.iteration += 1
        state.nextWakeAt =
          delaySeconds > 0 ? new Date(Date.now() + delaySeconds * 1000).toISOString() : null
        upsertState(ctx.directory, state)

        const prompt = buildTaskContinuation(state, result)

        if (delaySeconds === 0) {
          state.status = "RUNNING"
          state.nextWakeAt = null
          upsertState(ctx.directory, state)
          await ctx.client.session.promptAsync({
            path: { id: sessionID },
            body: { parts: [{ type: "text", text: prompt }] },
            query: { directory: ctx.directory },
          })
          return
        }

        const retryDelay = delaySeconds
        const runId = state.runId
        scheduler.schedule(runId, retryDelay, async () => {
          const latest = getStateByRunId(ctx.directory, runId)
          if (!latest || !latest.active) return
          if (latest.sessionId !== sessionID) return
          if (latest.mode !== "task") return

          if (latest.status === "PAUSED") {
            scheduler.schedule(runId, retryDelay, async () => {})
            return
          }

          if (latest.status !== "WAIT_RETRY") return

          if (latest.nextWakeAt) {
            const wakeAt = Date.parse(latest.nextWakeAt)
            if (!Number.isNaN(wakeAt) && Date.now() < wakeAt) {
              scheduler.schedule(runId, 1, async () => {})
              return
            }
          }

          latest.status = "RUNNING"
          latest.nextWakeAt = null
          upsertState(ctx.directory, latest)

          await ctx.client.session.promptAsync({
            path: { id: sessionID },
            body: { parts: [{ type: "text", text: prompt }] },
            query: { directory: ctx.directory },
          })
        })
        return
      }

      if (state.mode === "watch") {
        if (completionSignals.hasDoneTag || completionSignals.planChecklist?.every((item) => item.done)) {
          state.status = "DONE"
          upsertState(ctx.directory, state)
          scheduler.cancel(state.runId)
          clearStateByRunId(ctx.directory, state.runId)
          return
        }

        const delaySeconds = nextWakeDelay(state.intervalSeconds)

        state.status = transition(state.status, "ITERATION_FINISHED", state.mode)
        state.nextWakeAt = new Date(Date.now() + delaySeconds * 1000).toISOString()
        upsertState(ctx.directory, state)

        const runId = state.runId
        scheduler.schedule(runId, delaySeconds, async () => {
          const latest = getStateByRunId(ctx.directory, runId)
          if (!latest || !latest.active) return
          if (latest.sessionId !== sessionID) return
          if (latest.mode !== "watch") return

          if (latest.status === "PAUSED") {
            scheduler.schedule(runId, delaySeconds, async () => {})
            return
          }

          if (latest.status !== "WAITING") return

          latest.status = transition(latest.status, "TICK", latest.mode)
          latest.iteration += 1
          latest.lastResult = null
          latest.nextWakeAt = null
          upsertState(ctx.directory, latest)

          const prompt = buildWatchPrompt(latest)
          await ctx.client.session.promptAsync({
            path: { id: sessionID },
            body: { parts: [{ type: "text", text: prompt }] },
            query: { directory: ctx.directory },
          })
        })
      }
    } finally {
      inFlight.delete(sessionID)
    }
  }
}
