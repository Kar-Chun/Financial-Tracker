import { LoaderCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { calculateTradeCashMinor, parseExactDecimal } from "@/features/investments/investment-logic"
import { useRecordCashEvent, useRecordTrade, useSaveHolding, useSaveManualFx, useUpdatePrices } from "@/features/investments/investments-hooks"
import type { DetailedHolding } from "@/features/investments/investment-types"
import { formatCurrency, getMinorUnitDigits, parseCurrencyToMinor } from "@/lib/currency"
import { getErrorMessage } from "@/lib/errors"

type CommonProps = { accountId: string; currencyCode: string; today: string; open: boolean; onOpenChange: (open: boolean) => void }

export function TradeDialog({ accountId, currencyCode, today, holdings, type, open, onOpenChange }: CommonProps & { holdings: DetailedHolding[]; type: "buy" | "sell" }) {
  const mutation = useRecordTrade()
  const available = holdings.filter((holding) => !holding.archived_at && (type === "buy" || Number(holding.quantity) > 0))
  const [holdingId, setHoldingId] = useState<string | null>(available[0]?.id ?? null)
  const [quantity, setQuantity] = useState("")
  const [price, setPrice] = useState("")
  const [fee, setFee] = useState("0.00")
  const [date, setDate] = useState(today)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const selected = available.find((holding) => holding.id === holdingId)
  const total = useMemo(() => {
    try { return calculateTradeCashMinor(type, quantity, price, BigInt(parseCurrencyToMinor(fee || "0", currencyCode)), 10 ** getMinorUnitDigits(currencyCode)) }
    catch { return null }
  }, [currencyCode, fee, price, quantity, type])

  const submit = () => {
    try {
      if (!holdingId) throw new Error("Choose a holding.")
      if (!parseExactDecimal(quantity) || !parseExactDecimal(price) || !Number.isFinite(Number(quantity)) || !Number.isFinite(Number(price)) || Number(quantity) <= 0 || Number(price) <= 0) throw new Error("Enter a positive quantity and price within a supported range.")
      if (type === "sell" && selected && Number(quantity) > Number(selected.quantity)) throw new Error("Quantity exceeds the available holding.")
      const feeMinor = parseCurrencyToMinor(fee || "0", currencyCode)
      if (total === null || total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error("Trade total is invalid or too large.")
      mutation.mutate({ accountId, holdingId, tradeType: type, quantity, unitPrice: price, feeMinor, tradeDate: date, note }, { onSuccess: () => { toast.success(`${type === "buy" ? "Buy" : "Sell"} recorded.`); onOpenChange(false) }, onError: (cause) => setError(getErrorMessage(cause, "The trade could not be recorded.")) })
    } catch (cause) { setError(getErrorMessage(cause, "Check the trade details.")) }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{type === "buy" ? "Buy investment" : "Sell investment"}</DialogTitle><DialogDescription>Trades update broker cash and weighted-average cost. They are not ordinary expenses or income.</DialogDescription></DialogHeader><div className="max-h-[65svh] space-y-4 overflow-y-auto pr-1">
    <Field label="Holding"><Select value={holdingId} onValueChange={setHoldingId} items={available.map((item) => ({value:item.id,label:`${item.symbol} · ${item.name}`}))}><SelectTrigger className="w-full"><SelectValue placeholder="Select holding" /></SelectTrigger><SelectContent>{available.map((item) => <SelectItem key={item.id} value={item.id}>{item.symbol} · {item.name}</SelectItem>)}</SelectContent></Select>{type === "sell" && selected && <p className="text-xs text-muted-foreground">Available: {formatQuantity(selected.quantity)} shares</p>}</Field>
    <Field label="Quantity"><Input inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Field><Field label={`Price per unit (${currencyCode})`}><Input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /></Field><Field label={`Fee (${currencyCode}, optional)`}><Input inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} /></Field><Field label="Date"><Input data-mobile-date className="w-full min-w-0" type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} /></Field><Field label="Note (optional)"><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field>
    {total !== null && total <= BigInt(Number.MAX_SAFE_INTEGER) && total >= BigInt(Number.MIN_SAFE_INTEGER) && <div className="rounded-xl bg-secondary/60 p-3 text-sm"><p className="text-muted-foreground">{type === "buy" ? "Total cash required" : "Net sale proceeds"}</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(Number(type === "buy" ? -total : total), currencyCode)}</p></div>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="animate-spin" />}Record {type}</Button></DialogFooter></DialogContent></Dialog>
}

export function PricesDialog({ accountId, currencyCode, today, holdings, open, onOpenChange }: CommonProps & { holdings: DetailedHolding[] }) {
  const mutation = useUpdatePrices(); const [date,setDate]=useState(today); const [prices,setPrices]=useState<Record<string,string>>(() => Object.fromEntries(holdings.filter((item)=>!item.archived_at).map((item)=>[item.id,item.latest_price?.toString()??""]))); const [error,setError]=useState<string|null>(null)
  const submit=()=>{const updates=holdings.filter((item)=>!item.archived_at).map((item)=>({holding_id:item.id,price:prices[item.id]?.trim()??""}));if(updates.some((item)=>!parseExactDecimal(item.price)||Number(item.price)<=0)){setError("Enter a positive current price for every active holding.");return}mutation.mutate({accountId,pricedAt:date,prices:updates},{onSuccess:()=>{toast.success("Holding prices updated.");onOpenChange(false)},onError:(cause)=>setError(getErrorMessage(cause,"Prices could not be updated."))})}
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Update prices</DialogTitle><DialogDescription>Manual prices are stored historically. No market-data API is used.</DialogDescription></DialogHeader><div className="max-h-[65svh] space-y-4 overflow-y-auto pr-1"><Field label="Price date"><Input data-mobile-date className="w-full min-w-0" type="date" max={today} value={date} onChange={(event)=>setDate(event.target.value)} /></Field>{holdings.filter((item)=>!item.archived_at).map((holding)=><Field key={holding.id} label={`${holding.symbol} · ${holding.name} (${currencyCode})`}><Input inputMode="decimal" value={prices[holding.id]??""} onChange={(event)=>setPrices((items)=>({...items,[holding.id]:event.target.value}))} /></Field>)}{error&&<p className="text-sm text-destructive">{error}</p>}</div><DialogFooter><Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={mutation.isPending}>{mutation.isPending&&<LoaderCircle className="animate-spin"/>}Save prices</Button></DialogFooter></DialogContent></Dialog>
}

export function FxDialog({ fromCurrency, baseCurrency, today, open, onOpenChange }: { fromCurrency:string;baseCurrency:string;today:string;open:boolean;onOpenChange:(open:boolean)=>void }) {
  const mutation=useSaveManualFx();const[rate,setRate]=useState("");const[date,setDate]=useState(today);const[error,setError]=useState<string|null>(null)
  const submit=()=>{if(!parseExactDecimal(rate,12)||Number(rate)<=0){setError("Enter a positive direct FX rate.");return}mutation.mutate({fromCurrency,rate,rateDate:date},{onSuccess:()=>{toast.success("Manual FX rate updated.");onOpenChange(false)},onError:(cause)=>setError(getErrorMessage(cause,"The FX rate could not be saved."))})}
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Update {fromCurrency} → {baseCurrency}</DialogTitle><DialogDescription>Enter how many {baseCurrency} one {fromCurrency} is worth. This rate is only for valuation, never transfer conversion.</DialogDescription></DialogHeader><div className="space-y-4"><Field label={`1 ${fromCurrency} = ${baseCurrency}`}><Input inputMode="decimal" value={rate} onChange={(event)=>setRate(event.target.value)} /></Field><Field label="Rate date"><Input data-mobile-date className="w-full min-w-0" type="date" max={today} value={date} onChange={(event)=>setDate(event.target.value)} /></Field>{error&&<p className="text-sm text-destructive">{error}</p>}</div><DialogFooter><Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={mutation.isPending}>{mutation.isPending&&<LoaderCircle className="animate-spin"/>}Save rate</Button></DialogFooter></DialogContent></Dialog>
}

export function HoldingDialog({ accountId, open, onOpenChange }: Pick<CommonProps,"accountId"|"open"|"onOpenChange">) {
  const mutation=useSaveHolding();const[symbol,setSymbol]=useState("");const[name,setName]=useState("");const[type,setType]=useState<string|null>("etf");const[error,setError]=useState<string|null>(null)
  const submit=()=>{if(!symbol.trim()||!name.trim()){setError("Symbol and name are required.");return}mutation.mutate({accountId,symbol,name,assetType:type??"etf"},{onSuccess:()=>{toast.success("Holding added. Record a buy before it has a quantity.");onOpenChange(false)},onError:(cause)=>setError(getErrorMessage(cause,"The holding could not be added."))})}
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Add holding</DialogTitle><DialogDescription>Add metadata first, then record a Buy to establish quantity and cost.</DialogDescription></DialogHeader><div className="space-y-4"><Field label="Symbol"><Input value={symbol} onChange={(event)=>setSymbol(event.target.value)} placeholder="CSPX" /></Field><Field label="Name"><Input value={name} onChange={(event)=>setName(event.target.value)} placeholder="iShares Core S&P 500" /></Field><Field label="Asset type"><Select value={type} onValueChange={setType} items={[{value:"stock",label:"Stock"},{value:"etf",label:"ETF"},{value:"fund",label:"Fund"},{value:"other",label:"Other"}]}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["stock","etf","fund","other"].map((item)=><SelectItem key={item} value={item}>{item==="etf"?"ETF":item[0].toUpperCase()+item.slice(1)}</SelectItem>)}</SelectContent></Select></Field>{error&&<p className="text-sm text-destructive">{error}</p>}</div><DialogFooter><Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={mutation.isPending}>Add holding</Button></DialogFooter></DialogContent></Dialog>
}

export function CashEventDialog({ accountId,currencyCode,today,holdings,type,open,onOpenChange }: CommonProps & {holdings:DetailedHolding[];type:"dividend"|"cash_adjustment"}) {
  const mutation=useRecordCashEvent();const[holdingId,setHoldingId]=useState<string|null>(holdings[0]?.id??null);const[amount,setAmount]=useState("");const[date,setDate]=useState(today);const[note,setNote]=useState("");const[error,setError]=useState<string|null>(null)
  const submit=()=>{try{const amountMinor=parseCurrencyToMinor(amount,currencyCode,{allowNegative:type==="cash_adjustment"});if((type==="dividend"&&amountMinor<=0)||amountMinor===0)throw new Error("Enter a valid non-zero amount.");if(!note.trim())throw new Error("A short note or reason is required.");mutation.mutate({accountId,holdingId:type==="dividend"?holdingId:null,eventType:type,amountMinor,eventDate:date,note},{onSuccess:()=>{toast.success(type==="dividend"?"Dividend recorded.":"Broker cash adjusted.");onOpenChange(false)},onError:(cause)=>setError(getErrorMessage(cause,"The cash event could not be saved."))})}catch(cause){setError(getErrorMessage(cause,"Check the amount."))}}
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{type==="dividend"?"Record dividend":"Adjust broker cash"}</DialogTitle><DialogDescription>{type==="dividend"?"Dividends increase broker cash but do not enter ordinary income analytics.":"Use only for reconciliation, not as a substitute for an account transfer."}</DialogDescription></DialogHeader><div className="space-y-4">{type==="dividend"&&<Field label="Holding"><Select value={holdingId} onValueChange={setHoldingId} items={holdings.map((item)=>({value:item.id,label:`${item.symbol} · ${item.name}`}))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{holdings.map((item)=><SelectItem key={item.id} value={item.id}>{item.symbol} · {item.name}</SelectItem>)}</SelectContent></Select></Field>}<Field label={`Amount (${currencyCode})`}><Input inputMode="decimal" value={amount} onChange={(event)=>setAmount(event.target.value)} placeholder={type==="cash_adjustment"?"Use - for a reduction":"0.00"}/></Field><Field label="Date"><Input data-mobile-date className="w-full min-w-0" type="date" max={today} value={date} onChange={(event)=>setDate(event.target.value)}/></Field><Field label={type==="dividend"?"Note / source":"Reason"}><Input value={note} onChange={(event)=>setNote(event.target.value)}/></Field>{error&&<p className="text-sm text-destructive">{error}</p>}</div><DialogFooter><Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={mutation.isPending}>Save</Button></DialogFooter></DialogContent></Dialog>
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <div className="space-y-2"><Label>{label}</Label>{children}</div>}
function formatQuantity(value:number){return new Intl.NumberFormat("en-SG",{maximumFractionDigits:10}).format(value)}
