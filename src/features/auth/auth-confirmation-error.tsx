import { buttonVariants } from "@/components/ui/button-variants"

/** Outside the router so malformed links cannot fall into a generic route error. */
export function AuthConfirmationError() {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-5 py-[calc(env(safe-area-inset-top)+1.5rem)]">
      <section className="insight-surface w-full max-w-md space-y-4 p-5" aria-labelledby="confirmation-error-title">
        <p className="eyebrow">Ledgerly</p>
        <h1 id="confirmation-error-title" className="text-xl font-semibold">Confirmation link could not be verified</h1>
        <p role="alert" className="text-sm leading-6 text-muted-foreground">
          This confirmation link is invalid, expired, or could not be verified. Try opening the latest email again.
          If you already confirmed your email, log in. Otherwise, sign up again to request a new confirmation email.
        </p>
        <div className="flex flex-wrap gap-3">
          {/* A clean navigation clears the failed one-time return, not the session. */}
          <a href="/login" className={buttonVariants()}>Log in</a>
          <a href="/signup" className={buttonVariants({ variant: "outline" })}>Sign up</a>
        </div>
      </section>
    </main>
  )
}
