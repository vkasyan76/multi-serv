---
id: booking-payment-policy
version: booking-payment-policy-2026-04-26
locale: en
sourceType: policy-summary
---

# Booking And Payment Policy

## booking-customer-requirements

Audience: customer.

To book slots, a customer must be signed in, complete the required profile and invoice address information, select a service for every selected slot, add a payment method when required for the provider, and accept the Terms of Use.

If any of these steps are missing, checkout may stop and ask the customer to complete the missing requirement.

## booking-order-created-payment-later

Audience: customer.

In the current slot lifecycle flow, checkout creates a booking request first. The provider must confirm the request before the booking becomes scheduled.

Creating a booking request does not mean the customer is charged immediately. The app tells customers that there is no charge at booking. Payment happens later after service completion is accepted or otherwise reaches the payment step supported by the app flow.

## booking-service-lifecycle

Audience: customer and provider.

The typical service lifecycle is: the customer submits a booking request, the provider confirms or declines it, a confirmed request becomes scheduled, the provider performs the service, the provider marks the service completed after the slot has ended, the customer accepts or disputes completion, and payment may then be requested.

The provider's completion notice does not by itself prove service delivery.

## booking-payment-method

Audience: customer.

The app may require the customer to add a payment method for the provider before creating an order.

Adding a payment method prepares the payment flow. It does not by itself mean the service has been paid.

## booking-provider-payment-request

Audience: provider.

Providers can request payment after the customer has accepted the completed service, according to the current order flow.

If an invoice is already issued, the app may prevent issuing another one.

## booking-cancellation-window

Audience: customer and provider.

A customer may cancel a requested booking before provider confirmation. This requested-state cancellation is separate from the scheduled-booking cancellation window.

After the provider confirms a request and the booking becomes scheduled, cancellations may be allowed only within the applicable cancellation window. The default platform cancellation window is 24 hours before the booking start time.

Cancellation may be blocked if the order is already canceled, already paid, already invoiced, no longer in a cancelable lifecycle state, has invalid or missing slots, has paid slots, or the cancellation cutoff has passed.

If a provider declines a requested booking, the requested slots are released.

## booking-disputes

Audience: customer and provider.

After a provider marks a service completed, the customer can dispute a completed slot and may add an optional reason.

The reason helps the provider understand what went wrong. Platform support may request information from both parties when handling service issues or disputes.

## booking-payment-issues

Audience: customer and provider.

If there is a payment issue after a customer has paid, the user should contact support and provide the relevant order or invoice details.

Support chat should not promise, initiate, or confirm a refund. It may explain that payment disputes and refund questions are handled through provider/platform support processes according to the Terms and the applicable payment flow.

## booking-currency-and-fees

Audience: customer and provider.

Platform payments are currently supported in EUR only.

Customers pay the booking total shown at payment, including applicable taxes. Infinisimo does not add a separate customer-facing platform fee at this time unless it is explicitly shown before payment.

Providers authorize Infinisimo and Stripe to collect applicable platform commission and Stripe processing fees from platform-processed payments.
