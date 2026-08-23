import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { goalFormSchema, parsePositiveGoalTarget, type GoalFormValues } from "@/features/goals/goal-logic"
import type { SavingsGoalDetail } from "@/features/goals/goal-types"
import { useSaveSavingsGoal } from "@/features/goals/goals-hooks"
import { minorUnitsToInput } from "@/lib/currency"
import { getErrorMessage } from "@/lib/errors"

export function GoalForm({ currencyCode, goal, entryPage = false, onCancel, onSaved }: {
  currencyCode: string
  goal?: SavingsGoalDetail | null
  entryPage?: boolean
  onCancel: () => void
  onSaved: (goalId: string) => void
}) {
  const mutation = useSaveSavingsGoal()
  const { register, handleSubmit, setError, formState: { errors } } = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      name: goal?.name ?? "",
      targetAmount: goal ? minorUnitsToInput(goal.target_amount_minor, goal.currency_code) : "",
      targetDate: goal?.target_date ?? "",
      note: goal?.note ?? "",
    },
  })

  const submit = (values: GoalFormValues) => {
    let targetAmountMinor: number
    try {
      targetAmountMinor = parsePositiveGoalTarget(values.targetAmount, currencyCode)
    } catch (cause) {
      setError("targetAmount", { message: cause instanceof Error ? cause.message : "Enter a valid target." })
      return
    }
    mutation.mutate({ id: goal?.id, name: values.name, targetAmountMinor, targetDate: values.targetDate || null, note: values.note }, {
      onSuccess: (goalId) => { toast.success(goal ? "Savings goal updated." : "Savings goal created."); onSaved(goalId) },
      onError: (cause) => toast.error(getErrorMessage(cause, "The savings goal could not be saved.")),
    })
  }

  const fields = <div className={entryPage ? "flex-1 space-y-5 px-5 py-6 sm:px-8" : "space-y-4"}>
    <Field label="Goal name" error={errors.name?.message}><Input className={entryPage ? "h-12 rounded-xl text-base md:text-sm" : undefined} placeholder="Japan Trip" autoComplete="off" {...register("name")} /></Field>
    <Field label={`Target amount (${currencyCode})`} error={errors.targetAmount?.message}><Input className={entryPage ? "h-12 rounded-xl text-base md:text-sm" : undefined} inputMode="decimal" autoComplete="off" placeholder="3000.00" {...register("targetAmount")} /></Field>
    <Field label="Target date (optional)" error={errors.targetDate?.message}><Input data-mobile-date className={entryPage ? "block h-12 w-full min-w-0 max-w-full rounded-xl text-base md:text-sm" : "block w-full min-w-0 max-w-full"} type="date" {...register("targetDate")} /></Field>
    <Field label="Note (optional)" error={errors.note?.message}><Textarea className={entryPage ? "min-h-24 resize-none rounded-xl text-base md:text-sm" : "resize-none"} placeholder="Flight, hotel and spending money" {...register("note")} /></Field>
    <p className="text-xs leading-5 text-muted-foreground">Allocations are planning entries only. They do not move money or change account balances.</p>
  </div>

  if (entryPage) return <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit(submit)}>{fields}<div className="sticky bottom-0 mt-auto border-t border-border/25 bg-background/95 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-8"><Button className="h-12 w-full rounded-xl" type="submit" disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="animate-spin" />}{goal ? "Save changes" : "Create goal"}</Button></div></form>

  return <form className="space-y-4" onSubmit={handleSubmit(submit)}>{fields}<DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="animate-spin" />}Save changes</Button></DialogFooter></form>
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}{error && <p className="text-xs text-destructive">{error}</p>}</div>
}
