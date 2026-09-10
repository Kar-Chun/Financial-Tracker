import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve("supabase/migrations/202609100001_add_transaction_note_suggestions.sql"),
  "utf8",
).toLowerCase()

describe("transaction Note suggestion RPC", () => {
  it("is authenticated, user-owned, read-only, and search-path hardened", () => {
    expect(migration).toContain("v_user_id uuid := auth.uid()")
    expect(migration).toContain("transaction_record.user_id = v_user_id")
    expect(migration).not.toContain("p_user_id")
    expect(migration).toContain("security definer\nset search_path = ''")
    expect(migration).toContain("stable")
    expect(migration).toContain("grant execute on function public.get_transaction_note_suggestions")
    expect(migration).toContain("to authenticated")
    expect(migration).not.toMatch(/\bexecute\s+(?:format\s*\(|\()/u)
  })

  it("enforces three results, two non-whitespace characters, and type isolation", () => {
    expect(migration).toContain("least(greatest(coalesce(p_limit, 3), 1), 3)")
    expect(migration).toContain("limit v_limit")
    expect(migration).toContain("char_length(pg_catalog.regexp_replace(v_query, '[[:space:]]', '', 'g')) < 2")
    expect(migration).toContain("p_transaction_type not in ('expense', 'income')")
    expect(migration).toContain("transaction_record.transaction_type = p_transaction_type")
  })

  it("excludes deleted/blank Notes and performs case-insensitive deduplication", () => {
    expect(migration).toContain("transaction_record.deleted_at is null")
    expect(migration).toContain("transaction_record.description is not null")
    expect(migration).toContain("btrim(transaction_record.description) <> ''")
    expect(migration).toContain("as normalized_note")
    expect(migration).toContain("group by matching.normalized_note")
    expect(migration).toContain("pg_catalog.lower(")
  })

  it("ranks match quality, frequency, then recency on the server", () => {
    expect(migration).toContain("then 1")
    expect(migration).toContain("regexp_split_to_table")
    expect(migration).toContain("then 2")
    expect(migration).toContain("else 3")
    expect(migration).toContain("summary.match_rank")
    expect(migration).toContain("summary.usage_count desc")
    expect(migration).toContain("summary.last_used_on desc")
    expect(migration).toContain("display_choice.created_at desc")
  })

  it("chooses only the most recently used still-active category owned by the caller", () => {
    expect(migration).toContain("category.user_id = v_user_id")
    expect(migration).toContain("category.category_type = p_transaction_type")
    expect(migration).toContain("category.archived_at is null")
    expect(migration).toContain("order by category_match.transaction_date desc, category_match.created_at desc")
    expect(migration).toContain("parent.name || ' › ' || category.name")
  })
})

type Fixture = {
  categoryActive: boolean
  categoryId: string | null
  deleted?: boolean
  note: string | null
  transactionType: "expense" | "income"
  usedAt: number
}

function suggestions(fixtures: Fixture[], query: string, transactionType: Fixture["transactionType"]) {
  const normalizedQuery = normalize(query)
  const groups = new Map<string, Fixture[]>()
  for (const fixture of fixtures) {
    const normalizedNote = normalize(fixture.note ?? "")
    if (fixture.deleted || fixture.transactionType !== transactionType || !normalizedNote.includes(normalizedQuery)) continue
    groups.set(normalizedNote, [...(groups.get(normalizedNote) ?? []), fixture])
  }

  return [...groups.entries()].map(([normalizedNote, matches]) => {
    const newest = [...matches].sort((a, b) => b.usedAt - a.usedAt)[0]
    const category = [...matches].filter((item) => item.categoryActive).sort((a, b) => b.usedAt - a.usedAt)[0]
    const words = normalizedNote.split(/[^a-z0-9]+/u)
    return {
      note: newest.note?.trim(),
      categoryId: category?.categoryId ?? null,
      frequency: matches.length,
      recency: newest.usedAt,
      rank: normalizedNote.startsWith(normalizedQuery) ? 1 : words.some((word) => word.startsWith(normalizedQuery)) ? 2 : 3,
    }
  }).sort((a, b) => a.rank - b.rank || b.frequency - a.frequency || b.recency - a.recency).slice(0, 3)
}

function normalize(value: string) {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase()
}

describe("Note matching reference cases", () => {
  const fixtures: Fixture[] = [
    { note: "Watermelon Juice", transactionType: "expense", categoryId: "drinks-old", categoryActive: true, usedAt: 1 },
    { note: "watermelon juice", transactionType: "expense", categoryId: "archived", categoryActive: false, usedAt: 5 },
    { note: "WATERMELON JUICE", transactionType: "expense", categoryId: "drinks-new", categoryActive: true, usedAt: 4 },
    { note: "Wanton Mee", transactionType: "expense", categoryId: "food", categoryActive: true, usedAt: 3 },
    { note: "Watsons", transactionType: "expense", categoryId: "personal", categoryActive: true, usedAt: 2 },
    { note: "Hawker Lunch", transactionType: "expense", categoryId: "food", categoryActive: true, usedAt: 9 },
    { note: "Water allowance", transactionType: "income", categoryId: "income", categoryActive: true, usedAt: 9 },
    { note: "Waste", transactionType: "expense", categoryId: "other", categoryActive: true, usedAt: 10, deleted: true },
    { note: "   ", transactionType: "expense", categoryId: null, categoryActive: false, usedAt: 11 },
  ]

  it("matches case-insensitively, deduplicates spelling variants, and caps at three", () => {
    const result = suggestions(fixtures, "WAT", "expense")
    expect(result).toHaveLength(2)
    expect(result.map(({ note }) => note)).toEqual(["watermelon juice", "Watsons"])
    expect(result[0]).toMatchObject({ frequency: 3, categoryId: "drinks-new" })
  })

  it("keeps Expense and Income history isolated and excludes deleted/blank Notes", () => {
    expect(suggestions(fixtures, "wa", "income").map(({ note }) => note)).toEqual(["Water allowance"])
    expect(suggestions(fixtures, "wa", "expense").map(({ note }) => note)).not.toContain("Water allowance")
    expect(suggestions(fixtures, "wa", "expense").map(({ note }) => note)).not.toContain("Waste")
  })

  it("uses match quality before frequency and recency while keeping recent casing", () => {
    const ranked = suggestions([
      { note: "Hawker wa lunch", transactionType: "expense", categoryId: "food", categoryActive: true, usedAt: 99 },
      { note: "Hawaii lunch", transactionType: "expense", categoryId: "food", categoryActive: true, usedAt: 50 },
      { note: "Wanton Mee", transactionType: "expense", categoryId: "food", categoryActive: true, usedAt: 1 },
    ], "wa", "expense")
    expect(ranked.map(({ note }) => note)).toEqual(["Wanton Mee", "Hawker wa lunch", "Hawaii lunch"])
  })

  it("uses frequency before recency and recency to break equal-frequency ties", () => {
    const ranked = suggestions([
      { note: "Water", transactionType: "expense", categoryId: "drinks", categoryActive: true, usedAt: 1 },
      { note: "water", transactionType: "expense", categoryId: "drinks", categoryActive: true, usedAt: 2 },
      { note: "Waffles", transactionType: "expense", categoryId: "food", categoryActive: true, usedAt: 20 },
      { note: "Wallet", transactionType: "expense", categoryId: "other", categoryActive: true, usedAt: 30 },
    ], "wa", "expense")

    expect(ranked.map(({ note }) => note)).toEqual(["water", "Wallet", "Waffles"])
  })
})
