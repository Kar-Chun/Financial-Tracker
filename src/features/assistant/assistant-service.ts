import type { AssistantApiResponse, AssistantMessage } from "@/features/assistant/assistant-types"
import { isAssistantResponse } from "@/features/assistant/assistant-types"
import { getSupabaseClient } from "@/lib/supabase"

export async function askFinancialAssistant(input: {
  message: string
  history: AssistantMessage[]
  workflow?: "monthly_review"
}): Promise<AssistantApiResponse> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("AI Assistant requires an internet connection.")
  }
  const history = input.history.slice(-6).map(({ role, text }) => ({ role, text: text.slice(0, 2_000) }))
  const { data, error } = await getSupabaseClient().functions.invoke("financial-assistant", {
    body: { message: input.message, history, workflow: input.workflow },
  })
  if (error) {
    throw new Error(await assistantErrorMessage(error))
  }
  if (!isAssistantResponse(data)) throw new Error("AI Assistant returned an invalid response. Please try again.")
  return data
}

export async function assistantErrorMessage(error: unknown) {
  const response = getErrorResponse(error)
  if (response?.status === 429) {
    const payload = await readErrorPayload(response)
    if (payload?.code === "global_rate_limited") {
      return "AI usage is temporarily unavailable. Your normal finance features still work."
    }
    return "You've made several AI requests recently. Try again later."
  }
  return "AI Assistant is temporarily unavailable. Your normal tracker features are still available."
}

function getErrorResponse(error: unknown) {
  if (!error || typeof error !== "object" || !("context" in error)) return undefined
  const context = (error as { context?: unknown }).context
  return context instanceof Response ? context : undefined
}

async function readErrorPayload(response: Response) {
  try {
    const value = await response.clone().json() as unknown
    return value && typeof value === "object" ? value as { code?: unknown } : undefined
  } catch {
    return undefined
  }
}
