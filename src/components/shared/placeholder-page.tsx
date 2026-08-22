import { ArrowRight, type LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

type PlaceholderPageProps = {
  title: string
  description: string
  icon: LucideIcon
}

export function PlaceholderPage({
  title,
  description,
  icon: Icon,
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-emerald-700">Foundation preview</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {description}
        </p>
      </header>

      <Card className="border-dashed bg-card/60 py-0 shadow-none">
        <CardContent className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
          <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Icon className="size-7" />
          </span>
          <h2 className="text-lg font-semibold">Ready for a future phase</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            This route and its place in the application shell are ready. Real data,
            forms, and financial workflows are intentionally not included yet.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            Architecture in place <ArrowRight className="size-4" />
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
