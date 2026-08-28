import { History, LoaderCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useResetNetWorthHistory } from "@/features/settings/net-worth-history-hooks"
import { getErrorMessage } from "@/lib/errors"

export function NetWorthHistoryReset() {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const mutation = useResetNetWorthHistory()

  const confirmReset = () => {
    if (confirmation !== "RESET" || mutation.isPending) return

    mutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Net Worth history restarted from today's financial value.")
        setOpen(false)
        setConfirmation("")
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, "Net Worth history could not be reset."))
      },
    })
  }

  return (
    <section className="max-w-2xl rounded-2xl bg-card/45 p-5 ring-1 ring-white/4 sm:p-6" aria-labelledby="data-history-heading">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <History className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow" id="data-history-heading">Data &amp; history</p>
          <h2 className="mt-2 text-base font-semibold">Reset Net Worth history</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Delete historical Net Worth chart snapshots and restart the chart from today's current value. Accounts, transactions, budgets, goals, and investments are preserved.
          </p>
          <Button
            type="button"
            variant="ghost"
            className="mt-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setOpen(true)}
          >
            Reset history
          </Button>
        </div>
      </div>

      <AlertDialog open={open} onOpenChange={(nextOpen) => {
        if (mutation.isPending) return
        setOpen(nextOpen)
        if (!nextOpen) setConfirmation("")
      }}>
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Net Worth history?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your historical Net Worth chart points and starts again from today's current financial value.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl bg-destructive/8 p-3 text-sm leading-6 text-muted-foreground ring-1 ring-destructive/20">
            Your accounts, transactions, budgets, goals, and investments will not be deleted.
          </div>
          <label className="space-y-2 text-sm font-medium">
            <span>Type RESET to confirm</span>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={mutation.isPending}
              aria-label="Type RESET to confirm Net Worth history reset"
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmReset}
              disabled={confirmation !== "RESET" || mutation.isPending}
            >
              {mutation.isPending && <LoaderCircle className="animate-spin" />}
              Reset history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
