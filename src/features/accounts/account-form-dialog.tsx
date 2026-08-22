import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useEffect } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

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
import { useSaveAccount } from "@/features/accounts/accounts-hooks"
import { getErrorMessage } from "@/lib/errors"
import {
  minorUnitsToInput,
  parseCurrencyToMinor,
  supportedCurrencies,
} from "@/lib/currency"
import type { AccountSummaryRow } from "@/types/database"
import type { AccountType } from "@/types/finance"

const accountSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  accountType: z.enum(["bank", "cash", "investment"]),
  institution: z.string().trim().max(100),
  currencyCode: z.string().regex(/^[A-Z]{3}$/, "Select a currency."),
  openingBalance: z.string().min(1, "Opening balance is required."),
})

type AccountFormValues = z.infer<typeof accountSchema>

type AccountFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: AccountSummaryRow | null
  initialType?: AccountType
}

const accountTypeItems = [
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
]

const currencyItems = supportedCurrencies.map((currency) => ({
  value: currency.code,
  label: `${currency.code} · ${currency.label}`,
}))

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  initialType = "bank",
}: AccountFormDialogProps) {
  const mutation = useSaveAccount()
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: getDefaults(account, initialType),
  })
  const accountType = useWatch({ control, name: "accountType" })
  const currencyCode = useWatch({ control, name: "currencyCode" })

  useEffect(() => {
    if (open) reset(getDefaults(account, initialType))
  }, [account, initialType, open, reset])

  const onSubmit = (values: AccountFormValues) => {
    let openingBalanceMinor = 0
    if (values.accountType !== "investment") {
      try {
        openingBalanceMinor = parseCurrencyToMinor(values.openingBalance, values.currencyCode, {
          allowNegative: true,
        })
      } catch (error) {
        setError("openingBalance", {
          message: error instanceof Error ? error.message : "Opening balance is invalid.",
        })
        return
      }
    }

    mutation.mutate(
      {
        id: account?.id,
        name: values.name,
        accountType: values.accountType,
        institution: values.institution,
        currencyCode: values.currencyCode,
        openingBalanceMinor,
      },
      {
        onSuccess: () => {
          toast.success(account ? "Account updated." : "Account created.")
          onOpenChange(false)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, "The account could not be saved."))
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "Create account"}</DialogTitle>
          <DialogDescription>
            Store labels only—never enter account numbers, credentials, or PINs.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Name" error={errors.name?.message}>
            <Input placeholder="Daily spending" {...register("name")} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Type" error={errors.accountType?.message}>
              <Controller
                name="accountType"
                control={control}
                render={({ field }) => (
                  <Select items={accountTypeItems} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="investment">Investment</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Currency" error={errors.currencyCode?.message}>
              <Controller
                name="currencyCode"
                control={control}
                render={({ field }) => (
                  <Select items={currencyItems} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {supportedCurrencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} · {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          <FormField label="Institution (optional)" error={errors.institution?.message}>
            <Input placeholder="DBS, OCBC, UOB, IBKR…" {...register("institution")} />
          </FormField>

          <FormField
            label={accountType === "investment" ? "Opening balance" : `Opening balance (${currencyCode})`}
            error={errors.openingBalance?.message}
          >
            <Input
              inputMode="decimal"
              disabled={accountType === "investment"}
              {...register("openingBalance")}
            />
            {accountType === "investment" && (
              <p className="text-xs text-muted-foreground">
                Investment value is set separately with a manual valuation.
              </p>
            )}
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <LoaderCircle className="animate-spin" />}
              {account ? "Save changes" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getDefaults(account: AccountSummaryRow | null | undefined, initialType: AccountType): AccountFormValues {
  return {
    name: account?.name ?? "",
    accountType: account?.account_type ?? initialType,
    institution: account?.institution ?? "",
    currencyCode: account?.currency_code ?? "SGD",
    openingBalance: account
      ? minorUnitsToInput(account.opening_balance_minor, account.currency_code)
      : "0.00",
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
