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
  if (error) throw new Error("AI Assistant is temporarily unavailable. Your normal tracker features are still available.")
  if (!isAssistantResponse(data)) throw new Error("AI Assistant returned an invalid response. Please try again.")
  return data
}

