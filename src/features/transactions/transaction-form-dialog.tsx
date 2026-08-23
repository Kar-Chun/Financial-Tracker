import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TransactionForm } from "@/features/transactions/transaction-form"
import { rememberExpenseAccount } from "@/features/transactions/quick-add-preferences"
import { useAuth } from "@/features/auth/auth-context"
import type { AccountSummaryRow, Category } from "@/types/database"
import type { TransactionRecord } from "@/types/finance"

type TransactionFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: AccountSummaryRow[]
  categories: Category[]
  transaction?: TransactionRecord | null
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  accounts,
  categories,
  transaction,
}: TransactionFormDialogProps) {
  const { user } = useAuth()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{transaction ? "Edit transaction" : "Add transaction"}</DialogTitle>
          <DialogDescription>
            Record the movement once. Finance Tracker creates the signed entries atomically.
          </DialogDescription>
        </DialogHeader>
        <TransactionForm
          accounts={accounts}
          categories={categories}
          transaction={transaction}
          sessionKey={open}
          onCancel={() => onOpenChange(false)}
          onSaved={(input) => {
            if (user && input.transactionType === "expense") rememberExpenseAccount(user.id, input.accountId)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
