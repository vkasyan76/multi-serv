---
id: provider-onboarding
version: provider-onboarding-2026-04-21
locale: en
sourceType: operational-guidance
---

# Provider Onboarding

## provider-who-can-become-provider

A signed-in user can start provider setup after completing the general profile.

The user must have a location in the general profile so customers can find the provider in local searches.

## provider-terms-before-provider-profile

Users must accept the current Terms of Use before creating a provider profile.

If Terms acceptance is missing, the app opens a Terms acceptance step before continuing.

## provider-profile-fields

Provider setup includes business name, hourly rate, service type, categories, subcategories, business country, optional VAT details, optional phone and website, image, and service description.

The service description should explain the provider's services, experience, and what makes the provider unique.

## provider-business-name-url

The business name is used for the provider page URL.

After creation, the business name is treated as locked because changing it would affect the public page URL.

## provider-categories-and-services

Providers choose service types such as on-site or online, plus categories and subcategories.

Subcategories depend on selected categories. If no category is selected, the app may ask the user to select categories first.

## provider-hourly-rate

Providers set an hourly rate in the app's currency context. The profile form validates that the hourly rate is a number and at least 1 EUR.

The visible total for a booking is based on the selected slots, service selection, and provider pricing shown in the app.

## provider-vat

VAT registration is optional in the provider form, but if a provider marks themselves as VAT-registered, a VAT number is required.

VAT setup is available for EU countries only, and EU VAT IDs may be validated through VIES. Providers remain responsible for their own tax compliance.

## provider-payouts-stripe

After creating a provider profile, the provider should complete Stripe onboarding in the Payments section to enable payouts.

The Payments section can show onboarding status, payout status, and Stripe dashboard links when available.

Support chat can explain the general steps, but it cannot inspect or fix a specific Stripe account status.

## provider-availability-next-step

After provider setup, the provider can manage availability in the calendar.

Customers can book only available future slots. If no future availability exists, customers may not see bookable slots.
