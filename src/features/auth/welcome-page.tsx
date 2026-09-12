import { BadgeDollarSign, ChartSpline, ShieldCheck } from "lucide-react"
import { Link } from "react-router-dom"

import { AppLogo } from "@/components/shared/app-logo"
import { buttonVariants } from "@/components/ui/button-variants"
import { cn } from "@/lib/utils"

const highlights = [
  { icon: BadgeDollarSign, label: "One financial home" },
  { icon: ChartSpline, label: "Clear financial insights" },
  { icon: ShieldCheck, label: "Private by design" },
]

export function WelcomePage() {
  return (
    <main className="min-h-svh bg-background pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col">
        <header className="flex items-center justify-between pt-[calc(env(safe-area-inset-top)+1rem)] pb-4">
          <AppLogo />
          <Link to="/login" className={cn(buttonVariants({ variant: "ghost" }), "min-h-11 px-3")}>
            Log in
          </Link>
        </header>

        <section className="grid flex-1 content-start gap-7 pt-6 pb-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,0.72fr)] lg:content-center lg:items-center lg:gap-16 lg:py-16">
          <div className="max-w-2xl">
            <span className="section-heading">
              Secure personal finance tracking
            </span>
            <h1 className="mt-5 font-serif text-[clamp(2.25rem,10vw,4rem)] leading-[1.08] tracking-tight text-balance">
              Your finances, clear and connected.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Ledgerly is a calm home for bank, cash, investment, income, expense,
              and transfer records—protected by your own account.
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <Link to="/signup" className={cn(buttonVariants({ size: "lg" }), "h-12 px-5 sm:min-w-40")}>
                Create account
              </Link>
              <Link
                to="/login"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 bg-background/55 px-5 sm:min-w-32")}
              >
                Log in
              </Link>
            </div>
          </div>

          <div className="grid gap-0 border-y border-border/30 sm:grid-cols-3 lg:grid-cols-1" aria-label="Ledgerly principles">
            {highlights.map(({ icon: Icon, label }) => (
              <div key={label} className="flex min-h-16 items-center gap-3 border-b border-border/20 px-1 py-3 last:border-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-brand-secondary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium text-foreground/90">{label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
