import { buttonVariants } from "@/components/ui/button-variants"
import { PageTitle } from "@/components/shared/finance-ui"

import { ArrowLeft } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

import { Skeleton } from "@/components/ui/skeleton"
import { useProfile } from "@/features/auth/profile-service"
import { GoalForm } from "@/features/goals/goal-form"

export function NewGoalPage() {
  const profileQuery = useProfile()
  const navigate = useNavigate()
  return <section className="mx-auto flex min-h-svh w-full max-w-2xl flex-col bg-background lg:min-h-[calc(100vh-4.5rem)] ">
    <header className="sticky top-0 z-20 grid min-h-18 grid-cols-[3rem_1fr] items-center border-b border-border/20 bg-background/95 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:static lg:bg-transparent lg:pt-0">
      <Link to="/goals" aria-label="Back to goals" data-slot="button" className={buttonVariants({ variant: "ghost", size: "icon" })}><ArrowLeft /></Link>
      <div className="min-w-0 py-4"><PageTitle title="Savings Goal" eyebrow="New" /></div>
    </header>
    {profileQuery.isLoading ? <div className="space-y-5 px-5 py-7"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-24" /></div> : profileQuery.data ? <GoalForm entryPage currencyCode={profileQuery.data.base_currency} onCancel={() => navigate("/goals")} onSaved={(id) => navigate(`/goals/${id}`, { replace: true })} /> : <p className="p-8 text-center text-sm text-muted-foreground">Your profile could not be loaded.</p>}
  </section>
}
