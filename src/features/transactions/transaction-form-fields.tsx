import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from "lucide-react"
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form"
import { Controller } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getCategoryDisplayName, type TransactionFormValues } from "@/features/transactions/transaction-logic"
import { cn } from "@/lib/utils"
import type { AccountSummaryRow, Category, PrimaryTransactionType } from "@/types/finance"

type SelectItemModel = { label: string; value: string }

type TransactionFormFieldsProps = {
  accountItems: SelectItemModel[]
  accounts: AccountSummaryRow[]
  availableAccounts: AccountSummaryRow[]
  availableCategories: Category[]
  categories: Category[]
  categoryId: string
  categoryItems: SelectItemModel[]
  control: Control<TransactionFormValues>
  destinationAccountItems: SelectItemModel[]
  entryPage: boolean
  errors: FieldErrors<TransactionFormValues>
  frequentCategories: Category[]
  register: UseFormRegister<TransactionFormValues>
  selectedAccount?: AccountSummaryRow
  setValue: UseFormSetValue<TransactionFormValues>
  type: PrimaryTransactionType
}

const transactionTypeItems = [
  { value: "expense", label: "Expense", icon: ArrowUpRight },
  { value: "income", label: "Income", icon: ArrowDownLeft },
  { value: "transfer", label: "Transfer", icon: ArrowRightLeft },
] as const

export function TransactionFormFields({
  accountItems,
  accounts,
  availableAccounts,
  availableCategories,
  categories,
  categoryId,
  categoryItems,
  control,
  destinationAccountItems,
  entryPage,
  errors,
  frequentCategories,
  register,
  selectedAccount,
  setValue,
  type,
}: TransactionFormFieldsProps) {
  const accountField = (
    <FormField label={type === "transfer" ? "From account" : "Account"} error={errors.accountId?.message}>
      <Controller name="accountId" control={control} render={({ field }) => (
        <Select items={accountItems} value={field.value} onValueChange={field.onChange}>
          <SelectTrigger aria-label={type === "transfer" ? "From account" : "Account"} className={cn("w-full", entryPage && "h-12 rounded-xl text-base")}>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {availableAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name} · {account.institution ?? account.account_type} · {account.currency_code}
              </SelectItem>
            ))}
          </SelectContent>
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
                categoryId === category.id
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-surface text-muted-foreground ring-border/30 hover:text-foreground",
              )}
            >
              {getCategoryDisplayName(category, categories)}
            </button>
          ))}
        </div>
      )}
      <Controller name="categoryId" control={control} render={({ field }) => (
        <Select items={categoryItems} value={field.value} onValueChange={field.onChange}>
          <SelectTrigger aria-label="Category" className={cn("w-full", entryPage && "h-12 rounded-xl text-base")}>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {availableCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {getCategoryDisplayName(category, categories)}{category.archived_at ? " (Archived)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )} />
    </FormField>
  ) : null

  const destinationField = type === "transfer" ? (
    <FormField label="To account" error={errors.destinationAccountId?.message}>
      <Controller name="destinationAccountId" control={control} render={({ field }) => (
        <Select items={destinationAccountItems} value={field.value} onValueChange={field.onChange}>
          <SelectTrigger aria-label="To account" className={cn("w-full", entryPage && "h-12 rounded-xl text-base")}>
            <SelectValue placeholder="Select destination" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name} · {account.institution ?? account.account_type} · {account.currency_code}
              </SelectItem>
            ))}
          </SelectContent>
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
      <Input
        data-transaction-date
        aria-label="Date"
        className={cn("block w-full min-w-0 max-w-full", entryPage && "h-12 rounded-xl text-base md:text-sm")}
        type="date"
        {...register("transactionDate")}
      />
    </FormField>
  )

  return (
    <div className={cn("space-y-4", entryPage && "flex-1 space-y-5 px-5 py-6 sm:px-8")}>
      <TransactionTypeField control={control} entryPage={entryPage} errors={errors} setValue={setValue} type={type} />
      <FormField label={`Amount${selectedAccount ? ` (${selectedAccount.currency_code})` : ""}`} error={errors.amount?.message}>
        <Input
          inputMode="decimal"
          aria-label="Amount"
          enterKeyHint="next"
          autoComplete="off"
          placeholder="0.00"
          autoFocus
          className={cn(entryPage && "h-12 rounded-xl bg-input/30 px-3 text-base font-medium tabular-nums md:text-sm")}
          {...register("amount")}
        />
      </FormField>
      {entryPage
        ? type === "transfer" ? <>{accountField}{destinationField}</> : <>{categoryField}{accountField}</>
        : <>{accountField}{destinationField}{categoryField}</>}
      {entryPage ? <>{noteField}{dateField}</> : <>{dateField}{noteField}</>}
    </div>
  )
}

function TransactionTypeField({
  control,
  entryPage,
  errors,
  setValue,
  type,
}: Pick<TransactionFormFieldsProps, "control" | "entryPage" | "errors" | "setValue" | "type">) {
  if (entryPage) {
    return (
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Transaction type">
        {transactionTypeItems.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={type === item.value}
            onClick={() => setValue("transactionType", item.value, { shouldValidate: true })}
            className={cn(
              "flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium transition-colors ring-1",
              type === item.value
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-surface text-muted-foreground ring-border/30 hover:text-foreground",
            )}
          >
            <item.icon className="size-4" /> {item.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <FormField label="Type" error={errors.transactionType?.message}>
      <Controller name="transactionType" control={control} render={({ field }) => (
        <Select items={transactionTypeItems} value={field.value} onValueChange={field.onChange}>
          <SelectTrigger aria-label="Type" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {transactionTypeItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )} />
    </FormField>
  )
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
