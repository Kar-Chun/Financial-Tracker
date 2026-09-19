/** The active SPA origin is the source of truth; never copy query/hash credentials. */
export function getConfirmationRedirectUrl(origin = window.location.origin) {
  const url = new URL(origin)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Email confirmation requires an HTTP or HTTPS app URL.")
  }
  return new URL("/login", url.origin).href
}

const authParameters = [
  "access_token", "refresh_token", "provider_token", "provider_refresh_token",
  "expires_in", "expires_at", "token_type", "type", "code", "token_hash", "token",
  "error", "error_code", "error_description",
]

export type AuthReturnKind = "implicit" | "invalid" | null

/** Capture only the kind of return before the SDK consumes its URL; retain no tokens. */
export function getAuthReturnKind(href: string): AuthReturnKind {
  const url = new URL(href)
  const parameters = [url.searchParams, new URLSearchParams(url.hash.slice(1))]
  const has = (key: string) => parameters.some((params) => params.has(key))
  if (["error", "error_code", "error_description", "token_hash", "token", "code"].some(has)) return "invalid"
  if (has("access_token") || has("refresh_token")) return "implicit"
  return null
}

/** Call only AFTER SDK initialization, so URL-session detection can finish first. */
export function clearAuthReturnParameters() {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.slice(1))
  let changed = false
  let hashChanged = false
  for (const key of authParameters) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key)
      changed = true
    }
    if (hash.has(key)) {
      hash.delete(key)
      hashChanged = true
    }
  }
  if (hashChanged) url.hash = hash.toString()
  if (changed || hashChanged) {
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)
  }
}
