# oc-loop

**Ship complex tasks with confidence — not one-shot luck.**

`oc-loop` turns opencode into a controlled execution engine with resumable loops, explicit run control, and multi-session concurrency.

## Why oc-loop

- **Finish, don’t drift**: iterate until completion conditions are met
- **Run safely**: pause/resume/abort/cancel with explicit targeting
- **Scale naturally**: concurrent runs across sessions
- **Stay recoverable**: persistent run state

## Two modes

- **`/oc-loop`** — plan-driven implementation loop
- **`/oc-watch`** — time-based watch loop

## 30-second quickstart

```text
/oc-loop "Build user authentication" --testCommand="bun test" --maxIterations=50
```

```text
/oc-watch "Check deployment status" --interval=5m --maxIterations=864
```

```text
/oc-list
/oc-pause --runId=<run-id>
/oc-resume --runId=<run-id>
/oc-cancel --runId=<run-id>
```

## Install

### 1) Clone the repository

```bash
git clone https://github.com/GoDiao/oc-loop.git
cd oc-loop
```

### 2) Install dependencies

```bash
bun install
```

### 3) Register the plugin in opencode config

Edit `~/.config/opencode/opencode.json` and add your local plugin entry path:

```json
{
  "plugin": [
    "file:///ABSOLUTE_PATH_TO/oc-loop/src/index.ts"
  ]
}
```

Example on Windows:

```json
{
  "plugin": [
    "file:///D:/dev/oc-loop/src/index.ts"
  ]
}
```

### 3) Restart opencode and verify

Commands should be available:
- `/oc-loop`
- `/oc-watch`
- `/oc-list`

## Full docs

- [Docs Index](docs/README.md)
- [Usage Guide](docs/guide.md)
- [Architecture](docs/architecture.md)

## License

MIT
