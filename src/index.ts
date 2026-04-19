import type { Plugin, PluginInput, PluginModule } from "@opencode-ai/plugin"
import { createEventHandler } from "./event-handler"
import { applyOcLoopSlashCommands, createOcLoopCommandExecuteBefore } from "./slash-command"
import { createOcAbortTool } from "./tools/oc-abort"
import { ocCancelTool } from "./tools/oc-cancel"
import { ocListTool } from "./tools/oc-list"
import { ocLoopTool } from "./tools/oc-loop"
import { ocPauseTool } from "./tools/oc-pause"
import { ocResumeTool } from "./tools/oc-resume"
import { ocWatchTool } from "./tools/oc-watch"

const plugin: Plugin = async (input: PluginInput) => {
  const event = createEventHandler(input)
  const ocAbortTool = createOcAbortTool(input.client)
  const commandExecuteBefore = createOcLoopCommandExecuteBefore()

  return {
    event,
    config: async (cfg) => {
      applyOcLoopSlashCommands(cfg)
    },
    "command.execute.before": commandExecuteBefore,
    tool: {
      "oc-loop": ocLoopTool,
      "oc-watch": ocWatchTool,
      "oc-list": ocListTool,
      "oc-pause": ocPauseTool,
      "oc-resume": ocResumeTool,
      "oc-abort": ocAbortTool,
      "oc-cancel": ocCancelTool,
    },
  }
}

const mod: PluginModule = {
  id: "oc-loop",
  server: plugin,
}

export default mod
