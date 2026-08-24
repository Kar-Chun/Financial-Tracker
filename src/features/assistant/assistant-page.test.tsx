// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AssistantPage } from "@/features/assistant/assistant-page"
import { askFinancialAssistant } from "@/features/assistant/assistant-service"

const onlineState = vi.hoisted(() => ({ value: true }))
vi.mock("@/features/assistant/assistant-service", () => ({ askFinancialAssistant: vi.fn() }))
vi.mock("@/hooks/use-online-status", () => ({ useOnlineStatus: () => onlineState.value }))

describe("AssistantPage", () => {
  beforeEach(() => {
    onlineState.value = true
    vi.mocked(askFinancialAssistant).mockReset()
    vi.mocked(askFinancialAssistant).mockResolvedValue({ answer: "You spent S$5.00 on Caifan.", used_tools: ["search_transactions"], suggested_action: { destination: "transactions", label: "View Transactions" } })
  })

  it("keeps send disabled for empty input and renders plain grounded answers", async () => {
    renderPage()
    expect(screen.getByRole("button", { name: "Send question" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Ask about your finances"), { target: { value: "What did I spend on caifan?" } })
    fireEvent.click(screen.getByRole("button", { name: "Send question" }))
    await waitFor(() => expect(screen.getByText("You spent S$5.00 on Caifan.")).toBeInTheDocument())
    expect(screen.getByText("Based on: Transactions")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /View Transactions/ })).toHaveAttribute("href", "/transactions")
  })

  it("prevents duplicate submissions while a request is in flight", async () => {
    let finish: ((value: { answer: string; used_tools: string[] }) => void) | undefined
    vi.mocked(askFinancialAssistant).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    renderPage()
    fireEvent.change(screen.getByLabelText("Ask about your finances"), { target: { value: "Review my spending" } })
    fireEvent.submit(screen.getByLabelText("Ask about your finances").closest("form")!)
    fireEvent.submit(screen.getByLabelText("Ask about your finances").closest("form")!)
    expect(askFinancialAssistant).toHaveBeenCalledTimes(1)
    finish?.({ answer: "Done", used_tools: [] })
    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument())
  })

  it("clears in-memory conversation", async () => {
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: "How am I doing this month?" }))
    await screen.findByText("You spent S$5.00 on Caifan.")
    fireEvent.click(screen.getByRole("button", { name: /Clear/ }))
    expect(screen.queryByText("You spent S$5.00 on Caifan.")).not.toBeInTheDocument()
  })

  it("blocks offline prompts without queueing them", () => {
    onlineState.value = false
    renderPage()
    expect(screen.getByText("AI Assistant requires an internet connection. Prompts are not queued.")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Ask about your finances"), { target: { value: "Review my month" } })
    expect(screen.getByRole("button", { name: "Send question" })).toBeDisabled()
    expect(askFinancialAssistant).not.toHaveBeenCalled()
  })
})

function renderPage() {
  return render(<MemoryRouter><AssistantPage /></MemoryRouter>)
}
