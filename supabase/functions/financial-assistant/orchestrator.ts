import type { FinancialAIProvider } from "./provider/financial-ai-provider.ts"
import type { AssistantResponse, ConversationMessage, ProviderContent, SuggestedAction } from "./types.ts"
import { buildSystemPrompt } from "./prompts/system-prompt.ts"
import { createToolRegistry, toolDeclarations, type ToolContext } from "./tools/tool-registry.ts"

const MAX_TOOL_ROUNDS = 3
const MAX_TOOL_CALLS = 6
const MAX_ANSWER_LENGTH = 6_000
const MAX_ORCHESTRATION_MILLISECONDS = 45_000

export class AssistantOrchestrationTimeoutError extends Error {}

export async function runFinancialAssistant(input: {
  provider: FinancialAIProvider
  question: string
  history: ConversationMessage[]
  context: ToolContext & { timezone: string; workflow?: string }
}, timeoutMs = MAX_ORCHESTRATION_MILLISECONDS): Promise<AssistantResponse> {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      runWithSignal(input, controller.signal),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort()
          reject(new AssistantOrchestrationTimeoutError("AI orchestration timed out."))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function runWithSignal(input: {
  provider: FinancialAIProvider
  question: string
  history: ConversationMessage[]
  context: ToolContext & { timezone: string; workflow?: string }
}, signal: AbortSignal): Promise<AssistantResponse> {
  const registry = createToolRegistry()
  const usedTools: string[] = []
  const contents: ProviderContent[] = sanitizeHistory(input.history)
  contents.push({ role: "user", parts: [{ text: input.question }] })
  const systemPrompt = buildSystemPrompt({ localDate: input.context.localDate, timezone: input.context.timezone, baseCurrency: input.context.baseCurrency, workflow: input.context.workflow })

  let toolCalls = 0
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const turn = await input.provider.generate({ systemPrompt, contents, tools: toolDeclarations(registry), signal })
    contents.push(turn.content)
    if (!turn.functionCalls.length) {
      const answer = turn.text?.trim()
      if (!answer) throw new Error("AI provider returned no answer.")
      return { answer: answer.slice(0, MAX_ANSWER_LENGTH), used_tools: [...new Set(usedTools)], suggested_action: suggestedAction(usedTools) }
    }
    if (round === MAX_TOOL_ROUNDS) throw new Error("AI tool-call limit reached.")
    const responseParts: Array<Record<string, unknown>> = []
    for (const call of turn.functionCalls) {
      toolCalls += 1
      if (toolCalls > MAX_TOOL_CALLS) throw new Error("AI tool-call limit reached.")
      const registered = registry.get(call.name)
      if (!registered) throw new Error("AI requested an unknown tool.")
      const result = await registered.execute(call.args, input.context)
      if (signal.aborted) throw new AssistantOrchestrationTimeoutError("AI orchestration timed out.")
      usedTools.push(call.name)
      responseParts.push({ functionResponse: { name: call.name, response: { result }, ...(call.id ? { id: call.id } : {}) } })
    }
    contents.push({ role: "user", parts: responseParts })
  }
  throw new Error("AI response could not be completed.")
}

function sanitizeHistory(history: ConversationMessage[]): ProviderContent[] {
  return history
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-6)
    .map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.text.slice(0, 2_000) }] }))
}

function suggestedAction(usedTools: string[]): SuggestedAction | undefined {
  if (usedTools.some((tool) => tool.includes("budget"))) return { destination: "budgets", label: "View Budgets" }
  if (usedTools.some((tool) => tool.includes("goal"))) return { destination: "goals", label: "View Savings Goals" }
  if (usedTools.some((tool) => tool.includes("investment"))) return { destination: "investments", label: "View Investments" }
  if (usedTools.some((tool) => tool.includes("spending") || tool.includes("category"))) return { destination: "analytics", label: "View Analytics" }
  if (usedTools.includes("search_transactions")) return { destination: "transactions", label: "View Transactions" }
  if (usedTools.includes("get_financial_overview")) return { destination: "dashboard", label: "View Dashboard" }
  return undefined
}
