import { afterEach, describe, expect, test } from "bun:test"
import { createWatchScheduler, nextWakeDelay } from "./watch-scheduler"

describe("nextWakeDelay", () => {
  test("returns interval seconds when state has intervalSeconds", () => {
    expect(nextWakeDelay(300)).toBe(300)
  })

  test("returns default 300 when no interval", () => {
    expect(nextWakeDelay(null)).toBe(300)
  })
})

describe("createWatchScheduler", () => {
  const scheduler = createWatchScheduler()

  afterEach(() => {
    scheduler.cancelAll()
  })

  test("schedules and runs tick callback", async () => {
    let ran = false

    scheduler.schedule("s1", 0, () => {
      ran = true
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(ran).toBe(true)
    expect(scheduler.has("s1")).toBe(false)
  })

  test("re-scheduling same session replaces previous timer", async () => {
    let count = 0

    scheduler.schedule("s2", 1, () => {
      count += 1
    })

    scheduler.schedule("s2", 0, () => {
      count += 1
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(count).toBe(1)
  })

  test("cancel prevents callback", async () => {
    let ran = false

    scheduler.schedule("s3", 0, () => {
      ran = true
    })
    scheduler.cancel("s3")

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(ran).toBe(false)
    expect(scheduler.has("s3")).toBe(false)
  })
})
