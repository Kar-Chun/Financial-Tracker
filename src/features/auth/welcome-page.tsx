import { ArrowRight, BadgeDollarSign, ChartSpline, ShieldCheck } from "lucide-react"
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
    <main className="min-h-svh bg-[radial-gradient(circle_at_top_right,oklch(0.28_0.08_254),transparent_38%)] px-4">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col">
        <header className="flex items-center justify-between py-5">
          <AppLogo />
          <Link to="/login" className={buttonVariants({ variant: "ghost" })}>
            Log in
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <span className="inline-flex rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold text-primary shadow-xs">
              Secure personal finance tracking
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
              Your finances, clear and connected.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Ledgerly is a calm home for bank, cash, investment, income, expense,
              and transfer records—protected by your own account.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/dashboard" className={buttonVariants({ size: "lg" })}>
                Open dashboard <ArrowRight />
              </Link>
              <Link
                to="/signup"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "bg-background/80")}
              >
                Create an account
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border bg-card/90 p-3 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="rounded-2xl bg-background/80 p-6 sm:p-8">
              <p className="text-sm text-slate-400">Your private workspace</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                A clearer daily money habit
              </p>
              <div className="mt-10 flex h-32 items-end gap-2" aria-hidden="true">
                {[38, 46, 43, 55, 59, 68, 63, 76, 72, 84, 88, 96].map((height, index) => (
                  <span
                    key={`${height}-${index}`}
                    className="flex-1 rounded-t bg-primary/80"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {highlights.map(({ icon: Icon, label }) => (
                  <div key={label} className="rounded-xl bg-white/8 p-3">
                    <Icon className="size-4 text-primary" />
                    <p className="mt-3 text-xs leading-5 text-slate-300">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
