# AGENTS.md

Guidance for coding agents working in this repository.

## Purpose

This file provides fast startup context so new conversations can make correct changes without re-discovering core architecture and business rules.

## Project Snapshot

- Name: `multi-serv`
- Type: Multi-tenant service marketplace
- Framework: Next.js 15 (App Router)
- Backend/CMS: Payload CMS 3 + MongoDB
- Auth: Clerk
- API layer: tRPC + React Query
- Payments: Stripe (Connect + checkout/webhooks)
- Styling/UI: Tailwind CSS 4 + shadcn/radix

## Setup Commands

- Install deps: `npm install --legacy-peer-deps`
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`
- Payload types: `npm run generate:types`
- Fresh DB: `npm run db:fresh`
- Seed DB: `npm run db:seed`

## Environment Essentials

Required env groups are defined in `README.md`:

- Database: `DATABASE_URI`
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- Payload: `PAYLOAD_SECRET`
- Stripe: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- App URLs/domains: `APP_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ROOT_DOMAIN`
- Blob storage: `BLOB_READ_WRITE_TOKEN`

## High-Value Code Map

- App routes and layouts: `src/app`
- Protected app shell: `src/app/(app)`
- Middleware and rewrites: `src/middleware.ts`
- Payload config: `src/payload.config.ts`
- Collections: `src/collections`
- Domain modules: `src/modules`
- tRPC bootstrap/context: `src/trpc/init.ts`
- tRPC client provider: `src/trpc/client.tsx`
- App router composition: `src/trpc/routers/_app.ts`
- Shared constants: `src/constants.ts`

## Architecture Notes

- Route groups are used heavily (`(app)`, `(auth)`, `(home)`, `(tenants)`, `(orders)`).
- Most domain logic is feature-first under `src/modules/<domain>/{server,ui}`.
- Payload collections are admin-restricted by default; app logic often uses server-side `overrideAccess: true` with explicit guards.
- Tenant isolation is enforced in server procedures through tenant membership checks.

## Admin Dashboard Status (Brief)

- Phase 1 is implemented:
  - In-app admin entry routes to `/dashboard/admin` (Payload remains at `/admin`).
  - Server-side super-admin guard is enforced on the admin dashboard route.
- Phase 2 is partially implemented:
  - Admin transactions view reuses wallet filters/summary/table presentation via wrappers.
  - Admin finance data uses super-admin procedures with tenant scope (`tenantId?: string`) and all-tenant mode.
- Phase 3 (admin CSV export) is implemented:
  - `adminWalletTransactionsExport` reuses the shared wallet transactions builder with full filtered fetch (`fetchAll`).
  - Admin export enforces super-admin guard and supports full-history all-tenant export.
  - Admin CSV is server-backed (not limited to loaded table rows) and includes `occurred_at_berlin` + `timezone`.
  - Full tenant/admin export unification is still deferred (tracked in `TODO.md`).
- Phase 5 (minimal hardening) is implemented:
  - Wallet list procedures now return server pagination metadata (`hasMore`) for reliable load-more behavior.
  - Tenant and admin transactions tables use server `hasMore` instead of client row-count heuristics.
  - Finance-read indexes were added for invoice/payment and commission-event date scans used by wallet queries.
  - Minimal wallet correctness tests were added for end-exclusive range and Berlin timezone behavior (`test:commissions:wallet`).
- Admin Orders overview Phases 0-3 are implemented:
  - Added super-admin-only `orders.adminListSlotLifecycle` for cross-tenant slot-lifecycle orders.
  - Added `listForAdminSlotLifecycle` rollup query with canonical tenant filter (`order.tenant`) and customer snapshot text search.
  - Reused tenant lifecycle row mapping and added admin tenant display metadata (`tenantName`/`tenantSlug`) with fallbacks.
  - Added a separate read-only `AdminOrdersLifecycleTable` with zero mutation hooks or action/status controls.
  - Added `AdminOrdersLifecycleView` and integrated the Orders section into `/dashboard/admin`.
  - Admin Orders currently supports tenant filtering, customer filtering, pagination, and local scroll anchoring to keep the section stable while filters/pages change.
- Admin Orders enhancements implemented beyond the original v1 scope:
  - Admin Orders columns are sortable client-side on the current page and include an `Order date` column (`createdAt`) in addition to service `Date range`.
  - Admin tenant selection uses the shared searchable `TenantCombobox`.
  - Admin customer filtering uses an async suggestion combobox backed by `orders.adminCustomerOptions`; selected suggestions preserve a human label separately from the applied query token.
  - `orders.adminSlotLifecycleExport` returns flat slot-level export rows for the full filtered admin result set.
  - Export reuses the same tenant/customer filter semantics as the admin Orders table and caps flattened slot rows server-side.
  - Admin Orders download is wired in `AdminOrdersLifecycleView`; CSV formatting stays in `src/modules/orders/ui/orders-csv.ts`.
- Admin Orders follow-up work still open:
  - Phase 4 hardening is only partially closed: dedicated Orders indexes and focused admin Orders tests are still pending.
  - Optional warning metadata / non-blocking admin warning banner for malformed-row exclusions is still deferred.

## Language Structure (i18n)

- Single source of truth for supported app languages is `src/lib/i18n/app-lang.ts`.
  - Canonical exports: `SUPPORTED_APP_LANGS`, `AppLang`, `DEFAULT_APP_LANG`, `SUPPORTED_LANGUAGES`, `normalizeToSupported`.
- `src/modules/profile/location-utils.ts` re-exports language helpers for backward compatibility.
  - Prefer importing from `src/lib/i18n/app-lang.ts` for new code.
- Locale detection priority for client UX text should be:
  - `document.documentElement.lang` -> `navigator.languages`/`navigator.language` -> `"en"`.
- `normalizeToSupported` must handle region/case variants robustly (`de-DE`, `EN_us`, etc.).
- Do not add new hardcoded app-language lists/unions in feature files.
  - Reuse `SUPPORTED_APP_LANGS` or `SUPPORTED_LANGUAGES` instead.
- Payload-generated types in `src/payload-types.ts` are derived artifacts, not source of truth.
  - After language option/schema changes, run `npm run generate:types`.

### i18n Rollout Status (Implemented So Far)

- Phase 1 (edge routing composition) is implemented on Next 15 in `src/middleware.ts`:
  - locale-prefix enforcement for page routes (`/{lang}/...`)
  - strict bypass for technical paths (`/_next`, `/_vercel`, `/api`, `/trpc`, `/admin`, static assets)
  - Clerk callback/deep-link param normalization (`redirect_url`, `returnTo`, `return_to`)
  - locale-aware protected-route checks using de-localized paths (`/dashboard`, `/profile`)
  - conditional locale cookie persistence via `LOCALE_COOKIE_NAME` (`app_lang`) to avoid per-request `Set-Cookie`
- Phase 2 (localized app route tree) is implemented under `src/app/(app)/[lang]/...`:
  - bridge rewrite removed; localized routes are now real route segments
  - tenant rewrite target is localized (`/${lang}/tenants/${slug}/...`)
  - locale guard added in `src/app/(app)/[lang]/layout.tsx` (`notFound()` for unsupported locale segments)
  - locale-aware sign-in/sign-up and server redirects use `/${lang}/...` paths
  - referral route `src/app/(app)/[lang]/(home)/ref/[code]/route.ts` redirects to `/${lang}`
- First-request `<html lang>` correctness fix is implemented:
  - middleware stamps `x-app-lang` on `NextResponse.next()` and tenant `rewrite()` request headers
  - `src/app/(app)/layout.tsx` resolves lang as `x-app-lang` -> `app_lang` cookie -> `Accept-Language`
- Profile form stabilization fixes (post Phase 2) are implemented:
  - language select hydration uses field-level dirty/touched precedence to keep persisted profile language stable
  - hydration reset is guarded with `useFormState(...).isDirty` to avoid clobbering in-progress edits
  - country display prefers ISO-derived localized labels while avoiding stale profile ISO during active location edits
  - `getInitialLanguage()` follows required priority: `document.documentElement.lang` -> `navigator.languages`/`navigator.language` -> `en`

## Promotions Reservation (Phase 3)

- `first_n` promotions reserve capacity through `src/modules/checkout/server/promotion-reserve.ts`.
- `reservationKey` is the checkout-attempt idempotency key.
  - Stored on `promotion_allocations` and uniquely indexed in `src/payload.config.ts`.
- Atomic gate enforcement uses stored `promotion_counters.limit` (counter-canonical cap).
  - If incoming limit and stored limit differ, reservation logs a warning and enforces stored limit.
- Reservation outcomes are intentionally split:
  - `limit_reached`: business outcome, checkout may fall back to default fee.
  - `error`: infrastructure/transaction failure, checkout creation must fail.
- Reservation writes (counter gate + allocation) must run in one transaction context.
- Checkout (`createCheckoutSession`) resolves promotion, reserves for `first_n` when needed, then locks invoice fee snapshot before creating Stripe session.
- Promotions reservation tests clean up created promo/counter/allocation records to avoid DB buildup.

## Referral Attribution (Phase 2)

- Purpose: capture which referral code a user/tenant arrived with.
- Flow:
  - Referral route stores code in cookie: `src/app/(app)/(home)/ref/[code]/route.ts`.
  - Auth/onboarding persists normalized code to DB: `src/modules/auth/server/procedures.ts`.
  - Cookie is transport-only and should be cleared after successful persistence.
- Source of truth is persisted DB fields (user/tenant referralCode), not browser cookie.
- This tracks referral-code attribution, not person-to-person "who referred whom" identity.
- Canonical referral normalization is shared in `src/lib/referral-code.ts`.
  - Reuse `normalizeReferralCode` instead of redefining regex/normalization in feature files.

## Finance and Commissions Rules (Important)

- Wallet currency is EUR-only for MVP.
  - Source: `WALLET_CURRENCY = "eur"` in `src/constants.ts`
- Wallet period filtering is based on invoice dates in `Europe/Berlin` timezone.
- Date range end is exclusive for wallet filters and queries.
- Wallet UI is derived from invoices + commission events, not Stripe balance directly.
- Commission events are idempotent on Stripe payment intent.
  - `commission_events.paymentIntentId` is unique.
- Stripe webhook (`checkout.session.completed`) writes collected commission events and marks invoices paid.

## Key Collections for Money Flow

- `invoices` (`src/collections/Invoices.ts`)
  - Holds amount snapshots, VAT snapshots, fee snapshot fields, Stripe session/PI IDs, `issuedAt`, `paidAt`
- `commission_events` (`src/collections/CommissionEvents.ts`)
  - Ledger-style fee events per paid invoice
- `commission_statements` (`src/collections/CommissionStatements.ts`)
  - Monthly statement aggregation based on commission events

## Working Conventions

- Preserve strict typing and existing Zod input schemas on tRPC procedures.
- Keep server/client boundaries explicit (`server-only`, `"use client"`).
- Reuse existing utilities before adding new helpers.
- Keep timezone and currency behavior consistent with current finance module.
- Prefer small, focused changes over broad refactors unless requested.

## Change Checklist

Run before finalizing changes:

- `npm run lint`
- `npx tsc --noEmit`
- If finance/payment code changed:
  - Verify wallet summary and transactions render in tenant dashboard
  - Verify filters (year/month/range/status) match expected totals
  - Verify CSV export still works
  - Verify Stripe webhook path `src/app/(app)/api/stripe/route.ts` behavior remains idempotent

## Known Sensitive Areas

- Clerk middleware and auth context interactions (`src/middleware.ts`, `src/trpc/init.ts`)
- Stripe webhook idempotency and invoice status transitions
- Tenant scoping and membership authorization checks
- Date/time logic in Berlin timezone for finance data
- Promotion allocation consume in Stripe webhook (`src/app/(app)/api/stripe/route.ts`)
  - Consume is retry-safe/idempotent and should not be gated only by first paid transition.
  - `invoice.paid` emails are transition-gated; consume failures are logged and non-blocking to protect email delivery.
  - If consume fails on a 200 response path, reconcile `reserved` -> `consumed` via later webhook delivery or ops/admin repair.

## Payload Admin Auth Stability Note (Deferred Follow-up)

- During promotions testing, Payload admin form submissions may intermittently fail with:
  - `Error: Unauthorized` from `buildFormStateHandler`
  - transient missing request user context (`id: null, roles: null`)
- Working hypothesis:
  - `src/lib/auth/clerk-strategy.ts` currently depends on both `auth().userId` and `currentUser()` for auth success.
  - If `currentUser()` is temporarily unavailable, authenticated requests can degrade to anonymous.
- Recommended fix path (after promotions track):
  1. Treat `auth().userId` as the authoritative authentication signal.
  2. Use `currentUser()` only for enrichment/sync fallback, not for auth gating.
  3. Never null authenticated state just because enrichment fails.
  4. Validate behavior in `/admin/collections/promotions/create` create/edit flows.
- Scope control:
  - Keep this work out of active promotions feature PRs unless admin auth becomes a blocker.

## If Unsure

- Prefer tracing from UI call site -> tRPC procedure -> Payload query.
- Keep behavior compatible with latest finance commits:
  - wallet summary
  - wallet transactions
  - wallet export
  - monthly commission statements
