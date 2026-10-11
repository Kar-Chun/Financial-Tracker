import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve("supabase/migrations/202609100001_add_transaction_note_suggestions.sql"),
  "utf8",
).toLowerCase()

describe("transaction Note suggestion RPC (static SQL checks)", () => {
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
