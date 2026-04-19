import { describe, expect, test } from "bun:test"
import { readState } from "../storage"
import { ocLoopTool } from "./oc-loop"

describe("oc-loop tool", () => {
  test("initializes state with non-empty plan checklist", async () => {
    const dir = `${process.cwd()}/.tmp-oc-loop-tool-${Date.now()}`
    await Bun.$`mkdir -p ${dir}`

    try {
      const result = await ocLoopTool.execute(
        { task: "Implement auth" },
        { directory: dir, sessionID: "s1" } as any,
      )

      expect(typeof result).toBe("string")
      const state = readState(dir)
      expect(state).not.toBeNull()
      expect(state?.planChecklist).not.toBeNull()
      expect((state?.planChecklist ?? []).length).toBeGreaterThan(0)
      expect((state?.planChecklist ?? [])[0]?.done).toBe(false)
    } finally {
      await Bun.$`rm -rf ${dir}`
    }
  })
})
