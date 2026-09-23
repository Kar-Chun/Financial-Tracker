import type { ExportResponse } from "@/features/data-export/export-schema"

const fixture: ExportResponse = {
  "format": "ledgerly-backup",
  "version": 1,
  "exported_at": "2026-09-23T12:00:00+00:00",
  "app": {
    "name": "Ledgerly"
  },
  "data": {
    "profiles": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "display_name": "A, \"quoted\"\nname",
        "base_currency": "SGD",
        "timezone": "Asia/Singapore",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "accounts": [
      {
        "id": "00000000-0000-4000-8000-000000000002",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "name": "Cash",
        "account_type": "cash",
        "institution": null,
        "currency_code": "SGD",
        "opening_balance_minor": "9007199254740993",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00",
        "archived_at": null,
        "investment_tracking_mode": "simple",
        "detailed_started_on": null,
        "detailed_started_at": null
      },
      {
        "id": "00000000-0000-4000-8000-000000000003",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "name": "Archived bank",
        "account_type": "bank",
        "institution": null,
        "currency_code": "SGD",
        "opening_balance_minor": "9007199254740993",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00",
        "archived_at": "2026-09-23T12:00:00+00:00",
        "investment_tracking_mode": "simple",
        "detailed_started_on": null,
        "detailed_started_at": null
      },
      {
        "id": "00000000-0000-4000-8000-000000000004",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "name": "Detailed USD",
        "account_type": "investment",
        "institution": null,
        "currency_code": "USD",
        "opening_balance_minor": "9007199254740993",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00",
        "archived_at": null,
        "investment_tracking_mode": "detailed",
        "detailed_started_on": "2026-09-23",
        "detailed_started_at": "2026-09-23T12:00:00+00:00"
      },
      {
        "id": "00000000-0000-4000-8000-000000000005",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "name": "Simple investment",
        "account_type": "investment",
        "institution": null,
        "currency_code": "SGD",
        "opening_balance_minor": "9007199254740993",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00",
        "archived_at": null,
        "investment_tracking_mode": "simple",
        "detailed_started_on": null,
        "detailed_started_at": null
      }
    ],
    "categories": [
      {
        "id": "00000000-0000-4000-8000-000000000006",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "name": "Food",
        "parent_id": null,
        "category_type": "expense",
        "created_at": "2026-09-23T12:00:00+00:00",
        "archived_at": null
      },
      {
        "id": "00000000-0000-4000-8000-000000000007",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "name": "Lunch",
        "parent_id": "00000000-0000-4000-8000-000000000006",
        "category_type": "expense",
        "created_at": "2026-09-23T12:00:00+00:00",
        "archived_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "transactions": [
      {
        "id": "00000000-0000-4000-8000-000000000008",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "transaction_type": "transfer",
        "category_id": null,
        "description": "Move money",
        "transaction_date": "2026-09-23",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00",
        "deleted_at": null,
        "is_reconciliation": false
      },
      {
        "id": "00000000-0000-4000-8000-000000000009",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "transaction_type": "adjustment",
        "category_id": null,
        "description": "Reconcile",
        "transaction_date": "2026-09-23",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00",
        "deleted_at": null,
        "is_reconciliation": true
      },
      {
        "id": "00000000-0000-4000-8000-000000000010",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "transaction_type": "expense",
        "category_id": "00000000-0000-4000-8000-000000000007",
        "description": "=HYPERLINK(\"bad\")",
        "transaction_date": "2026-09-23",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00",
        "deleted_at": "2026-09-23T12:00:00+00:00",
        "is_reconciliation": false
      }
    ],
    "transaction_entries": [
      {
        "id": "00000000-0000-4000-8000-000000000011",
        "transaction_id": "00000000-0000-4000-8000-000000000008",
        "account_id": "00000000-0000-4000-8000-000000000002",
        "amount_minor": "-550",
        "created_at": "2026-09-23T12:00:00+00:00"
      },
      {
        "id": "00000000-0000-4000-8000-000000000012",
        "transaction_id": "00000000-0000-4000-8000-000000000008",
        "account_id": "00000000-0000-4000-8000-000000000003",
        "amount_minor": "550",
        "created_at": "2026-09-23T12:00:00+00:00"
      },
      {
        "id": "00000000-0000-4000-8000-000000000013",
        "transaction_id": "00000000-0000-4000-8000-000000000009",
        "account_id": "00000000-0000-4000-8000-000000000002",
        "amount_minor": "-25",
        "created_at": "2026-09-23T12:00:00+00:00"
      },
      {
        "id": "00000000-0000-4000-8000-000000000014",
        "transaction_id": "00000000-0000-4000-8000-000000000010",
        "account_id": "00000000-0000-4000-8000-000000000002",
        "amount_minor": "-9007199254740993",
        "created_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "investment_valuations": [
      {
        "id": "00000000-0000-4000-8000-000000000105",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "account_id": "00000000-0000-4000-8000-000000000005",
        "native_value_minor": "1200",
        "base_value_minor": "1200",
        "valued_at": "2026-09-23",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "monthly_budgets": [
      {
        "id": "00000000-0000-4000-8000-000000000015",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "month_start": "2026-09-01",
        "currency_code": "SGD",
        "amount_minor": "1200",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "category_budgets": [
      {
        "id": "00000000-0000-4000-8000-000000000107",
        "monthly_budget_id": "00000000-0000-4000-8000-000000000015",
        "category_id": "00000000-0000-4000-8000-000000000006",
        "amount_minor": "1200",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "savings_goals": [
      {
        "id": "00000000-0000-4000-8000-000000000016",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "name": "Travel",
        "target_amount_minor": "1200",
        "currency_code": "SGD",
        "target_date": null,
        "note": null,
        "archived_at": "2026-09-23T12:00:00+00:00",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "goal_allocations": [
      {
        "id": "00000000-0000-4000-8000-000000000109",
        "goal_id": "00000000-0000-4000-8000-000000000016",
        "amount_minor": "350",
        "allocation_date": "2026-09-23",
        "note": null,
        "created_at": "2026-09-23T12:00:00+00:00"
      },
      {
        "id": "00000000-0000-4000-8000-000000000017",
        "goal_id": "00000000-0000-4000-8000-000000000016",
        "amount_minor": "-100",
        "allocation_date": "2026-09-23",
        "note": null,
        "created_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "net_worth_snapshots": [
      {
        "id": "00000000-0000-4000-8000-000000000110",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "snapshot_date": "2026-09-23",
        "bank_value_base_minor": "1200",
        "cash_value_base_minor": "1200",
        "investment_value_base_minor": "1200",
        "total_value_base_minor": "3600",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "manual_fx_rates": [
      {
        "id": "00000000-0000-4000-8000-000000000111",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "from_currency": "USD",
        "to_currency": "SGD",
        "rate": "1.354712345678",
        "rate_date": "2026-09-23",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "investment_holdings": [
      {
        "id": "00000000-0000-4000-8000-000000000018",
        "account_id": "00000000-0000-4000-8000-000000000004",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "symbol": "TEST",
        "name": "Holding",
        "asset_type": "stock",
        "currency_code": "USD",
        "archived_at": null,
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "investment_trades": [
      {
        "id": "00000000-0000-4000-8000-000000000113",
        "holding_id": "00000000-0000-4000-8000-000000000018",
        "account_id": "00000000-0000-4000-8000-000000000004",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "trade_type": "opening_position",
        "quantity": "12345678901234567890.1234567890",
        "unit_price": "231.1234567890",
        "fee_minor": "1200",
        "cash_effect_minor": "1200",
        "cost_basis_effect_minor": "1200",
        "realized_gain_minor": "1200",
        "trade_date": "2026-09-23",
        "note": null,
        "created_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "investment_prices": [
      {
        "id": "00000000-0000-4000-8000-000000000114",
        "holding_id": "00000000-0000-4000-8000-000000000018",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "price": "231.1234567890",
        "priced_at": "2026-09-23",
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "investment_cash_events": [
      {
        "id": "00000000-0000-4000-8000-000000000115",
        "account_id": "00000000-0000-4000-8000-000000000004",
        "holding_id": "00000000-0000-4000-8000-000000000018",
        "user_id": "00000000-0000-4000-8000-000000000001",
        "event_type": "dividend",
        "amount_minor": "1200",
        "event_date": "2026-09-23",
        "note": null,
        "created_at": "2026-09-23T12:00:00+00:00"
      }
    ],
    "notification_preferences": [
      {
        "user_id": "00000000-0000-4000-8000-000000000001",
        "daily_reminder_enabled": true,
        "created_at": "2026-09-23T12:00:00+00:00",
        "updated_at": "2026-09-23T12:00:00+00:00"
      }
    ]
  },
  "record_counts": {
    "profiles": 1,
    "accounts": 4,
    "categories": 2,
    "transactions": 3,
    "transaction_entries": 4,
    "investment_valuations": 1,
    "monthly_budgets": 1,
    "category_budgets": 1,
    "savings_goals": 1,
    "goal_allocations": 2,
    "net_worth_snapshots": 1,
    "manual_fx_rates": 1,
    "investment_holdings": 1,
    "investment_trades": 1,
    "investment_prices": 1,
    "investment_cash_events": 1,
    "notification_preferences": 1
  }
}

export function makeExportFixture(): ExportResponse {
  return structuredClone(fixture)
}
