# Multilingual Rollout Reference (Infinisimo / `multi-serv`)

## Objective

Introduce multilingual support across the app with minimal regressions, using App Router locale routing while preserving:

- Clerk protection
- tenant subdomain rewrite
- helper compatibility (`app-lang.ts`, `location-utils.ts`)
- staged migration (plumbing first, strings later)

## Scope

In scope:

- UI copy
- validation messages shown to users
- CSV headers where user-facing
- transactional emails (subjects + bodies)
- Payload/CMS localization for categories and subcategories (at minimum)

Explicitly decide (in/out) in Phase 0:

- internal admin diagnostics and system logs
- CMS long-form marketing content (optional v1/v2)

## Implementation Status (as of 2026-03-06)

- Phase 0 - conventions and rollout doc locked.
- Completed Phase 1 on Next 15 using `src/middleware.ts` + `src/i18n/routing.ts`.
- Phase 2 now runs on localized app routes under `src/app/(app)/[lang]/...`.
- Phase 3 runtime i18n and shell/common migration is complete.

Completed fixes across Phase 1/2/3:

- middleware bridge rewrite removed; localized routes are now real route segments.
- tenant rewrite target is localized: `/${lang}/tenants/${slug}/...`.
- locale context propagation added via `x-app-lang` request header on `NextResponse.next()` and tenant rewrites.
- root layout language resolution uses `x-app-lang` -> `app_lang` cookie -> `Accept-Language`.
- locale-segment guard added in `src/app/(app)/[lang]/layout.tsx` with `notFound()` for invalid segments.
- auth and server redirects were updated to locale-prefixed paths (`/${lang}/...`).
- referral route redirect now preserves active locale namespace (`/${lang}`).
- profile language/country UI follow-up fixes applied (stable language hydration + ISO-aware country display fallback behavior).
- `next-intl` runtime is wired via `next.config.ts` and `src/i18n/request.ts`.
- request-level locale precedence is aligned as `x-app-lang` -> `app_lang` cookie -> `requestLocale` -> `DEFAULT_APP_LANG`.
- root provider ownership is centralized in `src/app/(app)/layout.tsx` (`getMessages` + `IntlProvider`).
- `src/app/(app)/[lang]/layout.tsx` validates/pins URL locale only (`setRequestLocale`), without a nested provider.
- shell/common UI now uses `useTranslations("common")` in navbar/sidebar/footer/cookie/referral components.
- launched-locale governance checks are active via `src/i18n/rollout.ts`, `src/scripts/i18n-check.ts`, and `npm run test:i18n:messages`.

## Guiding Decisions

### URL strategy

Locale-prefixed URLs: `/{lang}/...` where `{lang}` is AppLang short code (`en,de,fr,it,es,pt`).

### Single edge entrypoint

All routing concerns are composed in one edge entrypoint (`src/middleware.ts`) for the current Next 15 stack. Migrate to `src/proxy.ts` later as part of a dedicated Next 16 upgrade.

### Locale resolution order (UI pages)

1. URL locale
2. locale cookie
3. `Accept-Language`
4. `DEFAULT_APP_LANG` fallback

### Formatting split

- keep current `location-utils` behavior during migration
- consolidate into `src/lib/i18n/*` and keep `location-utils.ts` as compatibility re-export

### Incremental rollout

- Phase 1 proves routing integrity
- Phase 2 restructures routes
- Phase 3 introduces dictionaries and shell/common migration (complete)
- Phase 4/4A covers formatting + CMS localization
- Phase 6/6A covers preference + emails
- Phase 7 locks quality gates

## Locked Rules

### Fallback behavior

If a key/content is missing in selected locale, fallback to `en`.

- dev: log missing key/content
- prod: quiet fallback

### Channel precedence

- UI pages: URL locale > cookie > `Accept-Language` > `en`
- Emails: recipient profile language > tenant default language > `en`
- CMS reads: active request locale > `en`

### Technical path bypass (strict)

Middleware must not apply locale redirects/rewrites to:

- `/_next/*`
- `/api/*` (including webhooks)
- `/trpc/*` (if present)
- static assets (`/favicon.ico`, `/robots.txt`, `/sitemap.xml`, images/fonts)
- Payload admin route (`/admin`)

## Phase 0 - Prep and Invariants (no behavior change)

### Goals

Lock conventions, scope, and acceptance checks.

### Work

1. Confirm canonical language source: `src/lib/i18n/app-lang.ts`.
2. Define namespaces:
- UI: `common`, `auth`, `home`, `checkout`, `bookings`, `orders`, `finance`, `admin`, `errors`
- Emails: `emails.*` (or per-event namespaces)
3. Key style and placeholders:
- key style: dot.case or snake.case (pick one)
- placeholders: `{count}`, `{name}` (never translate placeholder identifiers)
- brand terms: `Infinisimo` unchanged
4. Define launched-locale policy (for CI in Phase 7):
- launched locales list separate from supported locales
- CI blocks only on launched locales plus required namespaces
5. Define acceptance checks per phase.

### Deliverable

- `docs/i18n-rollout.md` committed.

## Phase 1 - Edge Routing Composition (Implemented)

### Goals

Add locale-aware routing without breaking auth/subdomain behavior.

### Status

Implemented in `src/middleware.ts` and `src/i18n/routing.ts` on Next 15.

### Files

- `src/middleware.ts` (current edge entrypoint on Next 15)
- `src/i18n/routing.ts`
- optional: `src/i18n/request.ts` (next-intl request config later)

### Work

1. Locale prefix enforcement (page routes only)
- if no `/{lang}` prefix:
- resolve locale (cookie -> `Accept-Language` -> default)
- redirect to `/${lang}${pathname}` and preserve query string
2. Composition requirements (repo-specific)
- protected route matcher must support locale-prefixed paths:
- protect `/dashboard` and `/{lang}/dashboard`
- protect `/profile` and `/{lang}/profile`
- extend to other protected areas as needed
- tenant subdomain rewrite must preserve locale segment:
- rewrite targets become `/{lang}/tenants/{slug}/...`
- technical bypass remains strict (see Locked Rules)
- locale cookie is only written when changed (avoids per-request `Set-Cookie`)
- `x-app-lang` request header is injected on non-redirect pass-through/rewrite flows
3. Callback/deep-link normalization
- preserve path and query params through locale redirects
- ensure Clerk redirect/callback parameters are locale-safe:
- normalize `returnTo` and redirect URLs to include locale prefix, or normalize immediately after auth
- note: hash fragments (`#...`) are client-only and cannot be preserved at proxy level

### Acceptance checks

- `/dashboard/admin` redirects to `/{lang}/dashboard/admin`
- protected routes stay protected
- tenant subdomain routing unchanged
- no redirect loops
- `/api/*` and webhooks unaffected

## Phase 2 - App Route Structure for Locale Param (Implemented)

### Goals

Make locale a first-class route param in App Router.

### Status

Implemented with localized app routes in `src/app/(app)/[lang]/...`.

### Work

1. Introduce `src/app/(app)/[lang]/...` and move route groups under it.
2. Keep a single root `<html>` in `src/app/(app)/layout.tsx` and resolve `lang` as:
- middleware header (`x-app-lang`) -> `app_lang` cookie -> `Accept-Language`
3. Add locale-segment validation in `src/app/(app)/[lang]/layout.tsx`:
- reject unsupported locale segments with `notFound()`
4. Migration safety:
- keep redirects from unprefixed links to prefixed links during migration window
- Clerk sign-in/sign-up redirect URL sanity:
- redirect targets include locale prefix, or are normalized immediately after auth
- update locale-prefixed Clerk paths and server redirects (`/${lang}/sign-in`, `/${lang}/sign-up`, `/${lang}/profile?...`)
- update moved route handlers (e.g. referral redirect target `/${lang}`, invoice page locale source from URL param)

### Acceptance checks

- key routes render under `/{lang}/...`
- auth/session behavior unchanged
- tenant routes still resolve
- Payload admin remains reachable unprefixed

## Phase 3 - Runtime i18n Layer and Dictionaries (Implemented)

### Goals

Set up dictionary loading and translation access patterns.

### Implemented Work

1. Messages structure (start minimal):
- `src/i18n/messages/en/common.json`
- `src/i18n/messages/de/common.json`
2. Request-level config (next-intl App Router):
- `src/i18n/request.ts` via `getRequestConfig` with precedence:
- `x-app-lang` -> `app_lang` cookie -> `requestLocale` -> `DEFAULT_APP_LANG`
- locale-specific messages merged onto `en` baseline fallback
3. Translation access:
- server: `getTranslations` and `getMessages`
- client: `NextIntlClientProvider` and `useTranslations`
- provider ownership:
- `src/app/(app)/layout.tsx` owns `IntlProvider` for root-level client components
- `src/app/(app)/[lang]/layout.tsx` validates locale and calls `setRequestLocale` only
4. Start with shell/common copy:
- header/nav, footer, global buttons, baseline errors/toasts
- migrated components:
- `src/modules/home/ui/components/navbar.tsx`
- `src/modules/home/ui/components/navbar-sidebar.tsx`
- `src/modules/home/ui/components/footer.tsx`
- `src/modules/legal/cookies/ui/cookie-banner.tsx`
- `src/modules/legal/cookies/ui/cookie-preferences-dialog.tsx`
- `src/modules/home/ui/components/referral-notice.tsx`
5. Typing and governance:
- typed key access for `common` first (optional but recommended)
- keys live in namespace files; components reference keys only
- launched-locale governance config:
- `src/i18n/rollout.ts` (`LAUNCHED_APP_LANGS`, `REQUIRED_NAMESPACES`)
- message consistency checker:
- `src/scripts/i18n-check.ts`
- npm script:
- `test:i18n:messages`

CI governance rule:

- fail only for required namespaces of launched locales
- do not block on all supported locales at once

### Acceptance checks (met)

- one non-default locale renders shell/common fully
- missing keys visible in dev (no prod crash)
- fallback works as locked (`en`)

## Phase 4 - Formatting Consolidation (compat-first)

### Goals

Unify locale formatting without breaking existing imports.

### Work

1. Create `src/lib/i18n/locale.ts`:
- `mapAppLangToLocale(appLang)` -> `de-DE`, `fr-FR`, etc.
- currency helpers (`getLocaleAndCurrency` or split helpers)
- do not misuse `normalizeToSupported` for full locale tags
2. Keep `src/modules/profile/location-utils.ts` as compatibility re-export or thin wrapper.
3. New code uses `src/lib/i18n/*`.

Locked consolidation statement:

Move runtime locale mapping helpers (`mapAppLangToLocale`, `getLocaleAndCurrency`) into `src/lib/i18n/locale.ts`, keep `location-utils.ts` as compatibility re-export during transition.

### Acceptance checks

- no regression in date/currency formatting
- old imports still compile
- new code uses canonical module

## Phase 4A - Payload/CMS Content Localization Foundation

### Goals

Localize CMS-driven labels (categories/subcategories) with `en` fallback.

### Repo observations

- Categories are not localized (`name` plain) in `src/collections/Categories.ts`
- No locales config in `src/payload.config.ts`

### Locked rules

- localize label fields (`name`, etc.)
- keep `slug` canonical and non-localized (stable URLs)

### Snapshot note

If category text is snapshotted into orders/bookings:

- historical snapshots are not rewritten unless explicitly planned

### Work

1. Enable Payload localization config:
- locales derived from `SUPPORTED_APP_LANGS`
- default locale `en`
- fallback locale `en`
2. Localize category/subcategory display fields:
- localize `name` and other label fields
- keep `slug` non-localized
- decide now vs later for `description`
3. Migration checkpoint:
- backfill `en` for existing docs
- verify admin create/edit works with localized fields before enabling more locales
4. Update reads/procedures:
- resolve label in active request locale
- fallback to `en` consistently

### Acceptance checks

- category/subcategory labels display in selected locale
- missing localized field falls back to `en`
- slugs remain stable and links work across locales

## Phase 5 - Feature-Wave String Migration

### Goal

Translate incrementally in releasable waves.

### Recommended waves

1. Shell/Auth/Common
2. Home/discovery (including category browsing UI)
3. Checkout/booking funnel
4. Orders (customer/tenant/admin)
5. Finance/admin long-tail

### Wave checklist

1. UI strings
2. toasts/alerts
3. empty/error states
4. table headers/filters
5. form validation messages shown to users

### Acceptance checks

- no hardcoded user-facing strings in migrated modules
- locale routing consistent
- critical path translated end-to-end

## Phase 6 - Preference Persistence + Language Switch UX

### Goals

Keep locale stable across refresh/logout/login and deep links.

### Work

1. Standardize locale cookie name.
2. Switcher behavior:
- preserves path and query
- swaps only locale prefix
3. Profile sync (non-edge):
- persist language preference for authenticated users
- do not override explicit URL locale

Precedence rule:

- URL locale wins for current request
- cookie/profile are defaults only when URL has no locale segment

### Acceptance checks

- language survives refresh/logout/login
- switching does not drop context/path
- URL/cookie/profile do not fight each other

## Phase 6A - Transactional Email Localization

### Goals

Send emails in recipient language with consistent fallback.

### Repo observation

- Email templates are mostly English today in `src/modules/email/events.ts`

### Locked rule (type boundary)

Email language resolver returns `AppLang` (short code). Only map to locale tag inside formatting/render helpers.

### Work

1. Email language resolver precedence:
- recipient profile language > tenant default language > `en`
2. Move subject/body copy into messages. Pick one and lock:
- Pattern A: `src/i18n/messages/{lang}/emails/*.json`
- Pattern B: per-event locale template map
3. Pass resolved language into every send path.
4. Start with 2 high-volume events:
- invoice-related
- order/booking created
5. Tests (minimum):
- snapshot/approval for `en` and `de`
- assert fallback to `en` works

### Acceptance checks

- same event renders in `en` and one other locale
- resolver precedence works
- fallback works (dev logs only)

## Phase 7 - Quality Gates and Rollout Controls

### Goals

Prevent regressions across UI, CMS, and emails.

### Work

1. CI checks (scoped to launched locales):
- missing keys per locale (UI and email namespaces)
- extra/stale keys vs `en`
- optional: forbid hardcoded strings in migrated modules only
2. CMS localization checks:
- required localized fields present (at least `en`)
- optionally enforce localized names for launched locales
3. Integration tests for proxy logic:
- redirects, auth protection, tenant rewrite + locale
4. Smoke checks per launched locale:
- landing, auth, checkout start, orders list, category browsing
5. Rollout by language batches.

Explicit fallback test:

Add one explicit test ensuring missing locale key/content falls back to `en` for UI translations, CMS localized fields, and email templates (with dev-only logging).

### Acceptance checks

- CI fails on missing critical keys/content
- proxy/auth/tenant behavior is stable
- no major perf regression
- fallback behavior is correct (`en`)

## Risks and Mitigations (repo-specific)

1. Edge complexity (auth + tenant rewrite + locale)
- mitigate with Phase 1-only scope and targeted redirect tests
2. Helper split (`app-lang` vs `location-utils`)
- mitigate with compatibility re-exports and no big-bang import rewrite
3. Large UI surface
- mitigate with wave-based migration and wave-level merge gates
4. Static rendering surprises
- mitigate by explicitly deciding where static rendering is needed and applying next-intl static-rendering workarounds where needed
5. CMS and email scope creep
- mitigate by isolating work into Phase 4A and Phase 6A with explicit acceptance checks

## Immediate Next Step

Phase 1/2/3 are complete. Start Phase 4:

1. consolidate locale formatting helpers into `src/lib/i18n/locale.ts`
2. keep `src/modules/profile/location-utils.ts` as compatibility re-export during transition
3. migrate new and touched formatting callsites to canonical `src/lib/i18n/*` helpers
4. validate no date/currency regression in Berlin timezone behavior

Recommended order after that:

Phase 4 -> Phase 4A -> Phase 5 -> Phase 6 -> Phase 6A -> Phase 7.

Future migration note:

After upgrading to Next 16 and validating Payload/Clerk compatibility, migrate `src/middleware.ts` -> `src/proxy.ts` in a separate infrastructure change.
