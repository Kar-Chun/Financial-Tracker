import type { ComponentType, ReactNode } from "react"
import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"

export function PageTitle({ title, description, eyebrow }: { title: string; description?: string; eyebrow?: string }) {
  return <div className="min-w-0">
    {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
    <h1 className="break-words font-serif text-[2rem] leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{title}</h1>
    {description && <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>}
  </div>
}

export function SectionHeader({ id, title, href, linkLabel = "View all" }: { id: string; title: string; href?: string; linkLabel?: string }) {
  return <div className="flex min-h-11 items-center justify-between gap-3">
    <h2 id={id} className="section-heading">{title}</h2>
    {href && <Link to={href} className="inline-flex min-h-11 shrink-0 items-center text-xs font-medium text-brand-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">{linkLabel}</Link>}
  </div>
}

/** Already-formatted values only: financial calculations remain in the caller/read model. */
export function ValueSummary({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return <div className="insight-surface min-w-0 p-3.5">
    <p className="text-xs leading-5 text-muted-foreground">{label}</p>
    <p className={cn("mt-1 break-words text-base font-semibold tabular-nums [overflow-wrap:anywhere]", tone === "positive" && "text-positive", tone === "negative" && "text-negative")}>{value}</p>
  </div>
}

export function FilterPill({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn(
    "min-h-11 shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
    active ? "border-primary/60 bg-primary text-primary-foreground" : "border-border/40 bg-surface text-secondary-foreground hover:bg-accent/60",
  )}>{children}</button>
}

export function MetricTile({ label, value, detail, icon: Icon, className }: {
  label: string; value: string; detail: ReactNode; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; className?: string
}) {
  return <div className={cn("insight-surface h-full min-w-0 p-3.5 sm:p-5", className)}>
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-brand-secondary" aria-hidden={true} />
      <p className="text-xs leading-5 text-secondary-foreground">{label}</p>
    </div>
    <p className="mt-2 break-words text-[clamp(1.1rem,4.9vw,1.5rem)] leading-snug font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere]">{value}</p>
    <div className="mt-1.5 text-xs leading-5 text-muted-foreground">{detail}</div>
  </div>
}
