import {
  ChartNoAxesCombined,
  CircleGauge,
  Landmark,
  PiggyBank,
  ReceiptText,
  Settings,
  Target,
  WalletCards,
  type LucideIcon,
} from "lucide-react"

export type NavigationItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: CircleGauge },
  { label: "Accounts", href: "/accounts", icon: WalletCards },
  { label: "Transactions", href: "/transactions", icon: ReceiptText },
  { label: "Investments", href: "/investments", icon: Landmark },
  { label: "Budgets", href: "/budgets", icon: PiggyBank },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
]

export const settingsNavigation: NavigationItem = {
  label: "Settings",
  href: "/settings",
  icon: Settings,
}
