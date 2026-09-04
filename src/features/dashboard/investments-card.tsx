import { ArrowRight, TrendingUp } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/currency"
import type { AccountSummaryRow } from "@/types/finance"

export function InvestmentsCard({ accounts, baseCurrency }: { accounts: AccountSummaryRow[]; baseCurrency: string }) {
  const investments = accounts.filter((account) => account.account_type === "investment")
  if (investments.length === 0) return null
  const represented = investments.filter((account) => account.included_in_net_worth).reduce((sum, account) => sum + (account.base_value_minor ?? 0), 0)
  return <section className="rounded-2xl bg-card/55 px-5 py-5 ring-1 ring-white/5"><div className="flex items-center justify-between gap-4"><div><p className="section-heading">Investments</p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{formatCurrency(represented,baseCurrency)}</p></div><span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><TrendingUp className="size-5" /></span></div><div className="mt-4 space-y-2">{investments.slice(0,2).map((account)=><div key={account.id} className="flex items-center justify-between gap-4 text-sm"><span className="min-w-0 truncate text-muted-foreground">{account.name} · {account.investment_tracking_mode === "detailed" ? "Detailed" : "Simple"}</span><span className="shrink-0 font-medium tabular-nums">{account.included_in_net_worth&&account.base_value_minor!==null?formatCurrency(account.base_value_minor,baseCurrency):formatCurrency(account.native_value_minor??0,account.currency_code)}</span></div>)}</div><Button className="mt-3 -ml-3" variant="ghost" size="sm" render={<Link to="/investments" />}>View investments <ArrowRight /></Button></section>
}
