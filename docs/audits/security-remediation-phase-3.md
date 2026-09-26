# Security Remediation Phase 3: privacy-safe diagnostics and browser headers

## Scope and baseline

Only L3 (Gemini free-form error logging) and L4 (repository-defined browser headers) are addressed. Financial logic/SQL, RLS, authentication architecture, notifications, AI tools/quotas, export format, query caching, dependencies and PWA caching are unchanged. No deployment or migrations.

Read AGENTS.md, README.md, current assistant Edge/provider code, vercel.json, Vite/PWA and Supabase browser configuration. No standalone Security Review V1 report exists in the repository; the findings are supplied in the conversation. Initial tree: clean at `c33c03c`, including completed Phase 2. No unrelated work was reset, restored, cleaned or stashed.

Baseline: **539 tests / 91 files passed**, lint passed, build passed, injectManifest passed (87 precache entries / 1701.94 KiB), `git diff --check` passed. Windows commands use `npm.cmd` because this shell blocks `npm.ps1`. Existing build warning: deprecated `inlineDynamicImports` in the PWA build tooling.

## Gemini diagnostic boundary

Before: the provider parsed error bodies, retained credential-pattern-redacted free-form messages, arbitrary provider code/status strings and model configuration, and the Edge handler logged them. Redaction did not protect financial context echoed by a provider. Malformed successful responses also incorporated a free-form finish reason into an exception.

After:

- Non-2xx response bodies are not parsed or retained in diagnostic objects. No provider message, status string, code string or finish reason is copied into errors/logs.
- HTTP diagnostics contain only an integer HTTP status and a derived retryability boolean. The log boundary revalidates the status (400-599) and projects known fields rather than spreading an error object.
- `diagnostics.ts` emits a server-generated request ID and the existing fixed category (`configuration`, `quota`, `timeout`, `invalid_request`, `provider_error`). For HTTP provider errors it adds the fixed provider name `gemini`, HTTP status and retryability. 429/500/502/503/504 are classified as retryable; **this is metadata only, not automatic retry behavior**.
- No exception message/stack, model response, request/response body, prompt/history, tool results, financial values, account/category names, Notes, API keys, tokens or authorization headers are logged. Model configuration and provider-supplied status/code are deliberately omitted.
- Existing concise error responses, timeout/lease handling, quotas and read-only tools remain. Only trusted `AssistantRequestError` validation messages can be returned verbatim; an unexpected TypeError gets a fixed generic response instead of its message.
- The existing lease-completion log remains generated request ID plus a fixed category.

Tests send synthetic private financial text, prompt/context, fake API key and bearer token through the real provider and production logging helper. They check exact allowlisted output, prove the error body is not read, check quota/timeout classification, prevent arbitrary attached error fields from leaking, and verify the Edge handler calls this boundary. No real Gemini request is made.

## Browser resource and header compatibility inventory

| Resource/flow | Current repository evidence | Policy requirement |
| --- | --- | --- |
| React/Vite module scripts and lazy chunks | `index.html`, production `dist/index.html`, router imports | Same-origin script assets; no inline script or eval allowance |
| CSS, charts, popovers, progress bars and toasts | `src/index.css`, Recharts, inline `style` props in Analytics/Budgets/Goals/Investments and Sonner | Same-origin styles plus inline styles; no script `unsafe-inline` |
| Fonts | `@fontsource-variable/geist` imported by local CSS, emitted WOFF2 assets | `font-src 'self'`; no Google Fonts/CDN |
| Icons/images | PWA manifest, index links and local icons; Lucide/Recharts SVG rendering | `img-src 'self'`; no data or remote image requirement found |
| Supabase Auth, refresh, REST/RPC and Edge invocation | `src/lib/supabase.ts`, auth services, feature services, assistant invocation | HTTPS to the exact configured project origin |
| Realtime/WebSocket | No application `.channel()`/Realtime subscription or WebSocket connection found; SDK presence alone does not open one | No `wss:` or `ws:` allowance |
| Gemini | Called only by the Supabase Edge Function | No browser connection to Google is required |
| Service worker and static precache | `src/service-worker.ts`, Vite injectManifest, external `/registerSW.js` | `worker-src 'self'`; same-origin fetch/assets; caching source unchanged |
| PWA manifest/icons | `src/app/pwa-manifest.ts` | `manifest-src 'self'`, same-origin images |
| Web Push | PushManager, service worker events; outbound sending occurs in the reminder Edge Function | Keep notification permission available; no browser fetch allowlist for Apple/Google push endpoints is needed |
| ZIP generation | `createExportZip` calls fflate's asynchronous `zip`; installed `fflate/esm/browser.js` uses Blob workers for entries >=160000 bytes | **`worker-src blob:` is required**, even though small fixture exports may not start workers |
| Download/share | `export-file.ts` creates a Blob URL for `<a download>`; Settings invokes `navigator.share({files})` | Blob download does not need blanket fetch/script/img permissions; `web-share=(self)` preserved explicitly |
| Confirmation redirect | Email opens Supabase confirmation, then app `/login`; SDK implicit flow consumes the fragment | Top-level navigation, not a frame; same-origin app assets and HTTPS Auth API remain allowed |
| External production resources | No third-party browser scripts, fonts, analytics, embeds or reporting endpoint found in application code | No wildcard hosts or general `https:` allowance |

The exact public API origin in local configuration is `https://vhjnmmkagupbnssjjcmh.supabase.co`. The policy uses this origin, not `*.supabase.co`. This is public configuration, not a credential. It does **not** prove that every Vercel environment uses that project. Verify the deployment's `VITE_SUPABASE_URL` matches; explicitly update/review the CSP origin for a different preview project or custom API domain. JSON header values do not interpolate Vercel environment variables.

## ENFORCED configuration vs REPORT-ONLY vs HOSTED CHECK REQUIRED

`vercel.json` applies the following header configuration to `/(.*)` while preserving the existing SPA rewrite exactly. "Enforced" describes the configured browser behavior **after deployment**, not a claim that production has received it.

| Header | Value/mode | Reason |
| --- | --- | --- |
| X-Content-Type-Options | `nosniff` / ENFORCED | Require correct asset MIME types |
| Referrer-Policy | `strict-origin-when-cross-origin` / ENFORCED | Avoid cross-origin path/query referrers while preserving normal same-origin behavior |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), web-share=(self)` / ENFORCED | Deny unused capabilities; retain same-origin export sharing. Notifications/push are not disabled |
| X-Frame-Options | `DENY` / ENFORCED | App has no embedding use case; enforce framing protection while CSP is report-only |
| Content-Security-Policy-Report-Only | Policy below / REPORT-ONLY | Browser compatibility observation before enforcement |
| Strict-Transport-Security | Not added / HOSTED CHECK REQUIRED | Production/custom domain and subdomain HTTPS readiness are unknown. Inspect hosting-provided HSTS; no `includeSubDomains` or `preload` commitment is introduced |

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self';
font-src 'self';
connect-src 'self' https://vhjnmmkagupbnssjjcmh.supabase.co;
worker-src 'self' blob:;
manifest-src 'self';
object-src 'none';
base-uri 'self';
frame-src 'none';
frame-ancestors 'none';
form-action 'self'
```

No `unsafe-eval`, inline scripts, data URLs, wildcard origins, blanket Blob permission, external reporting service, report-sample or additional network dependency. `blob:` is scoped to workers because of actual fflate behavior. Inline styles support the current React/chart UI. The candidate policy would reject arbitrary external resources when enforced; **report-only does not block them today**. X-Frame-Options supplies actual configured framing protection in this phase.

No browser was available through the installed Browser tooling (empty discovery). Therefore authenticated flows, real CSP evaluation, worker installation, mobile sharing and iPhone push could not be verified here. This is why CSP remains report-only. There is no reporting endpoint: inspect DevTools console locally in preview. Do not upload raw violation logs/URLs containing user context to another service. Do not expand allowances for browser extensions or Vercel's optional preview toolbar without separating those from actual application resources.

References: [Vercel header configuration](https://vercel.com/docs/project-configuration/vercel-json#headers), [MDN report-only policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only), [MDN worker-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/worker-src). Normal Vite development/preview does not apply `vercel.json` headers automatically.

## Verification

Focused tests cover the diagnostic boundary and structured header directives, exact Supabase origin, required Blob worker allowance, absent eval/inline scripts/wildcards, untouched SPA rewrite and static-only service-worker source. Existing tests are preserved; one Gemini diagnostic expectation is updated from redacted text to safe metadata.

A transient Vite preview was explicitly supplied the header values from `vercel.json`. Ten local HTTP checks passed: root, Dashboard, login, Add Expense, Analytics, service-worker JS, manifest, icon, built module JS and CSS. They verified status, MIME types, configured headers and SPA fallback. This is **local HTTP evidence**, not a Vercel deployment test or browser/CSP execution test.

Final verification: **554 tests passed / 93 files** (15 new tests, all existing tests retained), lint passed, production build passed, PWA injectManifest passed (**87 entries / 1701.96 KiB**), and `git diff --check` passed. The final concurrent build also emitted a plugin-timing advisory; it completed successfully. No dependency/tooling change was made to suppress existing warnings.

Generated output inspection found 87 unique static precache URLs, no inline script bodies, and no remote/data CSS URLs. Production frontend source/build scans found no server-secret variable references or synthetic private regression-test text. This is a targeted scan, not a claim that arbitrary unknown secret values can be identified. Financial/notification migrations, auth, export, query policy, package manifests and service-worker source have no diff. Browser execution and actual hosted header behavior remain manual checks.

## Manual preview/production flow checklist

Use staging/test accounts and synthetic financial records. Check both fresh online loads and an already-installed PWA. Keep Console open, filter for CSP violations, and inspect Network document/asset response headers. A successful report-only flow alone does not prove enforceability: there must also be no legitimate-resource violations.

- Home/Dashboard, Transactions, Accounts and Investments: open, navigate away/back, and reload deep links. Check fonts/icons, dialogs, progress bars and route chunks.
- Analytics: render responsive charts and tooltips at mobile/desktop sizes; inspect style/script violations.
- Login/logout, session refresh, and user switching: verify normal redirects and no previous-user content. Fresh signup email must confirm through `/login` and remove auth fragments; test an expired confirmation link without sharing its URL.
- Supabase requests: confirm REST/RPC, Auth refresh and an Assistant request reach only the intended HTTPS project. Confirm generic assistant failure UI and safe operational logs using synthetic failures in staging.
- PWA: install, launch standalone, update from a previous version, close/reopen and navigate deep links. Verify `/service-worker.js`, manifest/icons and static precache; no Supabase/private API cache entries.
- Notifications: permission prompt, actual reminder receipt, generic lock-screen text, and click to `/transactions/new?type=expense`. Do not change the existing schedule or send real-user test pushes.
- Export: prepare a small ZIP and a synthetic larger ZIP with an individual entry above 160000 bytes to exercise fflate's Blob worker. Open the ZIP, check desktop download, and check iPhone Web Share / Save to Files. Verify no CSP worker violations and no upload.
- Framing: embedding Ledgerly should be rejected. Confirm the top-level app still works.

Only after all legitimate flows pass without CSP violations should CSP enforcement be proposed as a separate reviewed rollout. No enforcement switch is part of Phase 3.

## HOSTED CHECK REQUIRED: exact TLS/header inspection

Replace `ledgerly.example.com` with the actual production/custom hostname (no tokens, query strings or account paths needed). In Windows PowerShell use `curl.exe`; on macOS/Linux use `curl`:

```powershell
curl.exe -sS -o NUL -D - http://ledgerly.example.com/
curl.exe -sS -L -o NUL -D - http://ledgerly.example.com/
curl.exe -sS -o NUL -D - https://ledgerly.example.com/dashboard
curl.exe -sS -o NUL -D - https://ledgerly.example.com/service-worker.js
curl.exe -sS -o NUL -D - https://ledgerly.example.com/manifest.webmanifest
curl.exe -vI https://ledgerly.example.com/
```

On macOS/Linux replace `NUL` with `/dev/null`. Never use `-k` / `--insecure`. Curl validates the certificate; DevTools Security/certificate details should also show the correct hostname, valid chain and expiry. The HTTP response must redirect to HTTPS, and the final HTTPS response must have the expected headers. Check both custom and Vercel production hostnames where used.

Inspect final `Content-Security-Policy-Report-Only`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and any hosting-provided `Strict-Transport-Security` or existing enforced CSP. Multiple enforced policies combine restrictions: check for hosted overrides before rollout. Confirm real JS/CSS/worker MIME types and no mixed content. Service-worker-cached HTML can retain old headers: inspect a fresh network response (DevTools bypass network cache/service worker for inspection), then separately test normal installed-app update behavior without clearing user state.

No deployed URL was provided or queried in this phase. Production certificate, redirects, HSTS and active headers remain unverified.

## Files and rollout

- `supabase/functions/financial-assistant/provider/gemini-provider.ts`: safe HTTP diagnostics; no provider text/finish-reason retention.
- `supabase/functions/financial-assistant/diagnostics.ts`: allowlisted logging boundary and existing classification.
- `supabase/functions/financial-assistant/index.ts`: use safe logger; return only domain validation text.
- `vercel.json`: low-risk headers and report-only CSP; rewrite preserved.
- `src/features/assistant/gemini-provider.test.ts`, `assistant-diagnostics.test.ts`, `src/security/browser-headers.test.ts`: focused regressions.
- README and this report: inventory, verification and manual rollout instructions.

Deploy the assistant function and Vercel header configuration through the normal reviewed process; they are independent and need no database migration or new secret. Validate on preview first and inspect final hosted headers after rollout. Existing stored logs are not deleted or rewritten by this change. No automatic deployment, Phase 4, dependency upgrade, financial/RLS/auth redesign or notification change was performed.

Recommended commit: `fix: make assistant diagnostics private and add browser security headers`
