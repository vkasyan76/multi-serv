# Support Chat - Step 1 Scope Snapshot (Codebase Study)

## Purpose

This document captures the initial analysis of user-facing flows in the Infinisimo codebase to guide the creation of the support knowledge pack.

It is a working reference for:

- identifying likely user questions
- structuring support knowledge files
- ensuring alignment with actual product behavior

This document is not a source of truth. Final support content must be verified against code and Terms during drafting.

## Core User Flows Identified

### 1. Authentication & Registration

Users:

- sign up / sign in via Clerk
- are mapped to Payload users
- must complete profile: name, username, address, country, language
- must provide valid address/location, used for discovery

Likely questions:

- how to create an account
- why profile completion is required
- why location/address is needed
- why address must be selected from suggestions
- why profile saving fails

### 2. Provider Onboarding

Users can:

- become providers after profile completion
- accept Terms before creating provider profile
- define business info: name, pricing, categories, service types, VAT details, contact details, description
- proceed to Stripe onboarding for payouts

Important behaviors:

- business name affects the public URL and may be locked after creation
- VAT may be validated and is EU-specific
- provider country is derived from the general profile

Likely questions:

- how to become a provider
- why profile is required first
- why business name cannot be changed
- how to choose categories
- why VAT validation fails
- why Stripe onboarding is required

### 3. Booking & Calendar

Providers:

- create and manage availability slots
- can edit, move, resize, or delete available slots

Customers:

- select available future slots
- may select multiple slots, with limits

Constraints:

- past slots are not bookable
- 23:00 starts are disabled to avoid crossing midnight for 1-hour slots
- slots can disappear if changed, removed, booked, or no longer available

Likely questions:

- how to add availability
- why a slot cannot be selected
- why slots disappear
- why no slots are visible
- why 23:00 is not allowed

### 4. Checkout & Payments

Customers:

- must be signed in
- must complete profile / invoice address requirements
- must select a service for every selected slot
- must add a payment method when required for the provider
- must accept Terms

Behavior:

- booking creates an order
- payment happens later in the slot lifecycle
- failed checkout/order attempts may release slots back to availability

Likely questions:

- why profile is required for checkout
- why payment method is needed upfront
- when payment is actually charged
- what happens if checkout fails

### 5. Orders Lifecycle

Orders include:

- statuses: scheduled, completed, accepted, disputed, canceled
- payment states: not invoiced yet, payment due, paid

Flow:

- provider marks service complete
- customer accepts or disputes
- provider requests payment
- customer pays
- review becomes available after payment

Likely questions:

- where to find orders
- what statuses mean
- when payment is requested
- how disputes work
- when reviews are available

### 6. Cancellation Rules

Cancellation depends on:

- time window: `CANCELLATION_WINDOW_HOURS`
- order/payment/invoice state
- service status
- slot validity

Blocked if:

- already paid
- already canceled
- invoice exists
- cutoff passed
- service status is no longer scheduled
- slots are missing, invalid, or already paid

Behavior:

- successful cancellation may release slots back to availability

Likely questions:

- why cancellation is not available
- when cancellation cutoff applies
- why paid or invoiced orders cannot be canceled

### 7. Terms & Platform Responsibilities

Key principles:

- Infinisimo is a marketplace intermediary
- providers are responsible for services
- bookings reserve time slots
- cancellation rules are limited by policy
- provider completion does not automatically prove service delivery
- customer inactivity does not automatically mean acceptance unless a specific process says so
- payments are processed via Stripe where enabled
- platform payments are currently EUR-focused
- providers remain responsible for refunds and related payment obligations
- disputes are handled through provider/platform support processes where applicable

Likely questions:

- who is responsible for service quality
- how disputes work
- how payments and fees work
- who to contact for issues

## Unsupported / Out-of-Scope Questions

The assistant must not handle:

- specific order lookups
- payment status checks
- cancellation execution
- account modifications
- Stripe account diagnostics

Examples:

- "Where is my order?"
- "Did my payment go through?"
- "Cancel my booking."
- "Check my invoice."
- "Why was my Stripe account rejected?"

Handling approach:

- explain the limitation
- provide general guidance
- redirect to the relevant app page or support/contact path

## Knowledge Pack Structure

The repo-managed support knowledge pack currently lives at:

```txt
src/modules/support-chat/server/knowledge/
```

Initial files:

```txt
support-faq.en.md
registration-help.en.md
provider-onboarding.en.md
booking-calendar-help.en.md
booking-payment-policy.en.md
terms-reference.en.md
unsupported-questions.en.md
```

## Source-Of-Truth Reminder

This snapshot is only a planning reference. The support assistant should rely on the structured knowledge files and verified source material, not on this document as final product policy.
