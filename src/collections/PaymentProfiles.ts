// In Stripe Connect (Direct Charges), the “customer + payment method” is scoped to the connected account: we store card-on-file per (user, tenant) pair and prevent duplicates. Stores Stripe identifiers + safe display metadata.
import type { CollectionBeforeValidateHook, CollectionConfig } from "payload";
import { isSuperAdmin } from "../lib/access";

type RelValue = string | { id?: string; value?: string } | null | undefined;

function getRelId(value: RelValue): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;

  if (typeof value.id === "string") return value.id;
  if (typeof value.value === "string") return value.value;

  return undefined;
}

/**
 * Enforce uniqueness on (user, tenant) by maintaining a composite unique key:
 *   userTenantKey = `${userId}:${tenantId}`
 */
const setUserTenantKey: CollectionBeforeValidateHook = ({
  data,
  originalDoc,
}) => {
  if (!data) return data;

  const d = data as Record<string, unknown>;
  const o = (originalDoc ?? {}) as Record<string, unknown>;

  const userId = getRelId(d.user as RelValue) ?? getRelId(o.user as RelValue);
  const tenantId =
    getRelId(d.tenant as RelValue) ?? getRelId(o.tenant as RelValue);

  if (userId && tenantId) {
    d.userTenantKey = `${userId}:${tenantId}`;
  }

  return data;
};

export const PaymentProfiles: CollectionConfig = {
  slug: "payment_profiles",
  labels: {
    singular: "Payment Profile",
    plural: "Payment Profiles",
  },
  admin: {
    group: "Payments",
    defaultColumns: [
      "status",
      "user",
      "tenant",
      "cardBrand",
      "cardLast4",
      "setupCompletedAt",
      "updatedAt",
    ],
  },
  access: {
    read: ({ req }) => {
      if (isSuperAdmin(req.user)) return true;

      const user = req.user as { id?: string } | null | undefined;
      if (!user?.id) return false;

      // user can only read their own payment profile docs
      return { user: { equals: user.id } };
    },
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  hooks: {
    beforeValidate: [setUserTenantKey],
  },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      required: true,
      index: true,
    },
    {
      name: "userTenantKey",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        hidden: true,
        readOnly: true,
      },
    },

    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "missing",
      index: true,
      options: [
        { label: "Missing", value: "missing" },
        { label: "Active", value: "active" },
        { label: "Disabled", value: "disabled" },
      ],
    },

    // Stripe identifiers (Connect-scoped)
    {
      name: "stripeAccountId",
      type: "text",
      index: true,
      admin: {
        description: "Connected account ID (acct_...) for this tenant.",
      },
    },
    { name: "stripeCustomerId", type: "text", index: true },
    { name: "defaultPaymentMethodId", type: "text", index: true },

    // Display-only metadata (never store PAN/CVC)
    { name: "cardBrand", type: "text" },
    { name: "cardLast4", type: "text" },
    { name: "cardExpMonth", type: "number", min: 1, max: 12 },
    { name: "cardExpYear", type: "number" },

    { name: "setupCompletedAt", type: "date", index: true },
    { name: "lastUsedAt", type: "date", index: true },
    { name: "disabledAt", type: "date", index: true },
  ],
};
