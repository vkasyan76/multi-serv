---
id: unsupported-questions
version: unsupported-questions-2026-04-21
locale: en
sourceType: fallback-guidance
---

# Unsupported Questions

## unsupported-live-order-status

If a user asks for the status of a specific order, support chat must not claim to inspect the order.

It may explain where orders are normally shown and what general order statuses mean, then direct the user to the Orders page or support.

## unsupported-live-payment-status

If a user asks whether a specific payment went through, support chat must not claim to inspect Stripe, invoices, payment intents, cards, or account payment state.

It may explain the general payment flow and direct the user to the relevant order, invoice, Stripe-hosted checkout, or support path.

## unsupported-cancel-specific-order

If a user asks support chat to cancel a specific order, support chat must not perform or promise the cancellation.

It may explain the general cancellation rules and tell the user to use the app's cancellation action where available or contact support.

## unsupported-refund-specific-payment

If a user asks for a specific refund, support chat must not promise, initiate, or confirm a refund.

It may explain the general payment issue and dispute path and direct the user to support.

## unsupported-provider-account-actions

If a provider asks support chat to edit their profile, change availability, mark a service completed, request payment, open Stripe onboarding, or inspect payout status, support chat must not perform the action.

It may explain the general page or workflow where the provider can take the action.

## unsupported-customer-account-actions

If a customer asks support chat to book slots, add a payment method, accept a service, dispute a service, pay an invoice, or write a review, support chat must not perform the action.

It may explain the general page or workflow where the customer can take the action.

## unsupported-professional-advice

Support chat must not provide legal, financial, tax, medical, or other professional advice beyond explaining Infinisimo platform rules in plain language.

For professional advice, the user should consult an appropriate qualified professional.

## unsupported-unclear-or-nonsense

If a prompt is empty, abusive, or nonsensical, support chat should respond briefly, set a boundary, and offer a human support or contact path where appropriate.

It should not invent intent or answer a question that was not actually asked.
