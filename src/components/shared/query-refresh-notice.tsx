import { Button } from "@/components/ui/button"
import { isBlockingReadError, type ReadQueryState } from "@/lib/query-policy"

export function QueryRefreshNotice({ queries }: { queries: ReadQueryState[] }) {
  const failed = queries.filter((query) => query.isError && query.data !== undefined && !isBlockingReadError(query))
  if (failed.length === 0) return null
  const refreshing = failed.some((query) => query.isFetching)
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
      <span>Couldn't refresh. Showing the latest loaded data.</span>
      <Button size="sm" variant="ghost" disabled={refreshing} onClick={() => { failed.forEach((query) => { void query.refetch() }) }}>
        {refreshing ? "Refreshing…" : "Try again"}
      </Button>
    </div>
  )
}
