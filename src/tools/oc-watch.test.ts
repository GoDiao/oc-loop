import { describe, expect, test } from "bun:test"
import { readState } from "../storage"
import { ocWatchTool } from "./oc-watch"

describe("oc-watch tool", () => {
  test("parses interval string with unit", async () => {
    const dir = `${process.cwd()}/.tmp-oc-watch-tool-${Date.now()}`
    await Bun.$`mkdir -p ${dir}`

    try {
      const result = await ocWatchTool.execute(
        { task: "Watch deploy", interval: "30s" } as any,
        { directory: dir, sessionID: "s1" } as any,
      )

      expect(typeof result).toBe("string")
      const state = readState(dir)
      expect(state).not.toBeNull()
      expect(state?.intervalSeconds).toBe(30)
    } finally {
      await Bun.$`rm -rf ${dir}`
    }
  })
})
