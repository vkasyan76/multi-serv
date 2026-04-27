import test from "node:test";
import assert from "node:assert/strict";
import {
  getOrderCreatedCustomerCopy,
  getOrderCreatedTenantCopy,
  getOrderRequestConfirmedCustomerCopy,
  getOrderRequestDeclinedCustomerCopy,
} from "./order-email-copy";

test("order-created emails describe booking requests, not scheduled bookings", () => {
  const customer = getOrderCreatedCustomerCopy("en");
  const tenant = getOrderCreatedTenantCopy("en");

  assert.match(customer.heading, /request/i);
  assert.match(customer.subject("Provider"), /request/i);
  assert.match(customer.cancellationNoteOpen, /provider.*confirm/i);
  assert.doesNotMatch(customer.heading, /scheduled/i);

  assert.match(tenant.heading, /request/i);
  assert.match(tenant.subject, /request/i);
  assert.match(tenant.cancellationNoteOpen, /confirm or decline/i);
  assert.doesNotMatch(tenant.heading, /scheduled/i);
});

test("order-confirmed customer email says the booking is scheduled", () => {
  const copy = getOrderRequestConfirmedCustomerCopy("en");

  assert.match(copy.heading, /confirmed/i);
  assert.match(copy.subject("Provider"), /confirmed/i);
  assert.match(copy.intro("Provider", "May 1, 2026"), /scheduled/i);
  assert.match(copy.statusNote, /scheduled booking/i);
});

test("order-declined customer email says slots are released and supports a provider note", () => {
  const copy = getOrderRequestDeclinedCustomerCopy("en");

  assert.match(copy.heading, /declined/i);
  assert.match(copy.subject("Provider"), /declined/i);
  assert.match(copy.statusNote, /released/i);
  assert.match(copy.providerReasonLabel ?? "", /provider note/i);
});
