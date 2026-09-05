import type { ReactNode } from "react"

import { Label } from "@/components/ui/label"

type InvestmentActionFieldProps = {
  children: ReactNode
  label: string
  htmlFor?: string
}

export function InvestmentActionField({ children, label, htmlFor }: InvestmentActionFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

export function InvestmentActionError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null
}
