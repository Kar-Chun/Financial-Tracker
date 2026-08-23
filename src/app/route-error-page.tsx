import { AlertTriangle } from "lucide-react"
import { Link } from "react-router-dom"

import { AppLogo } from "@/components/shared/app-logo"
import { Button } from "@/components/ui/button"

export function RouteErrorPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-md rounded-3xl bg-card/75 p-6 text-center ring-1 ring-border/35 sm:p-8" aria-labelledby="route-error-heading">
        <AppLogo className="justify-center" />
        <span className="mx-auto mt-8 flex size-12 items-center justify-center rounded-full bg-negative/10 text-negative">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </span>
        <h1 id="route-error-heading" className="mt-5 text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This screen could not be displayed. Your financial changes have not been retried automatically.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" render={<Link to="/" />}>Return home</Button>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </section>
    </main>
  )
}
