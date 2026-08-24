import type { ToolDeclaration } from "../types.ts"
import { resolvePeriod } from "./date-periods.ts"
import { calculateScenario, type ScenarioInput } from "./scenarios.ts"

export type RpcClient = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>
}

export type ToolContext = {
  client: RpcClient
  localDate: string
  baseCurrency: string
}

type RegisteredTool = {
  declaration: ToolDeclaration
  execute(args: unknown, context: ToolContext): Promise<unknown>
}

const periodProperties = {
  period: { type: "string", enum: ["this_month", "last_month", "last_3_months", "last_6_months", "this_year", "specific_month", "custom"] },
  month_start: { type: "string", description: "YYYY-MM-01, required for specific_month" },
  start_date: { type: "string", description: "YYYY-MM-DD, required for custom" },
  end_date: { type: "string", description: "YYYY-MM-DD, required for custom" },
}

export function createToolRegistry(): Map<string, RegisteredTool> {
  const entries: Array<[string, RegisteredTool]> = [
    ["get_financial_overview", tool(
      "get_financial_overview",
      "Get net worth, represented bank/cash and investments, and current-month income, expenses, and net cash flow.",
      emptySchema(),
      async (_args, context) => formatResult(await rpc(context, "get_ai_financial_overview"), context.baseCurrency),
    )],
    ["get_spending_summary", tool(
      "get_spending_summary",
      "Get authoritative expense analytics, category breakdown, trend, and previous equivalent period comparison.",
      objectSchema(periodProperties),
      async (args, context) => spendingResult(record(args), context),
    )],
    ["get_category_spending", tool(
      "get_category_spending",
      "Get spending for one readable parent category and its subcategories for a period.",
      objectSchema({ ...periodProperties, category_name: { type: "string" } }, ["category_name"]),
      async (args, context) => {
        const values = record(args)
        const name = requiredString(values.category_name, "category_name", 100)
        const result = await spendingResult(values, context) as Record<string, unknown>
        const categories = Array.isArray(result.categories) ? result.categories as Array<Record<string, unknown>> : []
        const category = categories.find((item) => typeof item.name === "string" && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())
        return { period: result.period, category: category ?? null, found: Boolean(category) }
      },
    )],
    ["search_transactions", tool(
      "search_transactions",
      "Search at most 20 non-deleted transactions by note, category, or account. Use largest order for biggest purchases.",
      objectSchema({ query: { type: "string" }, start_date: { type: "string" }, end_date: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20 }, order: { type: "string", enum: ["recent", "largest"] } }),
      async (args, context) => {
        const values = record(args)
        const limit = optionalInteger(values.limit, 20, 1, 20)
        const data = await rpc(context, "search_ai_transactions", {
          p_query: optionalString(values.query, 120),
          p_start_date: optionalDate(values.start_date),
          p_end_date: optionalDate(values.end_date),
          p_limit: limit,
          p_order: optionalEnum(values.order, ["recent", "largest"], "recent"),
        })
        return formatResult(data, context.baseCurrency)
      },
    )],
    ["get_budget_status", tool(
      "get_budget_status",
      "Get the authoritative budget, spending, safe daily spend, pace, and category limits for a calendar month.",
      objectSchema({ month_start: { type: "string", description: "YYYY-MM-01; defaults to current month" } }),
      async (args, context) => {
        const month = optionalDate(record(args).month_start) ?? `${context.localDate.slice(0, 7)}-01`
        if (!month.endsWith("-01")) throw new Error("month_start must be the first day of a month.")
        return formatResult(omitIdentifiers(await rpc(context, "get_monthly_budget_summary", { p_month_start: month })), context.baseCurrency)
      },
    )],
    ["get_savings_goals", tool(
      "get_savings_goals",
      "Get active savings-goal progress and available/unallocated cash. Optionally filter by readable goal name.",
      objectSchema({ goal_name: { type: "string" } }),
      async (args, context) => {
        const result = await rpc(context, "get_savings_goals_summary", { p_include_archived: false }) as Record<string, unknown>
        const goalName = optionalString(record(args).goal_name, 100)
        const goals = Array.isArray(result.goals) ? result.goals as Array<Record<string, unknown>> : []
        const filtered = goalName
          ? goals.filter((goal) => typeof goal.name === "string" && goal.name.toLocaleLowerCase().includes(goalName.toLocaleLowerCase()))
          : goals
        return formatResult({ ...omitIdentifiers(result), goals: filtered.map(omitIdentifiers) }, context.baseCurrency)
      },
    )],
    ["get_investment_summary", tool(
      "get_investment_summary",
      "Get authoritative tracked investment value, account composition, gains supplied by the ledger, and missing-data warnings.",
      emptySchema(),
      async (_args, context) => formatResult(omitIdentifiers(await rpc(context, "get_investment_portfolio_summary")), context.baseCurrency),
    )],
    ["get_investment_account_summary", tool(
      "get_investment_account_summary",
      "Get holdings and trustworthy metrics for a Detailed investment account selected by its readable name.",
      objectSchema({ account_name: { type: "string" } }, ["account_name"]),
      async (args, context) => {
        const name = requiredString(record(args).account_name, "account_name", 100)
        const portfolio = await rpc(context, "get_investment_portfolio_summary") as Record<string, unknown>
        const accounts = Array.isArray(portfolio.accounts) ? portfolio.accounts as Array<Record<string, unknown>> : []
        const match = accounts.find((account) => typeof account.name === "string" && account.name.toLocaleLowerCase().includes(name.toLocaleLowerCase()))
        if (!match || typeof match.id !== "string") return { found: false, account_name: name }
        if (match.investment_tracking_mode !== "detailed") return formatResult({ found: true, account: omitIdentifiers(match), note: "This account uses simple manual valuation, so no holding ledger is available." }, context.baseCurrency)
        const detail = await rpc(context, "get_detailed_investment_account", { p_account_id: match.id }) as Record<string, unknown>
        return formatResult({ found: true, account: omitIdentifiers(detail.account), value: omitIdentifiers(detail.value), holdings: stripArray(detail.holdings) }, context.baseCurrency)
      },
    )],
    ["calculate_scenario", tool(
      "calculate_scenario",
      "Run exact hypothetical minor-unit arithmetic. Values are integer minor units and the result is never saved.",
      objectSchema({
        type: { type: "string", enum: ["monthly_surplus", "reduce_spending", "months_to_goal", "budget_remaining"] },
        income_minor: { type: "integer" }, spending_minor: { type: "integer" }, current_spending_minor: { type: "integer" },
        reduction_minor: { type: "integer" }, remaining_minor: { type: "integer" }, monthly_saving_minor: { type: "integer" }, budget_minor: { type: "integer" },
        income_amount: { type: "string", description: "Exact decimal amount supplied hypothetically by the user" },
        spending_amount: { type: "string" }, current_spending_amount: { type: "string" }, reduction_amount: { type: "string" },
        remaining_amount: { type: "string" }, monthly_saving_amount: { type: "string" }, budget_amount: { type: "string" },
      }, ["type"]),
      async (args, context) => formatResult(calculateScenario(validateScenario(record(args))), context.baseCurrency),
    )],
  ]
  return new Map(entries)
}

export function toolDeclarations(registry: Map<string, RegisteredTool>) { return [...registry.values()].map((item) => item.declaration) }

async function spendingResult(args: Record<string, unknown>, context: ToolContext) {
  const period = resolvePeriod(args, context.localDate)
  const data = await rpc(context, "get_spending_analytics", {
    p_start_date: period.startDate, p_end_date: period.endDate,
    p_previous_start_date: period.previousStartDate, p_previous_end_date: period.previousEndDate,
    p_trend_granularity: period.trendGranularity,
  })
  return formatResult(omitIdentifiers(data), context.baseCurrency)
}

async function rpc(context: ToolContext, name: string, args?: Record<string, unknown>) {
  const { data, error } = await context.client.rpc(name, args)
  if (error) throw new Error(`Approved finance tool failed: ${name}.`)
  return data
}

function tool(name: string, description: string, parameters: Record<string, unknown>, execute: RegisteredTool["execute"]): RegisteredTool { return { declaration: { name, description, parameters }, execute } }
function objectSchema(properties: Record<string, unknown>, required: string[] = []) { return { type: "object", properties, required, additionalProperties: false } }
function emptySchema() { return objectSchema({}) }
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Tool arguments must be an object."); return value as Record<string, unknown> }
function requiredString(value: unknown, name: string, max: number) { if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${name} is invalid.`); return value.trim() }
function optionalString(value: unknown, max: number) { if (value === undefined || value === null || value === "") return null; if (typeof value !== "string" || value.length > max) throw new Error("Text argument is invalid."); return value.trim() }
function optionalDate(value: unknown) { if (value === undefined || value === null || value === "") return null; if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new Error("Date argument is invalid."); return value }
function optionalInteger(value: unknown, fallback: number, min: number, max: number) { if (value === undefined) return fallback; if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) throw new Error("Integer argument is invalid."); return value as number }
function optionalEnum<T extends string>(value: unknown, options: readonly T[], fallback: T): T { if (value === undefined) return fallback; if (typeof value !== "string" || !options.includes(value as T)) throw new Error("Option is invalid."); return value as T }

function validateScenario(args: Record<string, unknown>): ScenarioInput {
  const type = requiredString(args.type, "type", 40)
  const minor = (name: string) => {
    const direct = args[`${name}_minor`]
    if (direct !== undefined) return optionalInteger(direct, -1, 0, Number.MAX_SAFE_INTEGER)
    const amount = args[`${name}_amount`]
    if (typeof amount !== "string") throw new Error(`${name} is required.`)
    return parseDecimalMinor(amount)
  }
  if (type === "monthly_surplus") return { type, income_minor: minor("income"), spending_minor: minor("spending") }
  if (type === "reduce_spending") return { type, current_spending_minor: minor("current_spending"), reduction_minor: minor("reduction") }
  if (type === "months_to_goal") return { type, remaining_minor: minor("remaining"), monthly_saving_minor: minor("monthly_saving") }
  if (type === "budget_remaining") return { type, budget_minor: minor("budget"), spending_minor: minor("spending") }
  throw new Error("Scenario type is invalid.")
}

function parseDecimalMinor(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim().replaceAll(",", ""))
  if (!match) throw new Error("Hypothetical amount must be a non-negative decimal with at most two places.")
  const minor = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0")
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Hypothetical amount is too large.")
  return Number(minor)
}

function formatResult(value: unknown, defaultCurrency: string): unknown {
  if (Array.isArray(value)) return value.map((item) => formatResult(item, defaultCurrency))
  if (!value || typeof value !== "object") return value
  const source = value as Record<string, unknown>
  const currency = typeof source.currency_code === "string" ? source.currency_code : defaultCurrency
  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(source)) {
    output[key] = formatResult(item, currency)
    if (key.endsWith("_minor") && typeof item === "number" && Number.isSafeInteger(item)) {
      output[`${key.slice(0, -6)}_formatted`] = formatMoney(item, currency)
    }
  }
  return output
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountMinor / 100)
}

function omitIdentifiers(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === "id" || key.endsWith("_id") || key === "user_id" || key === "created_at" || key === "updated_at") continue
    result[key] = Array.isArray(item) ? stripArray(item) : item && typeof item === "object" ? omitIdentifiers(item) : item
  }
  return result
}
function stripArray(value: unknown) { return Array.isArray(value) ? value.slice(0, 20).map((item) => omitIdentifiers(item)) : [] }
