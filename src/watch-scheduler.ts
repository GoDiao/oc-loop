import { DEFAULT_WATCH_INTERVAL } from "./constants"

type TimerHandle = ReturnType<typeof setTimeout>

type OnTick = () => Promise<void> | void

export type WatchScheduler = {
  schedule: (runId: string, delaySeconds: number, onTick: OnTick) => void
  cancel: (runId: string) => void
  has: (runId: string) => boolean
  cancelAll: () => void
}

export function nextWakeDelay(intervalSeconds: number | null): number {
  return Math.max(0, intervalSeconds ?? DEFAULT_WATCH_INTERVAL)
}

export function createWatchScheduler(): WatchScheduler {
  const timers = new Map<string, TimerHandle>()

  return {
    schedule(runId, delaySeconds, onTick) {
      const existing = timers.get(runId)
      if (existing) {
        clearTimeout(existing)
      }

      const handle = setTimeout(async () => {
        timers.delete(runId)
        await onTick()
      }, Math.max(0, delaySeconds) * 1000)

      timers.set(runId, handle)
    },

    cancel(runId) {
      const existing = timers.get(runId)
      if (!existing) return
      clearTimeout(existing)
      timers.delete(runId)
    },

    has(runId) {
      return timers.has(runId)
    },

    cancelAll() {
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
    },
  }
}
