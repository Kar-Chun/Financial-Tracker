import { formatShortDate } from "@/lib/dates"

export type NetWorthChartDatum = {
  snapshotDate: string
  totalValueMinor: number
}

export const netWorthChartKeys = {
  snapshotDate: "snapshotDate",
  totalValueMinor: "totalValueMinor",
} as const

export function formatSnapshotTooltipLabel(label: unknown) {
  return formatShortDate(label)
}
