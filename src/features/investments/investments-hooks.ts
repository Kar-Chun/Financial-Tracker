import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  enableDetailedTracking, getDetailedInvestmentAccount, getInvestmentPortfolio, previewDetailedConversion,
  recordCashEvent, recordTrade, saveHolding, saveManualFx, updatePrices,
} from "@/features/investments/investments-service"

export const investmentsKey = ["investments"] as const

function useInvestmentInvalidation() {
  const client = useQueryClient()
  return async () => Promise.all([
    client.invalidateQueries({ queryKey: investmentsKey }),
    client.invalidateQueries({ queryKey: ["accounts"] }),
    client.invalidateQueries({ queryKey: ["dashboard"] }),
  ])
}

export function useInvestmentPortfolio() {
  return useQuery({ queryKey: investmentsKey, queryFn: getInvestmentPortfolio })
}

export function useDetailedInvestment(accountId: string | undefined) {
  return useQuery({
    queryKey: [...investmentsKey, "account", accountId],
    queryFn: () => getDetailedInvestmentAccount(accountId!),
    enabled: Boolean(accountId),
  })
}

export function usePreviewDetailedConversion() {
  return useMutation({ mutationFn: previewDetailedConversion })
}

export function useEnableDetailedTracking() {
  return useMutation({ mutationFn: enableDetailedTracking, onSuccess: useInvestmentInvalidation() })
}

export function useSaveHolding() {
  return useMutation({ mutationFn: saveHolding, onSuccess: useInvestmentInvalidation() })
}

export function useRecordTrade() {
  return useMutation({ mutationFn: recordTrade, onSuccess: useInvestmentInvalidation() })
}

export function useUpdatePrices() {
  return useMutation({ mutationFn: updatePrices, onSuccess: useInvestmentInvalidation() })
}

export function useSaveManualFx() {
  return useMutation({ mutationFn: saveManualFx, onSuccess: useInvestmentInvalidation() })
}

export function useRecordCashEvent() {
  return useMutation({ mutationFn: recordCashEvent, onSuccess: useInvestmentInvalidation() })
}
