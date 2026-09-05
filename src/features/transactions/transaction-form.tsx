import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { getActiveTransactionCategories } from "@/features/categories/category-logic"
import { TransactionFormFields } from "@/features/transactions/transaction-form-fields"
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
import type { AccountSummaryRow, Category } from "@/types/finance"
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

  return (
    <form className={cn(entryPage ? "flex min-h-0 flex-1 flex-col" : "space-y-4")} onSubmit={handleSubmit(onSubmit)}>
      <TransactionFormFields
        accountItems={accountItems}
        accounts={accounts}
        availableAccounts={availableAccounts}
        availableCategories={availableCategories}
        categories={categories}
        categoryId={categoryId}
        categoryItems={categoryItems}
        control={control}
        destinationAccountItems={destinationAccountItems}
        entryPage={entryPage}
        errors={errors}
        frequentCategories={frequentCategories}
        register={register}
        selectedAccount={selectedAccount}
        setValue={setValue}
        type={type}
      />
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
