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
    <main className="min-h-svh bg-[radial-gradient(circle_at_top_right,oklch(0.28_0.08_254),transparent_38%)] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col">
        <header className="flex items-center justify-between pt-[calc(env(safe-area-inset-top)+1rem)] pb-4">
          <AppLogo />
          <Link to="/login" className={cn(buttonVariants({ variant: "ghost" }), "min-h-11 px-3")}>
            Log in
          </Link>
        </header>

        <section className="grid flex-1 content-start gap-10 pt-8 pb-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,0.72fr)] lg:content-center lg:items-center lg:gap-16 lg:py-16">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold text-primary shadow-xs">
              Secure personal finance tracking
            </span>
            <h1 className="mt-5 text-[clamp(2.5rem,11vw,4.5rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">
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

          <div className="grid gap-2.5 rounded-2xl bg-card/55 p-3 ring-1 ring-white/5 sm:grid-cols-3 lg:grid-cols-1 lg:p-4" aria-label="Ledgerly principles">
            {highlights.map(({ icon: Icon, label }) => (
              <div key={label} className="flex min-h-16 items-center gap-3 rounded-xl bg-background/35 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
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
