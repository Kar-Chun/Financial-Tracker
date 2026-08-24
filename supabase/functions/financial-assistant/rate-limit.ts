export type RateLimitClient = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}

export type RateLimitClaim =
  | { allowed: true; leaseId: string }
  | { allowed: false; reason: "busy" | "minute" | "hour" | "day" | "global"; retryAfterSeconds: number }

export async function claimAiRequest(client: RateLimitClient, model: string): Promise<RateLimitClaim> {
  const { data, error } = await client.rpc("claim_ai_request_slot", { p_model: model })
  if (error || !data || typeof data !== "object") throw new Error("AI usage protection is unavailable.")
  const value = data as Record<string, unknown>
  if (value.allowed === true && typeof value.lease_id === "string") return { allowed: true, leaseId: value.lease_id }
  const reason = value.reason
  if (value.allowed === false && (reason === "busy" || reason === "minute" || reason === "hour" || reason === "day" || reason === "global")) {
    const retry = typeof value.retry_after_seconds === "number" && Number.isFinite(value.retry_after_seconds)
      ? Math.max(1, Math.min(Math.ceil(value.retry_after_seconds), 86_400))
      : 60
    return { allowed: false, reason, retryAfterSeconds: retry }
  }
  throw new Error("AI usage protection returned an invalid response.")
}

export async function completeAiRequest(client: RateLimitClient, leaseId: string, status: "succeeded" | "provider_error" | "timeout") {
  const { error } = await client.rpc("complete_ai_request_slot", { p_lease_id: leaseId, p_status: status })
  return !error
}

