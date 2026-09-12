import { buttonVariants } from "@/components/ui/button-variants"
import { AlertTriangle } from "lucide-react"
import { Link } from "react-router-dom"

import { AppLogo } from "@/components/shared/app-logo"
import { Button } from "@/components/ui/button"

export function RouteErrorPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-foreground">
      <section className="w-full max-w-md insight-surface p-5 text-center sm:p-6" aria-labelledby="route-error-heading">
        <AppLogo className="justify-center" />
        <span className="mx-auto mt-8 flex size-12 items-center justify-center rounded-lg bg-negative/10 text-negative">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </span>
        <h1 id="route-error-heading" className="mt-5 font-serif text-3xl tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This screen could not be displayed. Your financial changes have not been retried automatically.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Link to="/" data-slot="button" className={buttonVariants({ variant: "outline" })}>Return home</Link>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </section>
    </main>
  )
}
