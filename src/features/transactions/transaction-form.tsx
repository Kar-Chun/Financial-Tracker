import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, ChevronDown, LoaderCircle } from "lucide-react"
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
  quickAdd?: boolean
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
  quickAdd = false,
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

  const fields = (
    <div className={cn("space-y-4", quickAdd && "min-h-0 flex-1 overflow-y-auto px-4 pb-4")}>
      {quickAdd ? (
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Transaction type">
          {transactionTypeItems.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={type === item.value}
              onClick={() => setValue("transactionType", item.value, { shouldValidate: true })}
              className={cn(
                "flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-medium transition-colors",
                type === item.value ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/20 text-muted-foreground",
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

      <FormField label={`Amount${selectedAccount ? ` (${selectedAccount.currency_code})` : ""}`} error={errors.amount?.message}>
        <Input
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          placeholder="0.00"
          autoFocus
          className={cn(quickAdd && "h-15 px-4 text-3xl font-semibold tracking-tight md:text-3xl")}
          {...register("amount")}
        />
      </FormField>

      <FormField label={type === "transfer" ? "From account" : "Account"} error={errors.accountId?.message}>
        <Controller name="accountId" control={control} render={({ field }) => (
          <Select items={accountItems} value={field.value} onValueChange={field.onChange}>
            <SelectTrigger className={cn("w-full", quickAdd && "h-11 text-base")}><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{availableAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · {account.institution ?? account.account_type} · {account.currency_code}</SelectItem>)}</SelectContent>
          </Select>
        )} />
      </FormField>

      {type === "transfer" ? (
        <FormField label="To account" error={errors.destinationAccountId?.message}>
          <Controller name="destinationAccountId" control={control} render={({ field }) => (
            <Select items={destinationAccountItems} value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className={cn("w-full", quickAdd && "h-11 text-base")}><SelectValue placeholder="Select destination" /></SelectTrigger>
              <SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · {account.institution ?? account.account_type} · {account.currency_code}</SelectItem>)}</SelectContent>
            </Select>
          )} />
        </FormField>
      ) : (
        <FormField label="Category" error={errors.categoryId?.message}>
          {quickAdd && type === "expense" && frequentCategories.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1" aria-label="Frequently used expense categories">
              {frequentCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={categoryId === category.id}
                  onClick={() => setValue("categoryId", category.id, { shouldValidate: true })}
                  className={cn(
                    "min-h-10 shrink-0 rounded-full border px-3 text-sm font-medium",
                    categoryId === category.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/25 text-muted-foreground",
                  )}
                >
                  {getCategoryDisplayName(category, categories)}
                </button>
              ))}
            </div>
          )}
          <Controller name="categoryId" control={control} render={({ field }) => (
            <Select items={categoryItems} value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className={cn("w-full", quickAdd && "h-11 text-base")}><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{availableCategories.map((category) => <SelectItem key={category.id} value={category.id}>{getCategoryDisplayName(category, categories)}{category.archived_at ? " (Archived)" : ""}</SelectItem>)}</SelectContent>
            </Select>
          )} />
        </FormField>
      )}

      {quickAdd ? (
        <details className="group rounded-xl border bg-muted/15 p-3">
          <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between text-sm font-medium text-muted-foreground">
            Date and description <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-4 border-t pt-3">
            <FormField label="Date" error={errors.transactionDate?.message}><Input className="h-11" type="date" {...register("transactionDate")} /></FormField>
            <FormField label="Description (optional)" error={errors.description?.message}><Textarea className="text-base md:text-sm" rows={2} placeholder="What was this for?" {...register("description")} /></FormField>
          </div>
        </details>
      ) : (
        <>
          <FormField label="Date" error={errors.transactionDate?.message}><Input type="date" {...register("transactionDate")} /></FormField>
          <FormField label="Description (optional)" error={errors.description?.message}><Textarea rows={3} placeholder="What was this for?" {...register("description")} /></FormField>
        </>
      )}
    </div>
  )

  return (
    <form className={cn(quickAdd ? "flex min-h-0 flex-1 flex-col" : "space-y-4")} onSubmit={handleSubmit(onSubmit)}>
      {fields}
      {quickAdd ? (
        <div className="grid grid-cols-[auto_1fr] gap-2 border-t bg-popover px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button type="button" size="lg" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" size="lg" disabled={mutation.isPending || availableAccounts.length === 0}>{mutation.isPending && <LoaderCircle className="animate-spin" />}Save {type}</Button>
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

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}{error && <p className="text-xs text-destructive">{error}</p>}</div>
}
