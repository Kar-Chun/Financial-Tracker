import { describe, expectTypeOf, it } from "vitest"

import type { Database } from "@/types/database"
import type { Database as GeneratedDatabase } from "@/types/database.generated"

describe("generated Supabase database contract (checked by TypeScript during build)", () => {
  it("keeps exact NUMERIC inputs as decimal strings in the client contract", () => {
    type GeneratedTradeArgs = GeneratedDatabase["public"]["Functions"]["record_investment_trade"]["Args"]
    type TradeArgs = Database["public"]["Functions"]["record_investment_trade"]["Args"]
    type FxArgs = Database["public"]["Functions"]["upsert_manual_fx_rate"]["Args"]

    expectTypeOf<GeneratedTradeArgs["p_quantity"]>().toEqualTypeOf<number>()
    expectTypeOf<TradeArgs["p_quantity"]>().toEqualTypeOf<string>()
    expectTypeOf<TradeArgs["p_unit_price"]>().toEqualTypeOf<string>()
    expectTypeOf<FxArgs["p_rate"]>().toEqualTypeOf<string>()
  })
})
