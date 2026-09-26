import { readErrorCategory } from "@/lib/query-policy"

const queryNames = new Set(["dashboard", "profile", "accounts", "transactions", "categories", "analytics", "budgets", "goals", "investments", "notification-preference"])
const routeNames = new Set(["dashboard", "accounts", "transactions", "analytics", "budgets", "goals", "investments", "settings", "assistant", "login", "signup"])

export function safeRouteName(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  const root = segments[0]
  if (!root) return "/"
  if (!routeNames.has(root)) return "other"
  if (root === "investments" && segments.length > 1) {
    if (segments[2] === "holdings") return "/investments/:accountId/holdings/:holdingId"
    return segments[2] === "setup" ? "/investments/:accountId/setup" : "/investments/:accountId"
  }
  if (root === "goals" && segments.length > 1) return segments[1] === "new" ? "/goals/new" : "/goals/:goalId"
  if (root === "transactions" && segments[1] === "new") return "/transactions/new"
  return `/${root}`
}

export function reportReadFailure(error: unknown, queryKey: readonly unknown[]) {
  if (!import.meta.env.DEV) return
  const root = queryKey[0]
  console.warn("Ledgerly read failed", {
    query: typeof root === "string" && queryNames.has(root) ? root : "other",
    route: typeof window === "undefined" ? "unknown" : safeRouteName(window.location.pathname),
    category: readErrorCategory(error),
    online: typeof navigator === "undefined" ? null : navigator.onLine,
  })
}

export function reportRouteFailure(error: unknown, pathname: string) {
  if (!import.meta.env.DEV) return
  // Classify only; never print the error, stack, URL parameters, or route IDs.
  const message = error instanceof Error ? error.message : ""
  console.warn("Ledgerly route failed", {
    route: safeRouteName(pathname),
    category: /dynamically imported module|Loading chunk|Importing a module script/i.test(message) ? "chunk-load" : "render-or-route",
    online: typeof navigator === "undefined" ? null : navigator.onLine,
  })
}
