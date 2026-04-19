# oc-loop

<p align="center">
  <img src="https://img.shields.io/github/stars/GoDiao/oc-loop?style=for-the-badge" alt="GitHub stars"/>
  <img src="https://img.shields.io/github/license/GoDiao/oc-loop?style=for-the-badge" alt="License"/>
  <img src="https://img.shields.io/badge/opencode-plugin-blue?style=for-the-badge" alt="opencode plugin"/>
</p>

<p align="center">
  <img src="assets/promo.png" alt="oc-loop promo" width="1200" style="border-radius: 16px; border: 1px solid #2a2a2a; box-shadow: 0 12px 32px rgba(0,0,0,.35);" />
</p>

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

Edit `~/.config/opencode/opencode.json` and add your local plugin path.

Both forms are supported (pick one):
- Directory path (recommended): `file:///ABSOLUTE_PATH_TO/oc-loop`
- Explicit entry file: `file:///ABSOLUTE_PATH_TO/oc-loop/src/index.ts`

```json
{
  "plugin": [
    "file:///ABSOLUTE_PATH_TO/oc-loop"
  ]
}
```

Example on Windows (your path):

```json
{
  "plugin": [
    "file:///E:/dev/oc-loop"
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
