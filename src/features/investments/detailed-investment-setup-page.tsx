import { ArrowLeft, LoaderCircle, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccounts } from "@/features/accounts/accounts-hooks"
import { useProfile } from "@/features/auth/profile-service"
import { parseExactDecimal } from "@/features/investments/investment-logic"
import { useEnableDetailedTracking, usePreviewDetailedConversion } from "@/features/investments/investments-hooks"
import type { OpeningHoldingInput } from "@/features/investments/investment-types"
import { formatCurrency, parseCurrencyToMinor } from "@/lib/currency"
import { getDateInputInTimeZone } from "@/lib/dates"
import { getErrorMessage } from "@/lib/errors"

const emptyHolding = (): OpeningHoldingInput => ({ symbol: "", name: "", asset_type: "etf", quantity: "", average_cost: "", current_price: "" })

export function DetailedInvestmentSetupPage() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const accounts = useAccounts()
  const profile = useProfile()
  const preview = usePreviewDetailedConversion()
  const enable = useEnableDetailedTracking()
  const account = accounts.data?.find((item) => item.id === accountId)
  const today = getDateInputInTimeZone(profile.data?.timezone ?? "Asia/Singapore")
  const [startedOn, setStartedOn] = useState("")
  const [cashInput, setCashInput] = useState("0.00")
  const [holdings, setHoldings] = useState<OpeningHoldingInput[]>([emptyHolding()])
  const [error, setError] = useState<string | null>(null)
  const [confirmedPreview, setConfirmedPreview] = useState<Awaited<ReturnType<typeof preview.mutateAsync>> | null>(null)

  const validHoldings = useMemo(() => holdings.filter((holding) => Object.values(holding).some(Boolean)), [holdings])
  if (accounts.isLoading || profile.isLoading) return <Skeleton className="mx-auto h-[38rem] max-w-2xl rounded-3xl" />
  if (!accountId || !account || account.account_type !== "investment") return <Navigate to="/investments" replace />
  if (account.investment_tracking_mode === "detailed") return <Navigate to={`/investments/${account.id}`} replace />

  const buildInput = () => {
    const openingCashMinor = parseCurrencyToMinor(cashInput, account.currency_code)
    if (openingCashMinor < 0) throw new Error("Opening broker cash cannot be negative.")
    const selectedStart = startedOn || today
    if (selectedStart > today) throw new Error("Choose a valid start date no later than today.")
    for (const holding of validHoldings) {
      if (!holding.symbol.trim() || !holding.name.trim()) throw new Error("Every holding needs a symbol and name.")
      if (!parseExactDecimal(holding.quantity) || !parseExactDecimal(holding.average_cost) || !parseExactDecimal(holding.current_price)) throw new Error("Enter valid holding quantity, cost, and price values.")
      const values = [Number(holding.quantity), Number(holding.average_cost), Number(holding.current_price)]
      if (values.some((value) => !Number.isFinite(value)) || values[0] <= 0 || values[1] < 0 || values[2] <= 0) throw new Error("Holding quantity and current price must be positive and within a supported range.")
    }
    return { accountId: account.id, openingCashMinor, holdings: validHoldings, startedOn: selectedStart }
  }

  const runPreview = async () => {
    try { setError(null); setConfirmedPreview(await preview.mutateAsync(buildInput())) }
    catch (cause) { setError(getErrorMessage(cause, "The opening state could not be previewed.")) }
  }
  const confirm = () => {
    let input: ReturnType<typeof buildInput>
    try { input = buildInput() } catch (cause) { setError(getErrorMessage(cause, "Check the opening state.")); return }
    enable.mutate(input, { onSuccess: () => { toast.success("Detailed investment tracking enabled."); navigate(`/investments/${account.id}`, { replace: true }) }, onError: (cause) => setError(getErrorMessage(cause, "Detailed tracking could not be enabled.")) })
  }

  return <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-card/45 ring-1 ring-white/5">
    <header className="flex min-h-18 items-center gap-3 border-b border-border/25 px-4"><Button variant="ghost" size="icon" aria-label="Back to investments" render={<Link to="/investments" />}><ArrowLeft /></Button><div><p className="eyebrow">One-way setup</p><h1 className="text-lg font-semibold">Enable detailed tracking</h1></div></header>
    <div className="space-y-6 px-5 py-6 sm:px-8">
      <div className="rounded-2xl bg-primary/8 px-4 py-3 text-xs leading-5 text-muted-foreground">Enter the portfolio exactly as it exists at the boundary. Earlier transfers and valuations are already represented by this opening state and will not be counted again.</div>
      <Field label="Tracking start date"><Input data-mobile-date className="h-12 w-full min-w-0 text-base md:text-sm" type="date" max={today} value={startedOn || today} onChange={(event) => { setStartedOn(event.target.value); setConfirmedPreview(null) }} /></Field>
      <Field label={`Opening broker cash (${account.currency_code})`}><Input className="h-12 text-base md:text-sm" inputMode="decimal" value={cashInput} onChange={(event) => { setCashInput(event.target.value); setConfirmedPreview(null) }} /></Field>
      <div className="space-y-3"><div className="flex items-center justify-between"><h2 className="section-heading">Opening holdings</h2><Button size="sm" variant="outline" onClick={() => setHoldings((items) => [...items, emptyHolding()])}><Plus /> Holding</Button></div>
        {holdings.map((holding, index) => <div key={index} className="space-y-3 rounded-2xl bg-secondary/45 p-4"><div className="grid grid-cols-[1fr_auto] gap-3"><Input aria-label={`Holding ${index + 1} symbol`} placeholder="Symbol (CSPX)" value={holding.symbol} onChange={(event) => updateHolding(setHoldings, index, "symbol", event.target.value, setConfirmedPreview)} /><Button variant="ghost" size="icon" aria-label={`Remove holding ${index + 1}`} disabled={holdings.length === 1} onClick={() => { setHoldings((items) => items.filter((_, itemIndex) => itemIndex !== index)); setConfirmedPreview(null) }}><Trash2 /></Button></div><Input aria-label={`Holding ${index + 1} name`} placeholder="Name" value={holding.name} onChange={(event) => updateHolding(setHoldings, index, "name", event.target.value, setConfirmedPreview)} />
          <Select value={holding.asset_type} onValueChange={(value) => updateHolding(setHoldings, index, "asset_type", value as OpeningHoldingInput["asset_type"], setConfirmedPreview)} items={[{value:"stock",label:"Stock"},{value:"etf",label:"ETF"},{value:"fund",label:"Fund"},{value:"other",label:"Other"}]}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["stock","etf","fund","other"].map((value) => <SelectItem key={value} value={value}>{value === "etf" ? "ETF" : value[0].toUpperCase()+value.slice(1)}</SelectItem>)}</SelectContent></Select>
          <div className="grid gap-3 sm:grid-cols-3"><Input aria-label={`Holding ${index + 1} quantity`} inputMode="decimal" placeholder="Quantity" value={holding.quantity} onChange={(event) => updateHolding(setHoldings, index, "quantity", event.target.value, setConfirmedPreview)} /><Input aria-label={`Holding ${index + 1} average cost`} inputMode="decimal" placeholder="Average cost" value={holding.average_cost} onChange={(event) => updateHolding(setHoldings, index, "average_cost", event.target.value, setConfirmedPreview)} /><Input aria-label={`Holding ${index + 1} current price`} inputMode="decimal" placeholder="Current price" value={holding.current_price} onChange={(event) => updateHolding(setHoldings, index, "current_price", event.target.value, setConfirmedPreview)} /></div></div>)}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {confirmedPreview && <div className="rounded-2xl bg-secondary/55 p-4"><p className="section-heading">Conversion preview</p><dl className="mt-3 space-y-2 text-sm"><Row label="Current Simple value" value={formatCurrency(confirmedPreview.simple_native_value_minor, account.currency_code)} /><Row label="Detailed opening state" value={formatCurrency(confirmedPreview.detailed_native_value_minor, account.currency_code)} /><Row label="Difference" value={formatCurrency(confirmedPreview.difference_minor, account.currency_code)} /></dl><p className="mt-3 text-xs leading-5 text-muted-foreground">The difference is not adjusted automatically. Confirm only after checking cash, quantities, and prices.</p></div>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{confirmedPreview ? <Button onClick={confirm} disabled={enable.isPending}>{enable.isPending && <LoaderCircle className="animate-spin" />}Confirm detailed tracking</Button> : <Button onClick={runPreview} disabled={preview.isPending}>{preview.isPending && <LoaderCircle className="animate-spin" />}Preview conversion</Button>}</div>
    </div>
  </section>
}

function updateHolding(setter: React.Dispatch<React.SetStateAction<OpeningHoldingInput[]>>, index: number, key: keyof OpeningHoldingInput, value: string, resetPreview: (value: null) => void) { setter((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)); resetPreview(null) }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{value}</dd></div> }
