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
- Homepage first-render hydration currently relies on the same auth/profile-aware
  inputs on both server and client.
  - `src/app/(app)/[lang]/(home)/page.tsx` intentionally fetches
    `auth.session` + `auth.getUserProfile` before homepage prefetch so the
    server can build the same signed-in/coords-aware homepage tenants query that
    `src/modules/home/ui/HomeView.tsx` builds on first client render.
  - Do not remove those auth/profile queries from the dehydrated homepage cache
    as a "privacy/payload cleanup" unless you also replace their first-render
    role with minimal explicit server-derived props.
  - Blind removal can reintroduce homepage server/client mismatch, orbit preview
    divergence, CTA flicker, and temporary anonymous/no-coords client renders.

## Categories and Filter Logic

- Category taxonomy source of truth for the app is `src/scripts/categories.ts`.
  - Treat `src/seed.ts` as legacy for categories unless a task explicitly requires reconciling it.
- `categories` now have a taxonomy-owned `workType` attribute:
  - field: `workType`
  - values: `manual`, `consulting`, `digital`
  - root categories own the value
  - subcategories inherit it and must not diverge
  - the admin UI hides `workType` on subcategories because hooks overwrite child values from the parent
- Category enforcement lives in `src/collections/Categories.ts`.
  - root categories must define `workType`
  - subcategories can only belong to root categories
  - parent `workType` changes cascade to direct children
  - cascade paging is intentional even though category groups are expected to stay small
- Category read contract lives in `src/modules/categories/server/procedures.ts`.
  - `categories.getMany` explicitly returns `workType` on both root categories and subcategories
  - this is intentional so future search/filter UI can group by `workType` without another backend pass
- Marketplace filter semantics in `src/modules/tenants/server/procedures.ts`:
  - route/category selection is taxonomy-driven, not tenant-entered
  - selecting a parent category expands to include tenants tagged with either that parent category or any of its subcategories
  - if an explicit subcategory is selected, that subcategory wins over parent expansion
  - tenant `services` (`on-site` / `on-line`) remains a separate delivery-mode axis and must not be conflated with category `workType`
- Home/category search-filter UI notes:
  - desktop category row in `src/modules/home/ui/components/search-filters/categories.tsx` trims visible categories to fit the viewport while keeping `View all` visible
  - on colored category/subcategory pages, idle category labels and `View all` use white text with subtle shadow for contrast; active/open chips still use the white-pill treatment
  - breadcrumb links in `src/modules/home/ui/components/search-filters/breadcrumbs-navigation.tsx` must preserve the active locale in their hrefs
  - subcategory dropdowns use consistent white text on category-colored panels; this is an intentional UI choice, not a dynamic contrast bug
  - the search bar in `src/modules/home/ui/components/search-filters/search-input.tsx` is still a provider/tenant text search, not a category/workType picker
  - search state is stored in the `search` query param via `nuqs` (`src/modules/tenants/hooks/use-tenant-filters.ts`)
  - typing debounces URL/server updates by 400ms; clearing applies immediately; pressing Enter flushes the current value immediately
  - current backend search behavior in `src/modules/tenants/server/procedures.ts` is free-text `OR` over tenant `name` and `bio`, then `AND`ed with all other active filters (category, subcategory, services, price, distance, sort)
  - do not treat the current search input as a generic marketplace search across categories/subcategories unless a task explicitly changes that product behavior
- Global desktop navbar search (deterministic MVP) now exists as a separate system from the homepage/provider search:
  - entry UI lives in `src/modules/search/ui/navbar-global-search.tsx` and is mounted only in the desktop navbar (`src/modules/home/ui/components/navbar.tsx`)
  - the search module boundary is `src/modules/search/*` and intentionally stays isolated from homepage filters and tenant listing search
  - server suggestions come from `search.suggest` in `src/modules/search/server/procedures.ts`
  - taxonomy inputs reuse shared live category-tree reads (`src/modules/categories/server/category-tree.ts`); do not import `src/scripts/categories.ts` at runtime
  - result kinds exposed to the UI are intentionally narrow: `tenant`, `category`, `subcategory`, and explicit marketplace fallback
  - alias/synonym matching is internal only (`src/modules/search/search-synonyms.ts`) and must resolve to canonical category/subcategory slugs before returning suggestions
  - fallback behavior is explicit: the backend appends `/[lang]/all?search=...` as the final row; it must never participate in auto-select
  - client navigation is split on href type in `src/modules/search/lib/navigate-search-result.ts`:
    relative app routes use `router.push(...)`, absolute tenant URLs use `window.location.assign(...)`
  - current navbar UX is desktop-only, debounced, and deterministic:
    typing 2+ characters calls `search.suggest`, the popover opens from the input, arrow keys move a local highlighted row, and Enter only navigates to the highlighted row or an `autoSelect` top hit
  - keep this separate from the homepage provider search unless a task explicitly merges those product behaviors
  - follow-up hardening still expected: logic tests around search scoring/href resolution/procedure output, plus manual QA for popover focus, Enter behavior, and cross-origin tenant navigation

## Support Chat

- AI support chat is a separate product/domain boundary from human messaging.
- Module boundary lives under `src/modules/support-chat/{server,ui,lib}`.
- tRPC entry is `supportChat` in `src/trpc/routers/_app.ts`.
- Public route is `src/app/(app)/[lang]/support/page.tsx`.
- Navbar/mobile/footer entry points intentionally use a distinct `support` label instead of the older generic `chat` wording.
- Anonymous and signed-in users share the same public support entry point; signed-in state alone must not be treated as permission for live account/order/payment answers.
- Keep AI support chat separate from `src/modules/conversations/*` and `src/modules/messages/*`; those remain human-to-human messaging domains.
- Support chat scope is grounded general support only: terms/policy, registration/onboarding, booking/payment/cancellation/dispute rules at policy level, failure next steps, and basic marketplace usage.
- Support chat must not claim live order/payment/account lookup, make cancellation decisions for a specific order, perform vendor/admin actions, run broad DB reads, or access Stripe/Payload/Mongo/backend systems directly.
- The assistant may explain platform policy in plain language, but must not present legal, financial, medical, tax, or other professional advice beyond platform rules.
- Policy summaries/paraphrases must stay conservative and must not imply meanings unsupported by approved source material.
- Empty, abusive, or nonsensical prompts should receive a brief boundary response plus human support/contact handoff where appropriate.
- Internal scope constants live in `src/modules/support-chat/lib/scope.ts`; the human-readable scope note lives in `src/modules/support-chat/server/scope.md`.
- Repo-managed support knowledge lives in `src/modules/support-chat/server/knowledge/*.en.md` and should use stable file IDs, version labels, and section IDs for later retrieval/logging.
- Knowledge-pack priority is operational FAQ/help content first, policy summaries second, Terms reference third, and unsupported/fallback guidance when the source material is not enough.
- Simple support retrieval lives in `src/modules/support-chat/server/knowledge-loader.ts` and `src/modules/support-chat/server/retrieve-knowledge.ts`.
- Retrieval is deterministic keyword/heading matching over repo-managed markdown chunks; do not replace it with hosted/vector retrieval unless the knowledge base outgrows this approach.
- Retrieval results must expose chunk IDs, document IDs, section IDs, source type, score, and matched terms so prompt/debug/logging work can inspect what context was used.
- Support-chat knowledge markdown is read from disk at runtime; `next.config.ts` must include `src/modules/support-chat/server/knowledge/**/*.md` in `outputFileTracingIncludes` so production builds bundle the knowledge pack.
- Support-chat retrieval should fall back to English knowledge files when a localized knowledge pack is not available; do not return empty results only because the route locale has no matching markdown files yet.
- Markdown `## ...` headings in knowledge files are stable section IDs; do not rewrite, slugify, or derive alternate IDs during loading.
- Use a minimum relevance threshold; do not force irrelevant chunks into model context.
- Support-chat UI copy belongs in the `supportChat` i18n namespace, while the repo-managed knowledge pack may remain English-only until localized source material is approved.
- Input precheck helpers must stay minimal and must not become homemade semantic intent classification.
- OpenAI usage for support chat must stay server-only.
- Use `src/lib/openai.ts` as the single OpenAI client helper.
- Support-chat model calls should go through `src/modules/support-chat/server/openai-response.ts`; do not call OpenAI directly from UI or unrelated modules.
- The support-chat model is configured in `src/modules/support-chat/server/openai-config.ts`; `OPENAI_SUPPORT_CHAT_MODEL` and `OPENAI_SUPPORT_CHAT_MODEL_VERSION` must both be set explicitly so future logs can distinguish model behavior.
- OpenAI outages or empty model output should return a user-safe fallback message, not raw SDK/API errors.
- `src/modules/support-chat/server/rate-limit.ts` is only an in-memory first-layer guard; do not treat it as durable multi-instance rate limiting.
- When extending support chat, prefer documenting stable boundaries here: entry points, ownership, access model, source-of-truth locations, storage shape, and safety constraints.

## Checkout UI Note

- The active slot-order customer drawer is `src/modules/checkout/ui/slots-cart-drawer.tsx`.
- Treat `src/modules/checkout/ui/cart-drawer.tsx` as legacy unless a task explicitly says otherwise.
- For current slot-lifecycle booking/order UX, prefer tracing changes through `slots-cart-drawer.tsx` and the slot checkout flow instead of the legacy drawer.

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
- Phase 6 invariant:
  - route locale (`/[lang]/...`) is the active truth
  - `app_lang` cookie is mirror/bootstrap only
  - persisted profile language is preference only and must never silently override an explicit route
- `src/modules/profile/location-utils.ts` re-exports language helpers for backward compatibility.
  - Prefer importing from `src/lib/i18n/app-lang.ts` for new code.
- Locale detection priority for client UX text should be:
  - `document.documentElement.lang` -> `navigator.languages`/`navigator.language` -> `"en"`.
- `normalizeToSupported` must handle region/case variants robustly (`de-DE`, `EN_us`, etc.).
- Bare `/` locale bootstrap still resolves from `app_lang` -> `Accept-Language` -> default.
  - Locale-prefixed routes always win over cookie/bootstrap state.
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
- Phase 3 (runtime i18n + shell/common migration + governance) is implemented:
  - `next-intl` plugin is wired in `next.config.ts` using `src/i18n/request.ts`
  - request locale precedence in `src/i18n/request.ts` is `x-app-lang` -> `app_lang` cookie -> `requestLocale` -> `DEFAULT_APP_LANG`
  - `common` dictionary loading merges locale-specific messages onto `en` fallback baseline
  - `src/app/(app)/layout.tsx` owns the root `IntlProvider` (`getMessages` + provider wrap)
  - `src/app/(app)/[lang]/layout.tsx` only validates locale and pins request locale via `setRequestLocale`
  - shell/common components use `useTranslations("common")` with locale-safe links:
    `src/modules/home/ui/components/navbar.tsx`,
    `src/modules/home/ui/components/navbar-sidebar.tsx`,
    `src/modules/home/ui/components/footer.tsx`,
    `src/modules/legal/cookies/ui/cookie-banner.tsx`,
    `src/modules/legal/cookies/ui/cookie-preferences-dialog.tsx`,
    `src/modules/home/ui/components/referral-notice.tsx`
  - governance checks are in `src/i18n/rollout.ts` + `src/scripts/i18n-check.ts`, executed via `npm run test:i18n:messages`
- Phase 4 (formatting consolidation) is implemented:
  - canonical locale/format helpers live in `src/lib/i18n/locale.ts`
  - `src/modules/profile/location-utils.ts` remains a compatibility surface for older imports
  - key formatting consumers now import from the canonical locale module
- Phase 4A (CMS/category localization) is implemented:
  - Payload localization is configured from the canonical app-language registry
  - `categories.name` is localized in Payload while `slug` remains canonical
  - category seed/upsert runs with localized names for all launched locales
  - category and tenant reads resolve localized category labels with `en` fallback
- Phase 5 Wave 1 (checkout + bookings) is implemented:
  - `bookings` and `checkout` namespaces are loaded and governed for all launched locales
  - tenant booking UI, calendar, pay-later drawer, payment setup, and terms dialog chrome are localized
  - pay-later booking flow no longer leaks raw English server errors in the customer path
- Tenant public page completion pass is implemented:
  - `tenantPage` namespace is loaded and governed for all launched locales
  - tenant page shell, shared tenant card, review summary, and conversation UI are localized
  - tenant-page review dates use route-aware locale formatting
- Phase 5 Wave 3 Commit 1 (profile shell + general profile form) is implemented:
  - `profile` namespace is loaded and governed for all launched locales
  - `ProfileTabs`, `SettingsHeader`, and `GeneralProfileForm` are localized
  - live profile validation-summary mapping is aligned with `src/modules/profile/schemas.ts`
- Phase 5 Wave 3 Commit 2 (vendor onboarding + provider confirmation) is implemented:
  - `VendorProfileForm` and `ProviderConfirmation` are localized under `profile`
  - vendor onboarding preserves locale-aware profile tab links and avoids raw user-facing error passthrough in the main vendor flow
  - launched-locale `profile.json` coverage now includes the vendor/provider confirmation surfaces
- Phase 5 Wave 3 Commit 3 (payouts panel) is implemented:
  - `PayoutsPanel` is localized under `profile`
  - Stripe onboarding/dashboard fallback copy and payouts panel states are localized
  - payouts/profile prerequisite links preserve the active locale
- Phase 5 Wave 4 Commit 1 (finance namespace + shared wallet UI) is implemented:
  - `finance` namespace is loaded and governed for all launched locales
  - shared wallet filters, summary cards, transactions table, and common finance status labels are localized
  - wallet export filenames now use stable filename-safe segments instead of visible UI labels
- Phase 5 Wave 4 wrapper locale-source follow-up is partially implemented:
  - tenant/admin finance wrappers now derive finance `appLang` from the active route locale instead of profile/browser fallback
  - tenant finance payouts links preserve locale when linking back into profile
- Phase 6 (language switcher + route-authoritative sync) is implemented:
  - `src/i18n/ui/language-switcher.tsx` is the canonical language switcher and rebuilds the current URL with `stripLeadingLocale` + `withLocalePrefix`
  - desktop and mobile nav both host the same switcher:
    `src/modules/home/ui/components/navbar.tsx`,
    `src/modules/home/ui/components/navbar-sidebar.tsx`
  - the primary nav is intentionally slimmed:
    desktop keeps only home + legal links,
    mobile intentionally hides `/about`, `/features`, `/pricing`, and `/contact`
    to keep the shell stable across locales; do not treat that omission as an accidental regression unless product requirements change
  - the signed-in admin CTA label remains intentionally English (`Admin Panel`)
    in `src/modules/home/ui/components/navbar.tsx` and
    `src/modules/home/ui/components/navbar-sidebar.tsx`;
    treat it as an internal/admin-facing exception unless product requirements change
  - switcher UI uses explicit `react-country-flag` mapping; flags are presentation-only and must not affect locale logic
  - authenticated navbar/mobile switches persist language asynchronously through `auth.updateLanguagePreference`
  - explicit language changes mirror `app_lang` immediately via `mirrorLocaleCookie` in `src/i18n/routing.ts`
  - profile language edits do not live-switch the UI while dirty; after successful save they may navigate to the same route under the saved locale using `stripLeadingLocale` + `withLocalePrefix`
  - profile-save success toasts are deferred to the destination locale when a language-changing save triggers navigation
  - `SettingsHeader` now derives its default Home link from the active locale route instead of bare `/`
  - mobile sidebar dashboard/start-business CTA mirrors desktop routing:
    uses `hasTenant` as the stable label/source-of-truth signal,
    keeps `isDashLoading = hasTenant && !myTenant && isMineLoading`,
    and escapes tenant hosts via `platformHomeHref()` for dashboard links
  - home-page hero and CTA chrome now use `common.home.*` message keys for all launched locales

### i18n Rollout Status (Still Open)

- Phase 5 Wave 2 (orders) is outside this note and should be tracked separately if completed on another branch/PR.
- Phase 5 Wave 3:
  - Commit 4 remains conditional: auth leftovers only if confirmed live
- Phase 5 Wave 4 remains in progress:
  - translate the tenant/admin finance wrapper chrome still left in English
  - localize the invoice viewer and PDF download path
- Phase 6A and Phase 7 remain open.

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
