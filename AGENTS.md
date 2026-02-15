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

## If Unsure

- Prefer tracing from UI call site -> tRPC procedure -> Payload query.
- Keep behavior compatible with latest finance commits:
  - wallet summary
  - wallet transactions
  - wallet export
  - monthly commission statements
