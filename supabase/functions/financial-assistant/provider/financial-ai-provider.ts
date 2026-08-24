import type { ProviderContent, ProviderTurn, ToolDeclaration } from "../types.ts"

export type ProviderRequest = {
  systemPrompt: string
  contents: ProviderContent[]
  tools: ToolDeclaration[]
  signal?: AbortSignal
}

export interface FinancialAIProvider {
  generate(request: ProviderRequest): Promise<ProviderTurn>
}
