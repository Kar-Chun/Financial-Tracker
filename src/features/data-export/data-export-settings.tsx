import { useEffect, useRef, useState } from "react"
import { Download, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/features/auth/auth-context"
import { prepareDataExport } from "./export-service"
import { canShareExport, downloadExport } from "./export-file"

export function DataExportSettings() {
  const { user } = useAuth()
  return user ? <UserDataExport key={user.id} userId={user.id} /> : null
}

function UserDataExport({ userId }: { userId: string }) {
  const [pending, setPending] = useState(false)
  const [readyFile, setReadyFile] = useState<File | null>(null)
  const [status, setStatus] = useState("")
  const busy = useRef(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  const prepare = async () => {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setReadyFile(null)
    setStatus("Preparing export…")
    try {
      const file = await prepareDataExport(userId)
      if (!active.current) return
      if (canShareExport(file)) setReadyFile(file)
      else downloadExport(file)
      setStatus("Export ready.")
    } catch {
      if (active.current) setStatus("Could not prepare your export. Try again.")
    } finally {
      busy.current = false
      if (active.current) setPending(false)
    }
  }

  const share = async () => {
    if (!readyFile || busy.current) return
    busy.current = true
    setPending(true)
    try {
      // A separate explicit click preserves Web Share's transient activation.
      await navigator.share({ files: [readyFile], title: "Ledgerly export" })
      if (active.current) setReadyFile(null)
    } catch (error) {
      if (active.current && !(error instanceof DOMException && error.name === "AbortError")) {
        setStatus("Sharing is unavailable. Use Download ZIP to save your export.")
      }
    } finally {
      busy.current = false
      if (active.current) setPending(false)
    }
  }

  return (
    <Card className="rounded-none bg-transparent ring-0">
      <CardHeader className="px-0"><CardTitle>Data &amp; Privacy</CardTitle></CardHeader>
      <CardContent className="space-y-4 px-0">
        <div>
          <p className="text-sm font-medium">Export my data</p>
          <p className="mt-1 text-sm text-muted-foreground">Download a copy of your Ledgerly data.</p>
        </div>
        <p className="text-sm text-muted-foreground">This export contains personal financial information. Store it securely.</p>
        <Button type="button" onClick={() => void prepare()} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : <Download />}
          {pending ? "Preparing export…" : "Export Ledgerly data"}
        </Button>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{status}</p>
        {readyFile && <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => void share()} disabled={pending}>Share / Save to Files</Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => {
            downloadExport(readyFile)
            setReadyFile(null)
          }}>Download ZIP</Button>
        </div>}
      </CardContent>
    </Card>
  )
}
