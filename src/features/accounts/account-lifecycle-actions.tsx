import { Archive, LoaderCircle, RotateCcw, Trash2 } from "lucide-react"
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
import {
  useArchiveAccount,
  useDeleteAccountPermanently,
  useRestoreAccount,
} from "@/features/accounts/accounts-hooks"
import { getArchiveAssessment, type LifecycleAccount } from "@/features/accounts/account-lifecycle-logic"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

type AccountLifecycleActionsProps = {
  account: LifecycleAccount
  archived?: boolean
  baseCurrency?: string
  className?: string
  onDeleted?: () => void
  onRestored?: () => void
}

export function AccountLifecycleActions({
  account,
  archived = false,
  baseCurrency = "SGD",
  className,
  onDeleted,
  onRestored,
}: AccountLifecycleActionsProps) {
  const archiveMutation = useArchiveAccount()
  const restoreMutation = useRestoreAccount()
  const deleteMutation = useDeleteAccountPermanently()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const assessment = getArchiveAssessment(account, baseCurrency)

  const confirmArchive = () => {
    archiveMutation.mutate(account.id, {
      onSuccess: () => {
        toast.success("Account archived. Its financial history is preserved.")
        setArchiveOpen(false)
      },
      onError: (error) => toast.error(getErrorMessage(error, assessment.message)),
    })
  }

  const restore = () => {
    restoreMutation.mutate(account.id, {
      onSuccess: () => {
        toast.success("Account restored.")
        onRestored?.()
      },
      onError: (error) => toast.error(getErrorMessage(error, "The account could not be restored.")),
    })
  }

  const confirmDelete = () => {
    if (confirmation !== "DELETE") return
    deleteMutation.mutate(account.id, {
      onSuccess: (result) => {
        const purged = result.soft_deleted_transactions_purged
        toast.success(purged > 0
          ? `Account permanently deleted. ${purged} already-deleted ${purged === 1 ? "transaction was" : "transactions were"} purged.`
          : "Account permanently deleted.")
        setDeleteOpen(false)
        setConfirmation("")
        onDeleted?.()
      },
      onError: (error) => toast.error(getErrorMessage(error, "The account could not be permanently deleted.")),
    })
  }

  return (
    <>
      <div className={cn("flex flex-wrap gap-2", className)}>
        {archived ? (
          <Button size="sm" variant="outline" onClick={restore} disabled={restoreMutation.isPending || deleteMutation.isPending}>
            {restoreMutation.isPending ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
            Restore
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setArchiveOpen(true)} disabled={archiveMutation.isPending || deleteMutation.isPending}>
            <Archive /> Archive
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
          disabled={archiveMutation.isPending || restoreMutation.isPending || deleteMutation.isPending}
        >
          <Trash2 /> Delete permanently
        </Button>
      </div>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {account.name}?</AlertDialogTitle>
            <AlertDialogDescription>{assessment.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive} disabled={!assessment.allowed || archiveMutation.isPending}>
              {archiveMutation.isPending && <LoaderCircle className="animate-spin" />}
              Archive account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => {
        setDeleteOpen(open)
        if (!open) setConfirmation("")
      }}>
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete “{account.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This is intended for mistaken or test accounts. It cannot be undone, and the server will reject it if any active transaction uses this account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl bg-destructive/8 p-3 text-sm text-muted-foreground ring-1 ring-destructive/20">
            <p className="font-medium text-foreground">This may permanently remove:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>the account and its already-deleted transaction remnants</li>
              {account.account_type === "investment" && <li>manual investment valuations</li>}
              {account.investment_tracking_mode === "detailed" && <li>holdings, trades, prices, and investment cash events</li>}
            </ul>
          </div>
          <label className="space-y-2 text-sm font-medium">
            <span>Type DELETE to confirm</span>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label="Type DELETE to confirm permanent account deletion"
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
              disabled={confirmation !== "DELETE" || deleteMutation.isPending}
            >
              {deleteMutation.isPending && <LoaderCircle className="animate-spin" />}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
