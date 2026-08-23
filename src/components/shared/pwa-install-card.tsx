import { Download, Share, Smartphone } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePwaInstall } from "@/lib/pwa-install"

export function PwaInstallCard() {
  const { canInstall, install, isIos, isStandalone } = usePwaInstall()

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2"><Smartphone className="size-4" /> Install on this device</CardTitle>
      </CardHeader>
      <CardContent>
        {isStandalone ? (
          <p className="text-sm text-muted-foreground">Finance Tracker is running as an installed app.</p>
        ) : canInstall ? (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Install Finance Tracker for quicker home-screen access.</p>
            <Button onClick={() => void install().then((installed) => installed && toast.success("Finance Tracker installed."))}><Download /> Install app</Button>
          </div>
        ) : isIos ? (
          <div className="flex gap-3 text-sm text-muted-foreground">
            <Share className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>Open this site in Safari, tap <strong className="text-foreground">Share</strong>, then choose <strong className="text-foreground">Add to Home Screen</strong>.</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Use your browser menu and choose Install app or Add to Home Screen when available.</p>
        )}
      </CardContent>
    </Card>
  )
}
