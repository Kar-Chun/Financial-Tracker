import { useMutation, type UseMutationOptions } from "@tanstack/react-query"

// Run the service's performFinancialMutation guard immediately, even offline.
// Never leave a financial write paused for reconnect or automatically retry it.
export function useFinancialMutation<TData, TVariables = void, TContext = unknown>(
  options: Omit<UseMutationOptions<TData, Error, TVariables, TContext>, "networkMode" | "retry" | "scope">,
) {
  return useMutation({ ...options, networkMode: "always", retry: false })
}
