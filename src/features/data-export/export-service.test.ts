// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeExportFixture } from "@/test/fixtures/export-v1"
import { prepareDataExport } from "./export-service"

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn(), createZip: vi.fn() }))
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc, auth: { getSession: mocks.getSession } }) }))
vi.mock("./export-package", () => ({ createExportZip: mocks.createZip }))
const owner = "00000000-0000-4000-8000-000000000001"

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  mocks.rpc.mockResolvedValue({ data: makeExportFixture(), error: null })
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: owner } } }, error: null })
  mocks.createZip.mockResolvedValue(new File(["zip"], "backup.zip"))
})

describe("authenticated export service", () => {
  it("uses one dedicated RPC without a user argument and only a revalidated device preference", async () => {
    const fixture = makeExportFixture()
    localStorage.setItem(`finance-tracker:last-expense-account:${owner}`, fixture.data.accounts[0].id)
    localStorage.setItem("unrelated-auth-token", "never export")
    await prepareDataExport(owner)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("export_user_data_v1")
    expect(mocks.createZip).toHaveBeenCalledExactlyOnceWith(fixture, fixture.data.accounts[0].id)
  })

  it.each(["unknown-account", "00000000-0000-4000-8000-000000000003"])("excludes stale or archived device preference %s", async (id) => {
    localStorage.setItem(`finance-tracker:last-expense-account:${owner}`, id)
    await prepareDataExport(owner)
    expect(mocks.createZip).toHaveBeenCalledWith(makeExportFixture(), null)
  })

  it("rejects unauthenticated access before reading financial data", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    await expect(prepareDataExport(owner)).rejects.toThrow()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("refuses an export from a different owner", async () => {
    const fixture = makeExportFixture()
    fixture.data.accounts[0].user_id = "00000000-0000-4000-8000-000000000099"
    mocks.rpc.mockResolvedValue({ data: fixture, error: null })
    await expect(prepareDataExport(owner)).rejects.toThrow("owner mismatch")
    expect(mocks.createZip).not.toHaveBeenCalled()
  })

  it("rejects completion after sign-out or an account switch", async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: { user: { id: owner } } }, error: null })
      .mockResolvedValueOnce({ data: { session: null }, error: null })
    await expect(prepareDataExport(owner)).rejects.toThrow("session changed")
  })

  it("fails safely on a database error and allows a later fresh attempt", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "private infrastructure detail" } })
    await expect(prepareDataExport(owner)).rejects.toThrow("Export could not be prepared.")
    expect(mocks.createZip).not.toHaveBeenCalled()
    await expect(prepareDataExport(owner)).resolves.toBeInstanceOf(File)
  })

  it("does not call the server while offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
    await expect(prepareDataExport(owner)).rejects.toThrow()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("prevents duplicate concurrent exports", async () => {
    let finish!: (value: { data: ReturnType<typeof makeExportFixture>; error: null }) => void
    mocks.rpc.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const first = prepareDataExport(owner)
    await expect(prepareDataExport(owner)).rejects.toThrow("already")
    finish({ data: makeExportFixture(), error: null })
    await first
    expect(mocks.rpc).toHaveBeenCalledOnce()
  })
})
