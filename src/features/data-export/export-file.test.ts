// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { canShareExport, downloadExport } from "./export-file"

const file = new File(["zip"], "ledgerly-export-2026-09-23.zip", { type: "application/zip" })
beforeEach(() => vi.restoreAllMocks())

describe("export save capabilities", () => {
  it("downloads with the exact filename and releases the object URL", () => {
    vi.useFakeTimers()
    const create = vi.fn().mockReturnValue("blob:local-export")
    const revoke = vi.fn()
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke })
    let downloaded = ""
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloaded = this.download })
    downloadExport(file)
    expect(create).toHaveBeenCalledWith(file)
    expect(downloaded).toBe(file.name)
    expect(document.querySelector("a[download]")).toBeNull()
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith("blob:local-export")
    vi.useRealTimers()
  })

  it("feature-detects sharing on touch or standalone devices and downloads on desktop", () => {
    const canShare = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, "canShare", { configurable: true, value: canShare })
    Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn() })
    const matchMedia = vi.fn().mockReturnValue({ matches: false })
    Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia })
    expect(canShareExport(file)).toBe(false)
    matchMedia.mockReturnValue({ matches: true })
    expect(canShareExport(file)).toBe(true)
    expect(canShare).toHaveBeenCalledWith({ files: [file] })
    canShare.mockReturnValue(false)
    expect(canShareExport(file)).toBe(false)
    canShare.mockImplementation(() => { throw new Error("Not supported") })
    expect(canShareExport(file)).toBe(false)
  })
})
