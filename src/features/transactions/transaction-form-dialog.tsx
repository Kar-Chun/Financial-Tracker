import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle } from "lucide-react"
import { useEffect, useMemo } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useSaveTransaction } from "@/features/transactions/transactions-hooks"
import { getActiveTransactionCategories } from "@/features/categories/category-logic"
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
import type { AccountSummaryRow, Category } from "@/types/database"
import type { TransactionRecord } from "@/types/finance"

type TransactionFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: AccountSummaryRow[]
  categories: Category[]
  transaction?: TransactionRecord | null
}

const transactionTypeItems = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
]

export function TransactionFormDialog({
  open,
  onOpenChange,
  accounts,
  categories,
  transaction,
}: TransactionFormDialogProps) {
  const mutation = useSaveTransaction()
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: getDefaults(transaction),
  })
  const type = useWatch({ control, name: "transactionType" })
  const accountId = useWatch({ control, name: "accountId" })
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
    if (open) reset(getDefaults(transaction))
  }, [open, reset, transaction])

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

    mutation.mutate(
      {
        id: transaction?.id,
        transactionType: values.transactionType,
        amountMinor,
        accountId: values.accountId,
        destinationAccountId: values.transactionType === "transfer" ? values.destinationAccountId : undefined,
        categoryId: values.transactionType === "transfer" ? undefined : values.categoryId,
        transactionDate: values.transactionDate,
        description: values.description,
      },
      {
        onSuccess: () => {
          toast.success(transaction ? "Transaction updated." : "Transaction recorded.")
          onOpenChange(false)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, "The transaction could not be saved."))
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{transaction ? "Edit transaction" : "Add transaction"}</DialogTitle>
          <DialogDescription>
            Record the movement once. Ledgerly creates the signed entries atomically.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Type" error={errors.transactionType?.message}>
            <Controller
              name="transactionType"
              control={control}
              render={({ field }) => (
                <Select items={transactionTypeItems} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            label={`Amount${selectedAccount ? ` (${selectedAccount.currency_code})` : ""}`}
            error={errors.amount?.message}
          >
            <Input inputMode="decimal" placeholder="0.00" autoFocus {...register("amount")} />
          </FormField>

          <FormField label={type === "transfer" ? "From account" : "Account"} error={errors.accountId?.message}>
            <Controller
              name="accountId"
              control={control}
              render={({ field }) => (
                <Select items={accountItems} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {availableAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} · {account.institution ?? account.account_type} · {account.currency_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          {type === "transfer" ? (
            <FormField label="To account" error={errors.destinationAccountId?.message}>
              <Controller
                name="destinationAccountId"
                control={control}
                render={({ field }) => (
                  <Select items={destinationAccountItems} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select destination" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} · {account.institution ?? account.account_type} · {account.currency_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          ) : (
            <FormField label="Category" error={errors.categoryId?.message}>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <Select items={categoryItems} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {getCategoryDisplayName(category, categories)}{category.archived_at ? " (Archived)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          )}

          <FormField label="Date" error={errors.transactionDate?.message}>
            <Input type="date" {...register("transactionDate")} />
          </FormField>
          <FormField label="Description (optional)" error={errors.description?.message}>
            <Textarea rows={3} placeholder="What was this for?" {...register("description")} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || availableAccounts.length === 0}>
              {mutation.isPending && <LoaderCircle className="animate-spin" />}
              {transaction ? "Save changes" : "Add transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getDefaults(transaction?: TransactionRecord | null): TransactionFormValues {
  const sourceEntry = transaction?.entries.find((entry) => entry.amount_minor < 0)
    ?? transaction?.entries.find((entry) => entry.amount_minor > 0)
  const destinationEntry = transaction?.transaction_type === "transfer"
    ? transaction.entries.find((entry) => entry.amount_minor > 0)
    : null
  const currencyCode = sourceEntry?.account?.currency_code ?? "SGD"
  const primaryType = transaction?.transaction_type === "income" || transaction?.transaction_type === "transfer"
    ? transaction.transaction_type
    : "expense"

  return {
    transactionType: primaryType,
    amount: transaction ? minorUnitsToInput(getTransactionAmount(transaction), currencyCode) : "",
    accountId: sourceEntry?.account_id ?? "",
    destinationAccountId: destinationEntry?.account_id ?? "",
    categoryId: transaction?.category_id ?? "",
    transactionDate: transaction?.transaction_date ?? getTodayDateInput(),
    description: transaction?.description ?? "",
  }
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
