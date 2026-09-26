import { QueryCache, QueryClient } from "@tanstack/react-query"

import { reportReadFailure } from "@/lib/query-diagnostics"
import { retryRead } from "@/lib/query-policy"

export function createAppQueryClient() {
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => reportReadFailure(error, query.queryKey) }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: retryRead,
        retryDelay: 1_000,
      },
      mutations: { retry: false },
    },
  })
  // Stable reference data; financial reads keep their short freshness windows.
  client.setQueryDefaults(["profile"], { staleTime: 5 * 60_000 })
  client.setQueryDefaults(["accounts", "archived"], { staleTime: 5 * 60_000 })
  return client
}
