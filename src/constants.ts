export const STATE_DIR = ".oc-loop"
export const STATE_FILE = "state.json"
export const DEFAULT_MAX_ITERATIONS_TASK = 100
export const DEFAULT_MAX_ITERATIONS_WATCH = 10000
export const DEFAULT_BACKOFF_SECONDS = [5, 15, 30, 60] as const
export const MAX_BACKOFF_SECONDS = 60
export const DEFAULT_WATCH_INTERVAL = 300
export const COMPLETION_TAG = "<oc-loop-done>"
