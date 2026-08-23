import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, LoaderCircle } from "lucide-react"
import { useEffect, useMemo } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getActiveTransactionCategories } from "@/features/categories/category-logic"
import type { SaveTransactionInput } from "@/features/transactions/transactions-service"
import { useSaveTransaction } from "@/features/transactions/transactions-hooks"
import {
  getCategoryDisplayName,
  getTransactionAmount,
  transactionFormSchema,
  validateTransactionDraft,
  type TransactionFormValues,
} from "@/features/transactions/transaction-logic"
import { minorUnitsToInput } from "@/lib/currency"
import { getTodayDateInput } from "@/lib/dates"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import type { AccountSummaryRow, Category } from "@/types/database"
import type { PrimaryTransactionType, TransactionRecord } from "@/types/finance"

type TransactionFormProps = {
  accounts: AccountSummaryRow[]
  categories: Category[]
  transaction?: TransactionRecord | null
  initialType?: PrimaryTransactionType
  initialAccountId?: string | null
  initialDate?: string
  frequentCategories?: Category[]
  entryPage?: boolean
  sessionKey: string | number | boolean
  onCancel: () => void
  onSaved?: (input: SaveTransactionInput) => void
}

const transactionTypeItems = [
  { value: "expense", label: "Expense", icon: ArrowUpRight },
  { value: "income", label: "Income", icon: ArrowDownLeft },
  { value: "transfer", label: "Transfer", icon: ArrowRightLeft },
] as const

export function TransactionForm({
  accounts,
  categories,
  transaction,
  initialType = "expense",
  initialAccountId,
  initialDate,
  frequentCategories = [],
  entryPage = false,
  sessionKey,
  onCancel,
  onSaved,
}: TransactionFormProps) {
  const mutation = useSaveTransaction()
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: getDefaults(transaction, initialType, initialAccountId, initialDate),
  })
  const type = useWatch({ control, name: "transactionType" })
  const accountId = useWatch({ control, name: "accountId" })
  const categoryId = useWatch({ control, name: "categoryId" })
  const selectedAccount = accounts.find((account) => account.id === accountId)
  const availableAccounts = useMemo(
    () => type === "transfer" ? accounts : accounts.filter((account) => account.account_type !== "investment"),
    [accounts, type],
  )
  const activeCategories = type === "expense" || type === "income"
    ? getActiveTransactionCategories(categories, type)
    : []
  const historicalCategory = transaction?.category_id
    ? categories.find((category) => category.id === transaction.category_id && category.category_type === type)
    : undefined
  const availableCategories = historicalCategory?.archived_at
    ? [...activeCategories, historicalCategory]
    : activeCategories
  const accountItems = availableAccounts.map((account) => ({ value: account.id, label: account.name }))
  const destinationAccountItems = accounts.map((account) => ({ value: account.id, label: account.name }))
  const categoryItems = availableCategories.map((category) => ({
    value: category.id,
    label: `${getCategoryDisplayName(category, categories)}${category.archived_at ? " (Archived)" : ""}`,
  }))

  useEffect(() => {
    reset(getDefaults(transaction, initialType, initialAccountId, initialDate))
  }, [initialAccountId, initialDate, initialType, reset, sessionKey, transaction])

  useEffect(() => {
    if (type !== "transfer" && selectedAccount?.account_type === "investment") setValue("accountId", "")
  }, [selectedAccount?.account_type, setValue, type])

  const onSubmit = (values: TransactionFormValues) => {
    let amountMinor: number
    try {
      amountMinor = validateTransactionDraft(values, accounts).amountMinor
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transaction details are invalid."
      if (message.includes("currency") || message.includes("destination")) {
        setError("destinationAccountId", { message })
      } else {
        setError("amount", { message })
      }
      return
    }

    const input: SaveTransactionInput = {
      id: transaction?.id,
      transactionType: values.transactionType,
      amountMinor,
      accountId: values.accountId,
      destinationAccountId: values.transactionType === "transfer" ? values.destinationAccountId : undefined,
      categoryId: values.transactionType === "transfer" ? undefined : values.categoryId,
      transactionDate: values.transactionDate,
      description: values.description,
    }

    mutation.mutate(input, {
      onSuccess: () => {
        toast.success(transaction ? "Transaction updated." : values.transactionType === "expense" ? "Expense recorded." : "Transaction recorded.")
        onSaved?.(input)
      },
      onError: (error) => toast.error(getErrorMessage(error, "The transaction could not be saved.")),
    })
  }

  const accountField = (
    <FormField label={type === "transfer" ? "From account" : "Account"} error={errors.accountId?.message}>
      <Controller name="accountId" control={control} render={({ field }) => (
        <Select items={accountItems} value={field.value} onValueChange={field.onChange}>
          <SelectTrigger aria-label={type === "transfer" ? "From account" : "Account"} className={cn("w-full", entryPage && "h-12 rounded-xl text-base")}><SelectValue placeholder="Select account" /></SelectTrigger>
          <SelectContent>{availableAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · {account.institution ?? account.account_type} · {account.currency_code}</SelectItem>)}</SelectContent>
        </Select>
      )} />
    </FormField>
  )

  const categoryField = type !== "transfer" ? (
    <FormField label="Category" error={errors.categoryId?.message}>
      {entryPage && type === "expense" && frequentCategories.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1" aria-label="Frequently used expense categories">
          {frequentCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={categoryId === category.id}
              onClick={() => setValue("categoryId", category.id, { shouldValidate: true })}
              className={cn(
                "min-h-10 shrink-0 rounded-full px-3 text-sm font-medium ring-1 transition-colors",
                categoryId === category.id ? "bg-primary text-primary-foreground ring-primary" : "bg-surface text-muted-foreground ring-border/30 hover:text-foreground",
              )}
            >
              {getCategoryDisplayName(category, categories)}
            </button>
          ))}
        </div>
      )}
      <Controller name="categoryId" control={control} render={({ field }) => (
        <Select items={categoryItems} value={field.value} onValueChange={field.onChange}>
          <SelectTrigger aria-label="Category" className={cn("w-full", entryPage && "h-12 rounded-xl text-base")}><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>{availableCategories.map((category) => <SelectItem key={category.id} value={category.id}>{getCategoryDisplayName(category, categories)}{category.archived_at ? " (Archived)" : ""}</SelectItem>)}</SelectContent>
        </Select>
      )} />
    </FormField>
  ) : null

  const destinationField = type === "transfer" ? (
    <FormField label="To account" error={errors.destinationAccountId?.message}>
      <Controller name="destinationAccountId" control={control} render={({ field }) => (
        <Select items={destinationAccountItems} value={field.value} onValueChange={field.onChange}>
          <SelectTrigger aria-label="To account" className={cn("w-full", entryPage && "h-12 rounded-xl text-base")}><SelectValue placeholder="Select destination" /></SelectTrigger>
          <SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · {account.institution ?? account.account_type} · {account.currency_code}</SelectItem>)}</SelectContent>
        </Select>
      )} />
    </FormField>
  ) : null

  const noteField = (
    <FormField label="Note (optional)" error={errors.description?.message}>
      <Textarea
        className={cn("resize-none", entryPage && "min-h-20 rounded-xl bg-input/30 text-base md:text-sm")}
        rows={entryPage ? 2 : 3}
        aria-label="Note"
        placeholder="Caifan, Grab home, lunch with friends…"
        {...register("description")}
      />
    </FormField>
  )

  const dateField = (
    <FormField label="Date" error={errors.transactionDate?.message}>
      <Input aria-label="Date" className={cn(entryPage && "h-12 rounded-xl text-base md:text-sm")} type="date" {...register("transactionDate")} />
    </FormField>
  )

  const fields = (
    <div className={cn("space-y-4", entryPage && "flex-1 space-y-5 px-5 py-6 sm:px-8")}>
      {entryPage ? (
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Transaction type">
          {transactionTypeItems.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={type === item.value}
              onClick={() => setValue("transactionType", item.value, { shouldValidate: true })}
              className={cn(
                "flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium transition-colors ring-1",
                type === item.value ? "bg-primary text-primary-foreground ring-primary" : "bg-surface text-muted-foreground ring-border/30 hover:text-foreground",
              )}
            >
              <item.icon className="size-4" /> {item.label}
            </button>
          ))}
        </div>
      ) : (
        <FormField label="Type" error={errors.transactionType?.message}>
          <Controller name="transactionType" control={control} render={({ field }) => (
            <Select items={transactionTypeItems} value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{transactionTypeItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          )} />
        </FormField>
      )}

      <FormField label={`Amount${selectedAccount ? ` (${selectedAccount.currency_code})` : ""}`} error={errors.amount?.message} emphasis={entryPage}>
        <Input
          inputMode="decimal"
          aria-label="Amount"
          enterKeyHint="next"
          autoComplete="off"
          placeholder="0.00"
          autoFocus
          className={cn(entryPage && "h-24 rounded-2xl border-border/30 bg-surface px-4 text-center text-[clamp(2rem,10vw,2.75rem)] font-semibold tracking-[-0.04em] tabular-nums")}
          {...register("amount")}
        />
      </FormField>

      {entryPage ? (
        type === "transfer" ? <>{accountField}{destinationField}</> : <>{categoryField}{accountField}</>
      ) : (
        <>{accountField}{destinationField}{categoryField}</>
      )}
      {entryPage ? <>{noteField}{dateField}</> : <>{dateField}{noteField}</>}
    </div>
  )

  return (
    <form className={cn(entryPage ? "flex min-h-0 flex-1 flex-col" : "space-y-4")} onSubmit={handleSubmit(onSubmit)}>
      {fields}
      {entryPage ? (
        <div className="sticky bottom-0 z-10 border-t border-border/25 bg-background/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-8 lg:bg-card/95">
          <Button className="h-13 w-full rounded-xl text-base" type="submit" size="lg" disabled={mutation.isPending || availableAccounts.length === 0}>
            {mutation.isPending && <LoaderCircle className="animate-spin" />}Save {type}
          </Button>
        </div>
      ) : (
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || availableAccounts.length === 0}>{mutation.isPending && <LoaderCircle className="animate-spin" />}{transaction ? "Save changes" : "Add transaction"}</Button>
        </DialogFooter>
      )}
    </form>
  )
}

function getDefaults(
  transaction: TransactionRecord | null | undefined,
  initialType: PrimaryTransactionType,
  initialAccountId?: string | null,
  initialDate?: string,
): TransactionFormValues {
  const sourceEntry = transaction?.entries.find((entry) => entry.amount_minor < 0) ?? transaction?.entries.find((entry) => entry.amount_minor > 0)
  const destinationEntry = transaction?.transaction_type === "transfer" ? transaction.entries.find((entry) => entry.amount_minor > 0) : null
  const currencyCode = sourceEntry?.account?.currency_code ?? "SGD"
  const primaryType = transaction?.transaction_type === "income" || transaction?.transaction_type === "transfer" ? transaction.transaction_type : transaction ? "expense" : initialType

  return {
    transactionType: primaryType,
    amount: transaction ? minorUnitsToInput(getTransactionAmount(transaction), currencyCode) : "",
    accountId: sourceEntry?.account_id ?? initialAccountId ?? "",
    destinationAccountId: destinationEntry?.account_id ?? "",
    categoryId: transaction?.category_id ?? "",
    transactionDate: transaction?.transaction_date ?? initialDate ?? getTodayDateInput(),
    description: transaction?.description ?? "",
  }
}

function FormField({ label, error, children, emphasis = false }: { label: string; error?: string; children: React.ReactNode; emphasis?: boolean }) {
  return <div className="space-y-2"><Label className={cn(emphasis && "eyebrow")}>{label}</Label>{children}{error && <p className="text-xs text-destructive">{error}</p>}</div>
}
