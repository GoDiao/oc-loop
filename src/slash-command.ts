type CommandConfig = {
  template: string
  description?: string
}

type ConfigLike = {
  command?: Record<string, CommandConfig>
}

type CommandExecuteBeforeInput = {
  command: string
  sessionID: string
  arguments: string
}

type CommandExecuteBeforeOutput = {
  parts: Array<{ type: string; text?: string; [key: string]: unknown }>
}

const OC_COMMANDS: Record<string, CommandConfig> = {
  "oc-loop": {
    description: "Start OC-Loop task mode",
    template: "Execute /oc-loop with arguments:\n\n$ARGUMENTS",
  },
  "oc-watch": {
    description: "Start OC-Loop watch mode",
    template: "Execute /oc-watch with arguments:\n\n$ARGUMENTS",
  },
  "oc-pause": {
    description: "Pause active OC-Loop",
    template: "Execute /oc-pause",
  },
  "oc-resume": {
    description: "Resume paused OC-Loop",
    template: "Execute /oc-resume",
  },
  "oc-abort": {
    description: "Abort current turn and keep loop state",
    template: "Execute /oc-abort",
  },
  "oc-cancel": {
    description: "Cancel and clear OC-Loop",
    template: "Execute /oc-cancel",
  },
  "oc-list": {
    description: "List active OC-Loop runs",
    template: "Execute /oc-list",
  },
}

export function applyOcLoopSlashCommands(config: ConfigLike): void {
  config.command ??= {}
  for (const [name, info] of Object.entries(OC_COMMANDS)) {
    if (!config.command[name]) {
      config.command[name] = info
    }
  }
}

function findTextPartIndex(parts: CommandExecuteBeforeOutput["parts"]): number {
  return parts.findIndex((part) => part.type === "text")
}

function readFlagNumber(argumentsText: string, flag: string): number | undefined {
  const matcher = new RegExp(`(?:^|\\s)--${flag}=(\\d+)(?:\\s|$)`)
  const matched = argumentsText.match(matcher)
  if (!matched?.[1]) return undefined
  const value = Number(matched[1])
  return Number.isFinite(value) ? value : undefined
}

function readFlagString(argumentsText: string, flag: string): string | undefined {
  const quoted = argumentsText.match(new RegExp(`(?:^|\\s)--${flag}=\"([^\"]*)\"(?:\\s|$)`))
  if (quoted?.[1] !== undefined) return quoted[1]

  const unquoted = argumentsText.match(new RegExp(`(?:^|\\s)--${flag}=([^\\s]+)(?:\\s|$)`))
  if (unquoted?.[1] !== undefined) return unquoted[1]

  return undefined
}

function stripFlags(argumentsText: string): string {
  return argumentsText
    .replace(/(?:^|\s)--testCommand="[^"]*"(?=\s|$)/g, " ")
    .replace(/(?:^|\s)--testCommand=[^\s]+(?=\s|$)/g, " ")
    .replace(/(?:^|\s)--maxIterations=\d+(?=\s|$)/g, " ")
    .replace(/(?:^|\s)--intervalSeconds=\d+(?=\s|$)/g, " ")
    .replace(/(?:^|\s)--interval=[^\s]+(?=\s|$)/g, " ")
    .replace(/(?:^|\s)--runId=[^\s]+(?=\s|$)/g, " ")
    .replace(/(?:^|\s)--sessionId=[^\s]+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildToolPrompt(command: string, argsText: string): string | null {
  const normalized = command.toLowerCase()
  if (!["oc-loop", "oc-watch", "oc-pause", "oc-resume", "oc-abort", "oc-cancel", "oc-list"].includes(normalized)) {
    return null
  }

  let payload: Record<string, unknown> = {}

  if (normalized === "oc-loop") {
    payload = {
      task: stripFlags(argsText),
      ...(readFlagString(argsText, "testCommand") !== undefined
        ? { testCommand: readFlagString(argsText, "testCommand") }
        : {}),
      ...(readFlagNumber(argsText, "maxIterations") !== undefined
        ? { maxIterations: readFlagNumber(argsText, "maxIterations") }
        : {}),
    }
  }

  if (normalized === "oc-watch") {
    payload = {
      task: stripFlags(argsText),
      ...(readFlagString(argsText, "interval") !== undefined
        ? { interval: readFlagString(argsText, "interval") }
        : {}),
      ...(readFlagNumber(argsText, "intervalSeconds") !== undefined
        ? { intervalSeconds: readFlagNumber(argsText, "intervalSeconds") }
        : {}),
      ...(readFlagNumber(argsText, "maxIterations") !== undefined
        ? { maxIterations: readFlagNumber(argsText, "maxIterations") }
        : {}),
    }
  }

  if (["oc-pause", "oc-resume", "oc-abort", "oc-cancel"].includes(normalized)) {
    payload = {
      ...(readFlagString(argsText, "runId") !== undefined
        ? { runId: readFlagString(argsText, "runId") }
        : {}),
      ...(readFlagString(argsText, "sessionId") !== undefined
        ? { sessionId: readFlagString(argsText, "sessionId") }
        : {}),
    }
  }

  const payloadText = JSON.stringify(payload, null, 2)

  return [
    `Invoke tool \`${normalized}\` exactly once.`,
    "Do not call any other tool.",
    "Use exactly this JSON args payload:",
    payloadText,
  ].join("\n")
}

export function createOcLoopCommandExecuteBefore() {
  return async (input: CommandExecuteBeforeInput, output: CommandExecuteBeforeOutput): Promise<void> => {
    const prompt = buildToolPrompt(input.command, input.arguments || "")
    if (!prompt) return

    const idx = findTextPartIndex(output.parts)
    if (idx >= 0) {
      output.parts[idx].text = prompt
      return
    }

    output.parts.unshift({ type: "text", text: prompt })
  }
}
