# Booking Request / Tenant Confirmation Lifecycle

## Goal

Introduce a provider confirmation step before a booking becomes scheduled.

Target lifecycle:

```txt
Customer selects slots
-> booking request created
-> tenant confirms or declines
-> confirmed request becomes scheduled
```

This is intentionally narrow. It does not redesign the whole booking/order
system.

## Core Design

Keep `bookings.status` as the technical slot occupancy state.

Use `serviceStatus: "requested"` as the new provider-confirmation workflow
state.

This distinction is important:

```txt
bookings.status = slot availability / hold / blocked state
serviceStatus   = booking/order workflow state
```

In the new model, `bookings.status: "confirmed"` means the slot is attached to
an order and blocked from other customers. It does not by itself mean the
provider has confirmed the booking.

Provider confirmation is represented by:

```ts
serviceStatus: "scheduled"
```

## Lifecycle Terms

### Slot Occupancy

```txt
available = open slot
booked    = temporary cart hold
confirmed = attached to an order / blocked
```

### Workflow

```txt
requested = customer submitted request; tenant has not confirmed
scheduled = tenant confirmed; service is planned
completed = tenant marked service completed
accepted  = customer accepted completion
disputed  = customer disputed completion
canceled  = order no longer active; slots released when applicable
```

## Requested State

`requested` means:

- the customer submitted a booking request
- the tenant has not confirmed yet
- the slots are blocked from other customers
- the order is not yet scheduled
- the customer should not see the request as a guaranteed booking
- the tenant must confirm or decline

After checkout:

```ts
order.serviceStatus = "requested";
booking.status = "confirmed";
booking.serviceStatus = "requested";
```

After tenant confirmation:

```ts
order.serviceStatus = "scheduled";
booking.serviceStatus = "scheduled";
```

## Product Decisions

- Tenant confirmation is per order for v1, not per individual slot.
- Requested slots block availability for other customers.
- Requested orders appear in the customer Orders page immediately.
- Requested bookings appear in the tenant calendar and tenant Orders view.
- Requested bookings must be visually distinct from scheduled bookings.
- Customers may cancel a requested order before tenant confirmation.
- The 24-hour cancellation cutoff starts only after the order is scheduled.
- Tenant decline releases slots immediately.
- Tenant decline reason is optional for v1.
- Order-created emails become booking-request emails.
- Customer receives an email when the request is confirmed.
- Customer receives an email when the request is declined.
- Existing already-scheduled orders remain unchanged. No migration is planned
  beyond adding support for the new status going forward.
- Automatic request expiry is deferred.
- Tenant reminder emails are deferred.

## Tenant Decline Representation

For v1, tenant decline reuses the existing canceled order state instead of
adding a separate `declined` order status.

Minimum declined-request shape:

```ts
order.status = "canceled";
order.canceledByRole = "tenant";
order.cancelReason = declineReason;
```

The UI and email layer may call this "declined" when the previous workflow state
was `requested` and `canceledByRole === "tenant"`.

The system should retain enough metadata to distinguish:

- customer cancellation of a requested order
- tenant decline of a requested order
- normal cancellation of a scheduled order

This distinction matters for admin review, support, email wording, analytics,
and future account-aware support-chat behavior.

Before implementation, decide whether the existing fields are enough for future
review/logging or whether the order schema needs a narrow reason field such as:

```ts
cancellationKind:
  | "customer_cancel"
  | "tenant_cancel"
  | "tenant_decline";
```

If this field is added, it should remain metadata only. It must not replace the
existing `status: "canceled"` state in v1.

## Backend Release Gate

Do not deploy checkout-created requested orders without tenant confirm/decline
and cancellation handling.

The deployable backend slice must include:

- checkout creates requested orders
- tenants can confirm requested orders
- tenants can decline requested orders
- customers can cancel requested orders if allowed
- requested orders cannot be completed too early
- requested orders cannot be invoiced too early
- rollup logic preserves requested status
- focused backend tests for the above behavior

## Rollup Rule

Order rollup must preserve `requested`. It must not normalize requested or
unknown values to scheduled.

Recommended defensive priority:

```txt
if any slot disputed -> disputed
else if all slots accepted -> accepted
else if all slots completed or accepted -> completed
else if any slot requested -> requested
else scheduled
```

Mixed requested/scheduled states should be rare because v1 confirmation is per
order, but rollup code should still handle them safely.

## Non-Goals

- no automatic request expiry in v1
- no tenant reminders in v1
- no full booking redesign
- no fuzzy lifecycle rewrite
- no per-slot tenant confirmation in v1
- no separate declined order status unless a strong product need appears
- no migration of existing already-scheduled orders
- no support-chat account-aware helper implementation in this lifecycle change

## Implementation Sequence

1. Lifecycle design contract
2. Backend enum and type foundation
3. Checkout creates requested orders
4. Tenant confirm and decline mutations
5. Cancellation, completion, rollup, and invoice guards
6. Checkout and customer Orders UI
7. Tenant Orders and calendar UI
8. Emails
9. Full i18n, legal, and support copy pass
10. Full lifecycle regression tests
11. Support chat and Block 13 alignment follow-up

## Questions To Resolve Before Behavior Changes

- Is the existing canceled state plus `canceledByRole`/`cancelReason` enough to
  represent tenant decline, or do we add `cancellationKind`?
- Should customer cancellation of requested orders be available until tenant
  confirmation without any cutoff? Recommendation: yes.
- Should tenants be allowed to decline after the normal 24-hour cutoff?
  Recommendation: yes while the order is still requested.
- Should requested orders count as "has orders" for customer navbar/CTA
  visibility? Recommendation: yes.
- Should requested bookings be hidden from other customers but shown to the
  requesting customer as their own pending/requested slot? Recommendation: yes.
- Should requested bookings appear on tenant dashboard calendar? Recommendation:
  yes, visually distinct and requiring action.
- Should customer payment method setup still be required before submitting a
  request? This is a product decision. Keeping it preserves the current payment
  readiness gate; removing it lowers friction but changes risk.
- Should terms/profile completion remain required before submitting a request?
  Recommendation: yes.

## Support Chat / Block 13 Impact

Block 13 account-aware helper implementation should remain paused until this
lifecycle is implemented or finalized.

After the lifecycle change, update:

- support-chat knowledge for booking request and provider confirmation behavior
- support-chat regression cases around booking status
- `SupportAccountOrderServiceStatusCategory` to include `requested`
- support account next-step keys, for example `await_provider_confirmation`
- `docs/support-chat-phase2-account-aware.md`
