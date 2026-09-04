import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
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
import { useSaveInvestmentValuation } from "@/features/accounts/accounts-hooks"
import { useProfile } from "@/features/auth/profile-service"
import { minorUnitsToInput, parseCurrencyToMinor } from "@/lib/currency"
import { getErrorMessage } from "@/lib/errors"
import type { AccountSummaryRow } from "@/types/finance"

const valuationSchema = z.object({
  nativeValue: z.string().min(1, "Native value is required."),
  baseValue: z.string().min(1, "Base-currency value is required."),
  valuedAt: z.string().min(1, "Date is required."),
})

type ValuationFormValues = z.infer<typeof valuationSchema>

type ValuationDialogProps = {
  account: AccountSummaryRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ValuationDialog({ account, open, onOpenChange }: ValuationDialogProps) {
  const profileQuery = useProfile()
  const mutation = useSaveInvestmentValuation()
  const {
    register,
    reset,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ValuationFormValues>({
    resolver: zodResolver(valuationSchema),
    defaultValues: getDefaults(account),
  })

  useEffect(() => {
    if (open) reset(getDefaults(account))
  }, [account, open, reset])

  if (!account) return null
  const baseCurrency = profileQuery.data?.base_currency ?? "SGD"

  const onSubmit = (values: ValuationFormValues) => {
    let nativeValueMinor: number
    let baseValueMinor: number

    try {
      nativeValueMinor = parseCurrencyToMinor(values.nativeValue, account.currency_code)
    } catch (error) {
      setError("nativeValue", { message: error instanceof Error ? error.message : "Value is invalid." })
      return
    }

    try {
      baseValueMinor = parseCurrencyToMinor(values.baseValue, baseCurrency)
    } catch (error) {
      setError("baseValue", { message: error instanceof Error ? error.message : "Value is invalid." })
      return
    }

    mutation.mutate(
      {
        accountId: account.id,
        nativeValueMinor,
        baseValueMinor,
        valuedAt: values.valuedAt,
      },
      {
        onSuccess: () => {
          toast.success("Investment value updated.")
          onOpenChange(false)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, "The investment value could not be saved."))
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update {account.name}</DialogTitle>
          <DialogDescription>
            Enter both values manually. Ledgerly does not fetch exchange rates.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormField label={`Native value (${account.currency_code})`} error={errors.nativeValue?.message}>
            <Input inputMode="decimal" {...register("nativeValue")} />
          </FormField>
          <FormField label={`${baseCurrency} value`} error={errors.baseValue?.message}>
            <Input inputMode="decimal" {...register("baseValue")} />
          </FormField>
          <FormField label="Valuation date" error={errors.valuedAt?.message}>
            <Input type="date" {...register("valuedAt")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <LoaderCircle className="animate-spin" />}
              Save value
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getDefaults(account: AccountSummaryRow | null): ValuationFormValues {
  const today = new Date().toISOString().slice(0, 10)
  return {
    nativeValue:
      account?.native_value_minor !== null && account?.native_value_minor !== undefined
        ? minorUnitsToInput(account.native_value_minor, account.currency_code)
        : "0.00",
    baseValue:
      account?.base_value_minor !== null && account?.base_value_minor !== undefined
        ? minorUnitsToInput(account.base_value_minor, "SGD")
        : "0.00",
    valuedAt: account?.valued_at ?? today,
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
