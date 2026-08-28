import { ArrowRight, Bot, Eraser, Send, Sparkles } from "lucide-react"
import { useRef, useState } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { assistantDestinations, type AssistantMessage } from "@/features/assistant/assistant-types"
import { askFinancialAssistant } from "@/features/assistant/assistant-service"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { cn } from "@/lib/utils"

const suggestions = [
  "How am I doing this month?",
  "Why did I spend more than last month?",
  "Am I on track with my budget?",
  "How are my savings goals doing?",
  "Explain my investment portfolio.",
]

const toolLabels: Record<string, string> = {
  get_financial_overview: "Financial overview",
  get_spending_summary: "Analytics",
  get_category_spending: "Category spending",
  search_transactions: "Transactions",
  get_budget_status: "Budget",
  get_savings_goals: "Savings Goals",
  get_investment_summary: "Investments",
  get_investment_account_summary: "Investment account",
  calculate_scenario: "What-if calculator",
}

export function AssistantPage() {
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isOnline = useOnlineStatus()
  const requestInFlight = useRef(false)

  const send = async (message: string, workflow?: "monthly_review") => {
    const question = message.trim()
    if (!question || requestInFlight.current || !isOnline) {
      if (!isOnline) setError("AI Assistant requires an internet connection.")
      return
    }
    requestInFlight.current = true
    setIsSending(true)
    setError(null)
    const userMessage: AssistantMessage = { id: crypto.randomUUID(), role: "user", text: question }
    const prior = messages
    setMessages((current) => [...current, userMessage])
    setInput("")
    try {
      const response = await askFinancialAssistant({ message: question, history: prior, workflow })
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "assistant", text: response.answer,
        usedTools: response.used_tools, suggestedAction: response.suggested_action,
      }])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI Assistant is temporarily unavailable.")
    } finally {
      requestInFlight.current = false
      setIsSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Read-only insights</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">AI Financial Assistant</h1>
          </div>
          {messages.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setMessages([]); setError(null) }}>
              <Eraser aria-hidden="true" /> Clear
            </Button>
          )}
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Ask for grounded explanations of your spending, budget, goals, and tracked investments. The assistant cannot change your financial records.
        </p>
      </header>

      {!isOnline && <div role="status" className="rounded-2xl bg-amber-400/8 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-400/20">AI Assistant requires an internet connection. Prompts are not queued.</div>}

      {messages.length === 0 ? (
        <section className="overflow-hidden rounded-3xl bg-card/70 p-5 ring-1 ring-white/5 sm:p-7">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary"><Bot className="size-5" aria-hidden="true" /></div>
          <h2 className="mt-5 text-xl font-semibold">What would you like to understand?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Suggested questions use real tracker data only after you send them.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => void send(suggestion)} disabled={isSending || !isOnline} className="min-h-11 rounded-full bg-surface px-4 text-left text-sm text-secondary-foreground ring-1 ring-white/5 transition-colors hover:bg-accent disabled:opacity-50">
                {suggestion}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void send("Review my month", "monthly_review")} disabled={isSending || !isOnline} className="mt-6 flex min-h-14 w-full items-center justify-between rounded-2xl bg-primary/10 px-4 text-left text-sm font-medium text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/15 disabled:opacity-50">
            <span className="flex items-center gap-3"><Sparkles className="size-5" aria-hidden="true" />Review my month</span><ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </section>
      ) : (
        <section aria-label="Conversation" className="space-y-4">
          {messages.map((message) => <ConversationMessage key={message.id} message={message} />)}
          {isSending && <div role="status" className="flex items-center gap-3 rounded-2xl bg-card/60 px-4 py-4 text-sm text-muted-foreground"><Sparkles className="size-4 animate-pulse text-primary" />Checking the relevant tracker data…</div>}
        </section>
      )}

      {error && <div role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground ring-1 ring-destructive/25">{error}</div>}

      <form onSubmit={(event) => { event.preventDefault(); void send(input) }} className="sticky bottom-[calc(var(--mobile-navigation-height)+var(--mobile-floating-action-gap)+env(safe-area-inset-bottom))] z-10 rounded-2xl bg-popover/95 p-2 shadow-xl shadow-black/15 ring-1 ring-white/8 backdrop-blur-xl lg:bottom-4">
        <label htmlFor="assistant-question" className="sr-only">Ask about your finances</label>
        <div className="flex items-center gap-2">
          <Input id="assistant-question" value={input} onChange={(event) => setInput(event.target.value)} maxLength={2_000} disabled={isSending} placeholder="Ask about your finances" className="min-h-12 border-0 bg-transparent shadow-none focus-visible:ring-0" />
          <Button type="submit" size="icon" disabled={!input.trim() || isSending || !isOnline} aria-label="Send question" className="size-11 shrink-0 rounded-xl"><Send className="size-4" /></Button>
        </div>
      </form>

      <p className="pb-1 text-center text-xs leading-5 text-muted-foreground">Only financial information needed for your question is sent to the configured AI provider. The provider key stays server-side. Conversation history is not saved.</p>
    </div>
  )
}

function ConversationMessage({ message }: { message: AssistantMessage }) {
  const action = message.suggestedAction
  return (
    <article className={cn("max-w-[92%] rounded-2xl px-4 py-3", message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card/65 ring-1 ring-white/5")}>
      <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
      {message.role === "assistant" && message.usedTools?.length ? (
        <p className="mt-3 border-t border-border/30 pt-2 text-xs text-muted-foreground">Based on: {[...new Set(message.usedTools)].map((tool) => toolLabels[tool] ?? "Tracker data").join(" · ")}</p>
      ) : null}
      {message.role === "assistant" && action ? (
        <Link to={assistantDestinations[action.destination]} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/15">
          {action.label}<ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </article>
  )
}
