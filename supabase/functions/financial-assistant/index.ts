import { createClient } from "npm:@supabase/supabase-js@2"
import { AssistantOrchestrationTimeoutError, runFinancialAssistant } from "./orchestrator.ts"
import { claimAiRequest, completeAiRequest } from "./rate-limit.ts"
import { AssistantRequestError, readValidatedAssistantRequest } from "./request-validation.ts"
import {
  GeminiFinancialAIProvider,
  getProviderHttpDiagnostics,
  ProviderConfigurationError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from "./provider/gemini-provider.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  const requestId = crypto.randomUUID()
  let lease: { client: ReturnType<typeof createClient>; id: string } | undefined

  try {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405)
    const authorization = request.headers.get("Authorization")
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication is required." }, 401)

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? ""
    if (!supabaseUrl || !publishableKey) throw new ProviderConfigurationError("Supabase function environment is incomplete.")

    const client = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const { data: authData, error: authError } = await client.auth.getUser(authorization.slice(7))
    if (authError || !authData.user) return json({ error: "Your session has expired. Please sign in again." }, 401)

    const body = await readValidatedAssistantRequest(request)
    const { data: profile, error: profileError } = await client.from("profiles").select("base_currency,timezone").single()
    if (profileError || !profile) throw new Error("Profile context is unavailable.")

    const model = Deno.env.get("GEMINI_MODEL") ?? ""
    const provider = new GeminiFinancialAIProvider(Deno.env.get("GEMINI_API_KEY") ?? "", model)
    const claim = await claimAiRequest(client, model)
    if (!claim.allowed) {
      const global = claim.reason === "global"
      return json(
        {
          error: global
            ? "AI usage is temporarily unavailable. Your normal finance features still work."
            : "You've made several AI requests recently. Try again later.",
          code: global ? "global_rate_limited" : "rate_limited",
        },
        429,
        { "Retry-After": String(claim.retryAfterSeconds) },
      )
    }
    lease = { client, id: claim.leaseId }

    const result = await runFinancialAssistant({
      provider,
      question: body.question,
      history: body.history,
      context: {
        client,
        localDate: dateInTimeZone(profile.timezone),
        timezone: profile.timezone,
        baseCurrency: profile.base_currency,
        workflow: body.workflow,
      },
    })
    await finishLease(lease, "succeeded", requestId)
    lease = undefined
    return json(result, 200)
  } catch (error) {
    if (lease) {
      await finishLease(lease, error instanceof ProviderTimeoutError || error instanceof AssistantOrchestrationTimeoutError ? "timeout" : "provider_error", requestId)
      lease = undefined
    }
    const category = classifyError(error)
    const provider = getProviderHttpDiagnostics(error)
    console.error(JSON.stringify({
      request_id: requestId,
      category,
      ...(provider ? {
        http_status: provider.httpStatus,
        gemini_error_status: provider.providerStatus,
        gemini_error_code: provider.providerCode,
        gemini_error_message: provider.providerMessage,
        model: provider.model,
      } : {}),
    }))
    if (category === "configuration") return json({ error: "AI Assistant is not configured yet. Your normal tracker features still work.", code: category }, 503)
    if (category === "quota") return json({ error: "AI Assistant quota is temporarily unavailable. Please try again later.", code: category }, 429)
    if (category === "timeout") return json({ error: "AI Assistant took too long to respond. Please try again.", code: category }, 504)
    if (category === "invalid_request") {
      const status = error instanceof AssistantRequestError ? error.status : 400
      return json({ error: error instanceof Error ? error.message : "The request is invalid.", code: category }, status)
    }
    return json({ error: "AI Assistant is temporarily unavailable. Your normal tracker features still work.", code: category }, 503)
  }
})

async function finishLease(
  lease: { client: ReturnType<typeof createClient>; id: string },
  status: "succeeded" | "provider_error" | "timeout",
  requestId: string,
) {
  if (!await completeAiRequest(lease.client, lease.id, status)) {
    console.error(JSON.stringify({ request_id: requestId, category: "rate_limit_completion_failed" }))
  }
}

function dateInTimeZone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  return `${value("year")}-${value("month")}-${value("day")}`
}

function classifyError(error: unknown) {
  if (error instanceof ProviderConfigurationError) return "configuration"
  if (error instanceof ProviderRateLimitError) return "quota"
  if (error instanceof ProviderTimeoutError || error instanceof AssistantOrchestrationTimeoutError) return "timeout"
  if (error instanceof AssistantRequestError || error instanceof TypeError) return "invalid_request"
  return "provider_error"
}

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json" },
  })
}
