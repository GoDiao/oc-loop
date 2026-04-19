import { describe, expect, test } from "bun:test"
import { applyOcLoopSlashCommands, createOcLoopCommandExecuteBefore } from "./slash-command"

describe("slash-command", () => {
  test("registers all oc-loop slash commands in config", () => {
    const config: { command?: Record<string, { template: string; description?: string }> } = {}

    applyOcLoopSlashCommands(config)

    expect(Object.keys(config.command ?? {}).sort()).toEqual([
      "oc-abort",
      "oc-cancel",
      "oc-list",
      "oc-loop",
      "oc-pause",
      "oc-resume",
      "oc-watch",
    ])
    expect(config.command?.["oc-loop"]?.template).toContain("$ARGUMENTS")
    expect(config.command?.["oc-watch"]?.template).toContain("$ARGUMENTS")
  })

  test("does not override existing user command", () => {
    const config: { command?: Record<string, { template: string; description?: string }> } = {
      command: {
        "oc-loop": {
          template: "user-template",
          description: "custom",
        },
      },
    }

    applyOcLoopSlashCommands(config)

    expect(config.command?.["oc-loop"]).toEqual({
      template: "user-template",
      description: "custom",
    })
    expect(config.command?.["oc-watch"]?.template).toContain("$ARGUMENTS")
  })

  test("injects oc-loop tool invocation prompt with parsed args", async () => {
    const hook = createOcLoopCommandExecuteBefore()
    const output = {
      parts: [{ type: "text", text: "placeholder" }],
    }

    await hook(
      {
        command: "oc-loop",
        sessionID: "s1",
        arguments: "Build auth --testCommand=\"bun test\" --maxIterations=50",
      },
      output,
    )

    const text = output.parts[0]?.text
    expect(typeof text).toBe("string")
    expect(text).toContain("Invoke tool `oc-loop` exactly once")
    expect(text).toContain('"task": "Build auth"')
    expect(text).toContain('"testCommand": "bun test"')
    expect(text).toContain('"maxIterations": 50')
  })

  test("injects oc-watch tool invocation prompt with parsed args", async () => {
    const hook = createOcLoopCommandExecuteBefore()
    const output = {
      parts: [{ type: "text", text: "placeholder" }],
    }

    await hook(
      {
        command: "oc-watch",
        sessionID: "s1",
        arguments: "Check deployment --interval=5m --maxIterations=20",
      },
      output,
    )

    const text = output.parts[0]?.text
    expect(typeof text).toBe("string")
    expect(text).toContain("Invoke tool `oc-watch` exactly once")
    expect(text).toContain('"task": "Check deployment"')
    expect(text).toContain('"interval": "5m"')
    expect(text).toContain('"maxIterations": 20')
  })

  test("injects control command payload with targeting flags", async () => {
    const hook = createOcLoopCommandExecuteBefore()
    const output = {
      parts: [{ type: "text", text: "placeholder" }],
    }

    await hook(
      {
        command: "oc-pause",
        sessionID: "s1",
        arguments: "--runId=run-1 --sessionId=s2",
      },
      output,
    )

    const text = output.parts[0]?.text
    expect(typeof text).toBe("string")
    expect(text).toContain("Invoke tool `oc-pause` exactly once")
    expect(text).toContain('"runId": "run-1"')
    expect(text).toContain('"sessionId": "s2"')
  })

  test("injects no-args payload for oc-list", async () => {
    const hook = createOcLoopCommandExecuteBefore()
    const output = {
      parts: [{ type: "text", text: "placeholder" }],
    }

    await hook(
      {
        command: "oc-list",
        sessionID: "s1",
        arguments: "",
      },
      output,
    )

    const text = output.parts[0]?.text
    expect(typeof text).toBe("string")
    expect(text).toContain("Invoke tool `oc-list` exactly once")
    expect(text).toContain("{}")
  })

  test("does nothing for unrelated commands", async () => {
    const hook = createOcLoopCommandExecuteBefore()
    const output = {
      parts: [{ type: "text", text: "placeholder" }],
    }

    await hook(
      {
        command: "review",
        sessionID: "s1",
        arguments: "",
      },
      output,
    )

    expect(output.parts[0]?.text).toBe("placeholder")
  })
})
