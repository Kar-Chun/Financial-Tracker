import { buttonVariants } from "@/components/ui/button-variants"
import { PageTitle, SectionHeader } from "@/components/shared/finance-ui"

import { ArrowRight, Landmark, Plus, RefreshCw, SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"

import { AccountFormDialog } from "@/features/accounts/account-form-dialog"
import { ValuationDialog } from "@/features/accounts/valuation-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AccountLifecycleActions } from "@/features/accounts/account-lifecycle-actions"
import { useInvestmentPortfolio } from "@/features/investments/investments-hooks"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { AccountSummaryRow } from "@/types/finance"

export function InvestmentsPage() {
  const portfolio = useInvestmentPortfolio()
  const [accountFormOpen, setAccountFormOpen] = useState(false)
  const [valuationAccount, setValuationAccount] = useState<AccountSummaryRow | null>(null)

  if (portfolio.isLoading) return <InvestmentSkeleton />
  if (portfolio.isError || !portfolio.data) return <ErrorState onRetry={() => portfolio.refetch()} />

  const { accounts, currency_code: baseCurrency, portfolio_value_base_minor: total, unrealized_gain_base_minor: unrealizedBase, excluded_account_count: excluded } = portfolio.data
  const detailed = accounts.filter((account) => account.investment_tracking_mode === "detailed")

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <PageTitle title="Investments" />
      <Button onClick={() => setAccountFormOpen(true)}><Plus /> Add account</Button>
    </header>
    <section className="min-w-0 border-b border-border/30 pb-5">
      <p className="section-heading">Represented portfolio value</p>
      <p className="value-hero">{formatCurrency(total, baseCurrency)}</p>
      {detailed.length > 0 && <p className={cn("mt-2 text-sm", unrealizedBase >= 0 ? "text-positive" : "text-destructive")}>{formatSignedCurrency(unrealizedBase, baseCurrency)} unrealised in convertible Detailed accounts</p>}
      {excluded > 0 && <p className="mt-3 text-xs leading-5 text-amber-200">{excluded} foreign account {excluded === 1 ? "is" : "are"} excluded until a direct manual FX rate and all holding prices are available.</p>}
    </section>
    {accounts.length === 0 ? <Card className="border-0 bg-card/55"><CardContent className="flex min-h-48 flex-col items-center justify-center text-center"><Landmark className="size-9 text-primary" /><h2 className="mt-4 text-lg font-semibold">No investment accounts yet</h2><p className="mt-2 max-w-sm text-sm text-muted-foreground">Create an account, then choose simple manual valuation or detailed holdings tracking.</p><Button className="mt-5" onClick={() => setAccountFormOpen(true)}><Plus /> Add investment account</Button></CardContent></Card> : <section>
      <SectionHeader id="investment-accounts" title="Accounts" />
      <div className="border-y border-border/30">{accounts.map((account, index) => <InvestmentAccountRow key={account.id} account={account} baseCurrency={baseCurrency} bordered={index > 0} onValue={() => setValuationAccount(account)} />)}</div>
    </section>}
    <section className="border-t border-border/30 pt-4 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Two clear sources of truth.</strong> Simple accounts use manual total valuations plus qualifying later transfers. Detailed accounts use broker cash plus holdings at their latest manual prices. The formulas are never combined.</section>
    <AccountFormDialog open={accountFormOpen} onOpenChange={setAccountFormOpen} initialType="investment" />
    <ValuationDialog account={valuationAccount} open={Boolean(valuationAccount)} onOpenChange={(open) => !open && setValuationAccount(null)} />
  </div>
}

function InvestmentAccountRow({ account, baseCurrency, bordered, onValue }: { account: AccountSummaryRow; baseCurrency: string; bordered: boolean; onValue: () => void }) {
  const detailed = account.investment_tracking_mode === "detailed"
  const native = detailed && account.native_value_minor === null
    ? "Price needed"
    : formatCurrency(account.native_value_minor ?? 0, account.currency_code)
  const base = account.included_in_net_worth && account.base_value_minor !== null ? formatCurrency(account.base_value_minor, baseCurrency) : null
  return <article className={cn("py-4", bordered && "border-t border-border/25")}><div className="flex min-w-0 items-start justify-between gap-4"><div className="min-w-0"><h3 className="break-words font-semibold">{account.name}</h3><p className="mt-1 text-xs text-muted-foreground">{account.institution ?? "Investment"} · {account.currency_code} · {detailed ? "Detailed" : "Simple"}</p></div><div className="min-w-0 max-w-[45%] break-words text-right [overflow-wrap:anywhere]"><p className="font-semibold tabular-nums">{native}</p>{base && account.currency_code !== baseCurrency && <p className="mt-1 text-xs text-muted-foreground">{base} base</p>}</div></div>
    {detailed ? <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground"><p>Broker cash<br /><strong className="text-foreground">{formatCurrency(account.broker_cash_minor ?? 0, account.currency_code)}</strong></p><p>Holdings<br /><strong className="text-foreground">{formatCurrency(account.holdings_value_minor ?? 0, account.currency_code)}</strong></p></div> : <p className="mt-3 text-xs leading-5 text-muted-foreground">Manual account-level valuation. Existing transfer-after-valuation accounting remains active.</p>}
    <div className="mt-4 flex flex-wrap gap-2">{detailed ? <Link to={`/investments/${account.id}`} data-slot="button" className={buttonVariants({ size: "sm" })}><SlidersHorizontal /> View portfolio</Link> : <><Button size="sm" onClick={onValue}><RefreshCw /> Update valuation</Button><Link to={`/investments/${account.id}/setup`} data-slot="button" className={buttonVariants({ size: "sm", variant: "outline" })}>Enable detailed <ArrowRight /></Link></>}<AccountLifecycleActions account={account} baseCurrency={baseCurrency} /></div>
    {detailed && !account.base_value_available && <p className="mt-3 text-xs text-amber-200">Base-currency value unavailable. Add missing prices or a direct {account.currency_code} → {baseCurrency} rate.</p>}</article>
}

function InvestmentSkeleton() { return <div className="space-y-5"><Skeleton className="h-12 w-52" /><Skeleton className="h-48 rounded-3xl" /><Skeleton className="h-72 rounded-2xl" /></div> }
function ErrorState({ onRetry }: { onRetry: () => void }) { return <Card className="border-destructive/30"><CardContent className="py-6 text-center"><h1 className="font-semibold">Investments could not be loaded.</h1><p className="mt-2 text-sm text-muted-foreground">Check your connection and V2 migrations.</p><Button className="mt-4" variant="outline" onClick={onRetry}>Try again</Button></CardContent></Card> }
