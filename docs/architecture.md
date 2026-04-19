# Architecture

This document describes the internal design of `oc-loop`.

## High-level design

`oc-loop` is an opencode plugin that orchestrates loop execution with a persistent state machine.

Main entrypoint:
- `src/index.ts`

Core pieces:
- slash-command adapter: `src/slash-command.ts`
- event orchestrator: `src/event-handler.ts`
- state machine: `src/state-machine.ts`
- storage layer: `src/storage.ts`
- watch scheduler: `src/watch-scheduler.ts`
- tools: `src/tools/*`

## Runtime model

Two modes:
- `task` (`/oc-loop`): plan/checklist-driven iteration with optional test gate
- `watch` (`/oc-watch`): interval-based monitoring loop

Loop state shape:
- `LoopState` in `src/types.ts`

Persistent store shape:
- `LoopStore` in `src/types.ts`
- stored at `.oc-loop/state.json`

## Multi-instance storage model

`storage.ts` now uses a versioned multi-run envelope:
- `runs: Record<runId, LoopState>`
- `activeRunBySession: Record<sessionId, runId>`

Key APIs:
- `readStore`, `writeStore`
- `upsertState`, `getStateByRunId`, `getActiveStateBySession`, `listStates`, `clearStateByRunId`

Legacy compatibility:
- old single-state JSON is auto-wrapped into v2 store on read.

## Event flow

Event source:
- plugin `event` hook in `src/index.ts` delegates to `createEventHandler`.

Main driver:
- `session.idle` / `session.status(idle)`

Routing:
- resolve active run by `sessionID`
- process only that run

Task mode:
1. parse completion signals from latest assistant response
2. optional test command execution
3. verify via `evaluateCompletion`
4. pass => mark done and clear run
5. retry => backoff schedule and continue prompt

Watch mode:
1. schedules next wake by interval
2. if idle arrives after `nextWakeAt`, trigger immediately
3. next schedule is recalculated from actual trigger time (`now + interval`)
4. manual stop via `/oc-cancel`

## Scheduling semantics

Scheduler module:
- `src/watch-scheduler.ts`

Timer keys:
- keyed by `runId` to avoid collisions across runs

Cadence semantics:
- idle-aware cadence (not strict wall-clock replay)
- no catch-up burst loops

## Command/Tool surface

Registered tools (see `src/index.ts`):
- `oc-loop`, `oc-watch`, `oc-list`, `oc-pause`, `oc-resume`, `oc-abort`, `oc-cancel`

Slash command shim:
- parses command text
- emits strict single-tool invocation payload
- supports control targeting flags: `--runId`, `--sessionId`
- supports watch interval shorthand: `--interval=30s|5m|1h`

## Source map

- Plugin bootstrap: `src/index.ts`
- Command parsing: `src/slash-command.ts`
- Event orchestration: `src/event-handler.ts`
- Verification logic: `src/verifier.ts`
- Prompt generation: `src/prompt-builder.ts`
- Persistence: `src/storage.ts`
- Scheduler: `src/watch-scheduler.ts`
- Tool implementations: `src/tools/*`

## Testing strategy

Main test files:
- `src/event-handler.test.ts`
- `src/storage.test.ts`
- `src/watch-scheduler.test.ts`
- `src/slash-command.test.ts`
- `src/tools/*.test.ts`

Recommended local checks:

```text
bun test src
bun run typecheck
```
