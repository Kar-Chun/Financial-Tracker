// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DataExportSettings } from "./data-export-settings"

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), download: vi.fn(), canShare: vi.fn(), user: { id: "owner" } }))
vi.mock("@/features/auth/auth-context", () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock("./export-service", () => ({ prepareDataExport: mocks.prepare }))
vi.mock("./export-file", () => ({ downloadExport: mocks.download, canShareExport: mocks.canShare }))
const file = new File(["zip"], "ledgerly-export-2026-09-23.zip", { type: "application/zip" })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.user = { id: "owner" }
  mocks.prepare.mockResolvedValue(file)
  mocks.canShare.mockReturnValue(false)
})

describe("Data & Privacy settings", () => {
  it("warns before export, prevents concurrent clicks and downloads on desktop", async () => {
    let finish!: (file: File) => void
    mocks.prepare.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    render(<DataExportSettings />)
    expect(screen.getByText("This export contains personal financial information. Store it securely.")).toBeInTheDocument()
    expect(mocks.prepare).not.toHaveBeenCalled()
    const button = screen.getByRole("button", { name: "Export Ledgerly data" })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(button).toBeDisabled()
    expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith("owner")
    await act(async () => finish(file))
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith(file)
    expect(screen.getByRole("status")).toHaveTextContent("Export ready.")
  })

  it("requires a fresh tap to share a prepared file and offers a download fallback", async () => {
    mocks.canShare.mockReturnValue(true)
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "share", { configurable: true, value: share })
    render(<DataExportSettings />)
    fireEvent.click(screen.getByRole("button", { name: "Export Ledgerly data" }))
    const shareButton = await screen.findByRole("button", { name: "Share / Save to Files" })
    expect(share).not.toHaveBeenCalled()
    expect(mocks.download).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Download ZIP" })).toBeInTheDocument()
    fireEvent.click(shareButton)
    expect(share).toHaveBeenCalledWith({ files: [file], title: "Ledgerly export" })
    await waitFor(() => expect(screen.queryByRole("button", { name: "Share / Save to Files" })).not.toBeInTheDocument())
  })

  it("shows a restrained failure without exposing server details", async () => {
    mocks.prepare.mockRejectedValue(new Error("private SQL and auth-token details"))
    render(<DataExportSettings />)
    fireEvent.click(screen.getByRole("button", { name: "Export Ledgerly data" }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Could not prepare your export. Try again."))
    expect(screen.queryByText(/private SQL/)).not.toBeInTheDocument()
    expect(mocks.download).not.toHaveBeenCalled()
  })

  it("discards a pending export on account switch", async () => {
    let finish!: (file: File) => void
    mocks.prepare.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const view = render(<DataExportSettings />)
    fireEvent.click(screen.getByRole("button", { name: "Export Ledgerly data" }))
    mocks.user = { id: "other" }
    view.rerender(<DataExportSettings />)
    await act(async () => finish(file))
    expect(mocks.download).not.toHaveBeenCalled()
    expect(screen.queryByText("Export ready.")).not.toBeInTheDocument()
  })

  it("keeps a canceled share available and safely falls back after a sharing error", async () => {
    mocks.canShare.mockReturnValue(true)
    const share = vi.fn().mockRejectedValueOnce(new DOMException("Canceled", "AbortError"))
      .mockRejectedValueOnce(new Error("private platform detail"))
    Object.defineProperty(navigator, "share", { configurable: true, value: share })
    render(<DataExportSettings />)
    fireEvent.click(screen.getByRole("button", { name: "Export Ledgerly data" }))
    fireEvent.click(await screen.findByRole("button", { name: "Share / Save to Files" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Share / Save to Files" })).toBeEnabled())
    expect(mocks.download).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Share / Save to Files" }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sharing is unavailable. Use Download ZIP"))
    fireEvent.click(screen.getByRole("button", { name: "Download ZIP" }))
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith(file)
    expect(screen.queryByText("private platform detail")).not.toBeInTheDocument()
  })
})
