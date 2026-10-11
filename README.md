# Ledgerly

Ledgerly is a personal finance app for keeping track of your money, spending and plans. It works in the browser and can be installed on your phone's home screen.

## What you can do

- Track bank, cash and investment accounts, record income and expenses, and transfer money between accounts.
- See your net worth, daily spending and spending trends on the dashboard and in Analytics.
- Set monthly budgets and plan savings goals without moving money between accounts.
- Track investments with simple manual valuations or detailed holdings, trades, prices and exchange rates.
- Ask the optional AI Assistant questions about your finances. It can explain your data but cannot change it.
- Turn on a daily spending reminder at 9 PM Singapore time.
- Export your data as CSV files and a JSON backup in a ZIP, downloaded or shared directly from your device.

Ledgerly uses manual entries rather than bank connections or live market feeds. Foreign-currency cash is kept out of combined totals; investment values use manual valuations or exchange rates. An internet connection is required to save changes; offline financial writes are rejected and never queued for later.

## Run locally

You'll need Node.js 20.19+ (20.x) or 22.12+, npm and a Supabase project with Ledgerly's migrations applied. The [setup and deployment guide](docs/development.md) covers the database, Auth and hosting.

```bash
npm ci
```

Copy `.env.example` to `.env.local` and set your Supabase URL and publishable key. The public VAPID key is optional for notifications; Gemini and Web Push private keys stay in Supabase Edge Function secrets.

```bash
npm run dev
```

Open the local URL printed by Vite. On iPhone, use Safari's **Share > Add to Home Screen** to install the deployed app.

## Development

Built with React, TypeScript, Vite, Tailwind CSS and Supabase. Tests cover financial validation, privacy, authentication and important user flows.

```bash
npm test
npm run lint
npm run build
git diff --check
```

On Windows PowerShell, use `npm.cmd` if your execution policy blocks `npm.ps1`.

Financial calculations and ownership checks are enforced by database RPCs and Row Level Security. The service worker caches the static app shell; it does not cache private API responses or replay financial writes.

Optional features have focused guides for [daily reminders](supabase/DAILY_TRANSACTION_REMINDER.md) and the [export format](supabase/FULL_DATA_EXPORT.md).
