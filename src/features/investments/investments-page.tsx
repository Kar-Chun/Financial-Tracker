import { AccountsView } from "@/features/accounts/accounts-view"

export function InvestmentsPage() {
  return (
    <AccountsView
      filterType="investment"
      title="Investments"
      description="Track total account values manually without individual holdings or market-price feeds."
    />
  )
}
