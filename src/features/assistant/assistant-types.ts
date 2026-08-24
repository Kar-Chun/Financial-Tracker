export const assistantDestinations = {
  dashboard: "/dashboard",
  transactions: "/transactions",
  analytics: "/analytics",
  budgets: "/budgets",
  goals: "/goals",
  investments: "/investments",
  accounts: "/accounts",
} as const

export type AssistantDestination = keyof typeof assistantDestinations

export type AssistantSuggestedAction = {
  destination: AssistantDestination
  label: string
}

export type AssistantApiResponse = {
  answer: string
  used_tools: string[]
  suggested_action?: AssistantSuggestedAction
}

export type AssistantMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  usedTools?: string[]
  suggestedAction?: AssistantSuggestedAction
}

export function isAssistantResponse(value: unknown): value is AssistantApiResponse {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return typeof item.answer === "string"
    && Array.isArray(item.used_tools)
    && item.used_tools.every((tool) => typeof tool === "string")
    && (item.suggested_action === undefined || isSuggestedAction(item.suggested_action))
}

export function isSuggestedAction(value: unknown): value is AssistantSuggestedAction {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return typeof item.label === "string"
    && typeof item.destination === "string"
    && item.destination in assistantDestinations
}

