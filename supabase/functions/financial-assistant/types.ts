export type ConversationMessage = {
  role: "user" | "assistant"
  text: string
}

export type SuggestedAction = {
  destination: "dashboard" | "transactions" | "analytics" | "budgets" | "goals" | "investments" | "accounts"
  label: string
}

export type AssistantResponse = {
  answer: string
  used_tools: string[]
  suggested_action?: SuggestedAction
}

export type FunctionCall = {
  name: string
  args: unknown
  id?: string
}

export type ProviderContent = {
  role: "user" | "model"
  parts: Array<Record<string, unknown>>
}

export type ProviderTurn = {
  text?: string
  functionCalls: FunctionCall[]
  content: ProviderContent
}

export type ToolDeclaration = {
  name: string
  description: string
  parameters: Record<string, unknown>
}

