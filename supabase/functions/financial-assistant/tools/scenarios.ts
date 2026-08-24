export type ScenarioInput =
  | { type: "monthly_surplus"; income_minor: number; spending_minor: number }
  | { type: "reduce_spending"; current_spending_minor: number; reduction_minor: number }
  | { type: "months_to_goal"; remaining_minor: number; monthly_saving_minor: number }
  | { type: "budget_remaining"; budget_minor: number; spending_minor: number }

export function calculateScenario(input: ScenarioInput) {
  for (const [key, value] of Object.entries(input)) {
    if (key.endsWith("_minor") && (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) throw new Error(`${key} must be a non-negative safe integer.`)
  }
  switch (input.type) {
    case "monthly_surplus": return { type: input.type, surplus_minor: input.income_minor - input.spending_minor, hypothetical: true }
    case "reduce_spending": return { type: input.type, scenario_spending_minor: Math.max(input.current_spending_minor - input.reduction_minor, 0), hypothetical: true }
    case "budget_remaining": return { type: input.type, remaining_minor: input.budget_minor - input.spending_minor, hypothetical: true }
    case "months_to_goal":
      if (input.monthly_saving_minor <= 0) throw new Error("monthly_saving_minor must be greater than zero.")
      return { type: input.type, months: Math.ceil(input.remaining_minor / input.monthly_saving_minor), hypothetical: true }
  }
}
