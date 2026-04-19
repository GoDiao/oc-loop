# oc-loop Guide

This is the full operational guide for `oc-loop`.

If you want the short pitch page, see [README](../README.md).

## Install (local source)

1) Locate plugin entry file:

```text
E:/AProject/TianX/Personal/opencode-loop/oc-loop/src/index.ts
```

2) Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "file:///E:/AProject/TianX/Personal/opencode-loop/oc-loop/src/index.ts"
  ]
}
```

3) Restart opencode.

4) Verify commands exist:
- `/oc-loop`
- `/oc-watch`
- `/oc-list`

## Core modes

### `/oc-loop` — plan-driven implementation loop

```text
/oc-loop "Build user authentication" --maxIterations=50
```

Completion requires:
1. checklist all `done: true`
2. completion tag present
3. if testCommand set, command exits `0`

### `/oc-watch` — interval watch loop

```text
/oc-watch "Check deployment status" --interval=5m --maxIterations=864
```

Supported interval formats:

```text
--interval=30s
--interval=5m
--interval=1h
```

(legacy `--intervalSeconds` is still supported)

Approximate total duration:

```text
interval * maxIterations
```

`oc-watch` is manual-stop oriented. Stop with `/oc-cancel`.

Cadence semantics (important):
- If a turn finishes before the scheduled wake time, it waits until that time.
- If a turn finishes after the scheduled wake time, the next watch turn starts immediately on idle.
- After each actual trigger, the next wake time is recalculated from that trigger time.

## Commands

- `/oc-loop "..." [--testCommand="..."] [--maxIterations=N]`
- `/oc-watch "..." [--interval=30s|5m|1h] [--maxIterations=N]`
- `/oc-list`
- `/oc-pause [--runId=...] [--sessionId=...]`
- `/oc-resume [--runId=...] [--sessionId=...]`
- `/oc-abort [--runId=...] [--sessionId=...]`
- `/oc-cancel [--runId=...] [--sessionId=...]`

## Multi-instance behavior

- Multiple sessions can run loops concurrently.
- Each run has a unique `runId`.
- Without targeting flags, control commands apply to the current session’s active run.
- Use `/oc-list` + `--runId` for precise control.

## Examples

### Run two loops in parallel (different sessions)

Session A:

```text
/oc-loop "Implement auth refactor" --maxIterations=80
```

Session B:

```text
/oc-watch "Track deployment health" --interval=5m --maxIterations=288
```

### Precisely control one run

```text
/oc-list
/oc-pause --runId=<run-id>
/oc-resume --runId=<run-id>
/oc-cancel --runId=<run-id>
```

## State and recovery

Persistent state file:

```text
.oc-loop/state.json
```

It stores a versioned multi-run envelope, allowing resumption and targeted controls.

## Troubleshooting

### Commands not found

- Verify plugin path exists.
- Ensure `file:///.../src/index.ts` is in opencode config.
- Restart opencode.

### Wrong run got controlled

- Use `/oc-list` first.
- Pass `--runId` explicitly.
