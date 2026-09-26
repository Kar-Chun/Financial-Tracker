import { AssistantOrchestrationTimeoutError } from "./orchestrator.ts"
import { AssistantRequestError } from "./request-validation.ts"
import {
  getProviderHttpDiagnostics,
  ProviderConfigurationError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from "./provider/gemini-provider.ts"

// The caller supplies a server-generated correlation ID, never a request header.
// No message, stack, body, provider string or caller context enters this boundary.
export function logAssistantError(error: unknown, requestId: string) {
  const category = classifyError(error)
  const provider = getProviderHttpDiagnostics(error)
  console.error(JSON.stringify({
    request_id: requestId,
    category,
    ...(provider ? {
      provider: "gemini",
      http_status: provider.httpStatus,
      retryable: provider.retryable,
    } : {}),
  }))
  return category
}

function classifyError(error: unknown) {
  if (error instanceof ProviderConfigurationError) return "configuration"
  if (error instanceof ProviderRateLimitError) return "quota"
  if (error instanceof ProviderTimeoutError || error instanceof AssistantOrchestrationTimeoutError) return "timeout"
  if (error instanceof AssistantRequestError || error instanceof TypeError) return "invalid_request"
  return "provider_error"
}
