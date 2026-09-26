import { UnexpectedRpcResponseError } from "@/lib/rpc-validation"

export function readErrorCategory(error: unknown) {
  if (error instanceof UnexpectedRpcResponseError) return "validation"
  if (!error || typeof error !== "object") return "unknown"
  const code = "code" in error ? error.code : undefined
  const status = "status" in error ? error.status : undefined
  if (status === 401 || status === 403 || ["42501", "PGRST301", "PGRST302", "PGRST303"].includes(String(code))) return "auth"
  // Check structured errors before transport messages: never retry SQL validation,
  // missing migrations, permissions, or other known permanent server failures.
  if (["PGRST003", "08000", "08003", "08006", "53300", "57P01"].includes(String(code))) return "transient"
  if (code) return "server"
  if ([408, 429, 502, 503, 504].includes(Number(status))) return "transient"
  if (typeof status === "number" && status >= 400) return "server"
  const message = "message" in error && typeof error.message === "string" ? error.message : ""
  // PostgREST wraps fetch failures in plain objects with an empty code.
  if (/^(?:TypeError: )?(?:Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?|fetch failed)$/i.test(message)) return "transient"
  return "unknown"
}

export function retryRead(failureCount: number, error: unknown) {
  return failureCount < 1 && readErrorCategory(error) === "transient"
}

export type ReadQueryState = {
  data: unknown
  isError: boolean
  error: unknown
  isFetching: boolean
  refetch: () => unknown
}

export function isBlockingReadError(query: Pick<ReadQueryState, "data" | "isError" | "error">) {
  return query.isError && (query.data === undefined || readErrorCategory(query.error) !== "transient")
}
