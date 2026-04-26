# Support Chat Phase 2 Account-Aware Boundary

Phase 2 adds limited account-aware support helpers to the existing support-chat
system. It must remain backend-governed: the model does not get broad database
access, broad search capability, tool-calling, or action permissions.

## Current Contract Scope

This document started as Block 13 Commit 1 and is amended by the booking
request / tenant confirmation bridge commit so future account-aware helpers use
the corrected lifecycle.

This contract defines types, versioning, and boundaries. Contract updates must
not add:

- database reads
- helper implementation
- support-chat routing changes
- model calls
- UI changes
- account data access

## Core Rule

Phase 2 is backend-security-first, not AI-first.

The model must never receive broad access to orders, payments, invoices, users,
Stripe, Payload, MongoDB, or internal records. If account-aware wording is ever
model-drafted later, the model may only receive a sanitized DTO produced by an
approved server helper.

## Approved Initial Helpers

The initial helper set is intentionally narrow:

- `getOrderStatusForCurrentUser`
- `getPaymentStatusForCurrentUser`
- `canCancelOrderForCurrentUser`

The cancellation helper is read-only. It may report eligibility; it must not
cancel an order.

## Authoritative Identity

The authenticated user identity source is `ctx.userId` from Clerk.

Before ownership checks, server code must resolve that Clerk user id to the
existing Payload `users` document using the same lookup pattern already used in
server procedures. User-provided ids must never be trusted for ownership.

## Helper Result Shape

Normal helper outcomes must use discriminated results:

```ts
{ ok: true; data: T } | { ok: false; reason: SupportAccountHelperDeniedReason }
```

Normal denied cases should not throw. Throw only for infrastructure or system
errors.

Denied reasons are stable:

- `unauthenticated`
- `missing_reference`
- `invalid_reference`
- `not_found_or_not_owned`
- `unsupported_reference_type`

`not_found` and `not_owned` intentionally collapse to
`not_found_or_not_owned`. Support chat must not leak whether another user's
object exists.

## Reference Policy

Initial helpers require exact targeted references only.

Allowed reference types for the first contract:

- `order_id`
- `invoice_id`

Deferred reference types:

- `payment_reference`
- `public_order_display_reference`
- `latest_order`
- `recent_payment`
- `provider_name`
- `date_based_lookup`
- `service_name_lookup`
- `natural_language_reference`
- `order_history`
- `payment_history`

`payment_reference` is deferred because the current codebase exposes Stripe and
checkout identifiers internally, but Commit 1 does not establish a safe
user-visible payment reference for support-chat lookup.

Requests such as "find my latest order", "check all my payments", or "show my
order history" are search problems, not initial Phase 2 helper inputs.

## Output Policy

DTOs must use stable categories and reason codes as primary data. Labels are
wording and may drift, so they should not be the primary contract.

Allowed output fields include:

- order/service status category
- payment status category
- invoice status category
- cancellation eligibility boolean
- safe cancellation block reason
- relevant safe dates
- next-step copy key
- short support-safe explanation only if needed later

Order/service status categories include `requested`. A requested order means
the customer submitted a booking request, the provider has not confirmed it yet,
and the booking should not be described as scheduled.

When a helper DTO reports `requested`, the preferred next-step key is
`await_provider_confirmation` unless cancellation eligibility or another more
specific safe next step applies.

DTOs must not expose:

- raw database records
- raw Stripe internals
- internal payment processor metadata
- unrelated customer/provider data
- internal admin notes
- full order/payment history
- broad relationship objects
- the user-provided lookup reference unless a later commit proves it is needed

## Failure Policy

All helper failures fail closed. These cases must not leak object existence or
ownership:

- unauthenticated user
- missing input
- invalid input
- not found
- not owned by current user
- unsupported reference type

Public support responses should avoid wording such as "this order exists but
does not belong to you."

## Sequencing

Do not implement support-chat routing until backend helpers and helper
ownership/safety tests are complete.

Recommended order:

1. contracts, types, versioning, and boundary document
2. backend helper implementation
3. backend helper ownership and safety tests
4. deterministic server-authored routing
5. Phase 2 regression suite
6. optional model-drafted wording from sanitized DTOs
7. optional admin/logging review polish
