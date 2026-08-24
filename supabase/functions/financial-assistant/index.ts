import { createClient } from "npm:@supabase/supabase-js@2"
import { runFinancialAssistant } from "./orchestrator.ts"
import { GeminiFinancialAIProvider, getProviderHttpDiagnostics, ProviderConfigurationError, ProviderRateLimitError, ProviderTimeoutError } from "./provider/gemini-provider.ts"
import type { ConversationMessage } from "./types.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  const requestId = crypto.randomUUID()
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405)
    const authorization = request.headers.get("Authorization")
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication is required." }, 401)

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? ""
    if (!supabaseUrl || !publishableKey) throw new ProviderConfigurationError("Supabase function environment is incomplete.")
    const client = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
    const { data: authData, error: authError } = await client.auth.getUser(authorization.slice(7))
    if (authError || !authData.user) return json({ error: "Your session has expired. Please sign in again." }, 401)

    const body = await request.json() as Record<string, unknown>
    const question = validateQuestion(body.message)
    const history = validateHistory(body.history)
    const workflow = body.workflow === "monthly_review" ? "monthly_review" : undefined
    const { data: profile, error: profileError } = await client.from("profiles").select("base_currency,timezone").single()
    if (profileError || !profile) throw new Error("Profile context is unavailable.")
    const localDate = dateInTimeZone(profile.timezone)
    const provider = new GeminiFinancialAIProvider(Deno.env.get("GEMINI_API_KEY") ?? "", Deno.env.get("GEMINI_MODEL") ?? "")
    const result = await runFinancialAssistant({ provider, question, history, context: { client, localDate, timezone: profile.timezone, baseCurrency: profile.base_currency, workflow } })
    return json(result, 200)
  } catch (error) {
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
    if (category === "configuration") return json({ error: "AI Assistant is not configured yet. Your normal tracker features are still available.", code: category }, 503)
    if (category === "quota") return json({ error: "AI Assistant quota is temporarily unavailable. Please try again later.", code: category }, 429)
    if (category === "timeout") return json({ error: "AI Assistant took too long to respond. Please try again.", code: category }, 504)
    if (category === "invalid_request") return json({ error: error instanceof Error ? error.message : "The request is invalid.", code: category }, 400)
    return json({ error: "AI Assistant is temporarily unavailable. Your normal tracker features are still available.", code: category }, 503)
  }
})

function validateQuestion(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError("Enter a question.")
  if (value.length > 2_000) throw new TypeError("Keep the question under 2,000 characters.")
  return value.trim()
}
function validateHistory(value: unknown): ConversationMessage[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 8) throw new TypeError("Conversation context is invalid.")
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new TypeError("Conversation context is invalid.")
    const message = item as Record<string, unknown>
    if ((message.role !== "user" && message.role !== "assistant") || typeof message.text !== "string" || message.text.length > 2_000) throw new TypeError("Conversation context is invalid.")
    return { role: message.role, text: message.text }
  })
}
function dateInTimeZone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  return `${value("year")}-${value("month")}-${value("day")}`
}
function classifyError(error: unknown) {
  if (error instanceof ProviderConfigurationError) return "configuration"
  if (error instanceof ProviderRateLimitError) return "quota"
  if (error instanceof ProviderTimeoutError) return "timeout"
  if (error instanceof TypeError) return "invalid_request"
  return "provider_error"
}
function json(body: unknown, status: number) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }) }
