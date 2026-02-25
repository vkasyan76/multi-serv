import test from "node:test";
import assert from "node:assert/strict";
import { renderVendorCreatedTenantTemplate } from "./vendor-created-tenant.tsx";

const BASE_INPUT = {
  recipientName: "Tenant User",
  tenantSlug: "react_jedi",
  ctaUrl: "https://example.com/profile?tab=vendor",
  locale: "de",
};

test("renderVendorCreatedTenantTemplate renders without promo when missing/null", async () => {
  const missing = await renderVendorCreatedTenantTemplate({ ...BASE_INPUT });
  assert.ok(missing.html.includes("Provider profile created"));
  assert.ok(!missing.html.includes("Referral campaign eligibility"));
  assert.ok(!missing.text.includes("Referral campaign eligibility"));

  const withNull = await renderVendorCreatedTenantTemplate({
    ...BASE_INPUT,
    promotion: null,
  });
  assert.ok(!withNull.html.includes("Referral campaign eligibility"));
  assert.ok(!withNull.text.includes("Referral campaign eligibility"));
});

test("renderVendorCreatedTenantTemplate renders promo section when promotion payload is valid", async () => {
  const result = await renderVendorCreatedTenantTemplate({
    ...BASE_INPUT,
    promotion: {
      id: "promo-1",
      type: "time_window_rate",
      rateBps: 300,
      endsAt: "2099-12-31T00:00:00.000Z",
    },
  });

  assert.ok(result.html.includes("Referral campaign eligibility"));
  assert.ok(
    result.html.includes(
      "Other campaign rules and priority may apply at checkout.",
    ),
  );
  assert.ok(result.text.includes("Referral campaign eligibility"));
  assert.ok(result.text.includes("3%"));
});

test("renderVendorCreatedTenantTemplate ignores invalid promotion payload", async () => {
  const invalid = await renderVendorCreatedTenantTemplate({
    ...BASE_INPUT,
    promotion: {
      id: "promo-1",
      type: "time_window_rate",
      rateBps: "3.5", // invalid: parsePromotion requires integer bps
      endsAt: "2099-12-31T00:00:00.000Z",
    },
  });

  assert.ok(!invalid.html.includes("Referral campaign eligibility"));
  assert.ok(!invalid.text.includes("Referral campaign eligibility"));
});
