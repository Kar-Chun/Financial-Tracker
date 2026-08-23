import { ArrowLeft, Target } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfile } from "@/features/auth/profile-service"
import { GoalForm } from "@/features/goals/goal-form"

export function NewGoalPage() {
  const profileQuery = useProfile()
  const navigate = useNavigate()
  return <section className="mx-auto flex min-h-svh w-full max-w-2xl flex-col bg-background lg:min-h-[calc(100vh-4.5rem)] lg:rounded-3xl lg:bg-card/45 lg:ring-1 lg:ring-white/5">
    <header className="sticky top-0 z-20 grid min-h-18 grid-cols-[3rem_1fr_3rem] items-center border-b border-border/20 bg-background/95 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:static lg:bg-transparent lg:pt-0">
      <Button variant="ghost" size="icon" aria-label="Back to goals" render={<Link to="/goals" />}><ArrowLeft /></Button>
      <div className="text-center"><p className="eyebrow">New</p><h1 className="text-lg font-semibold">Savings Goal</h1></div><Target className="mx-auto size-5 text-primary" />
    </header>
    {profileQuery.isLoading ? <div className="space-y-5 px-5 py-7"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-24" /></div> : profileQuery.data ? <GoalForm entryPage currencyCode={profileQuery.data.base_currency} onCancel={() => navigate("/goals")} onSaved={(id) => navigate(`/goals/${id}`, { replace: true })} /> : <p className="p-8 text-center text-sm text-muted-foreground">Your profile could not be loaded.</p>}
  </section>
}
