import type { CollectionConfig } from "payload";
import { isSuperAdmin } from "../lib/access.ts";

export const PromotionAllocations: CollectionConfig = {
  slug: "promotion_allocations",
  access: {
    read: ({ req }) => isSuperAdmin(req.user),
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  admin: {
    useAsTitle: "counterKey",
    defaultColumns: [
      "promotion",
      "status",
      "counterKey",
      "reservationKey",
      "tenant",
      "invoice",
      "stripePaymentIntentId",
      "reservedAt",
      "consumedAt",
    ],
  },
  fields: [
    {
      name: "promotion",
      type: "relationship",
      relationTo: "promotions",
      required: true,
      index: true,
    },
    {
      name: "counterKey",
      type: "text",
      required: true,
      index: true,
    },
    {
      // Idempotency key for one checkout-attempt reservation.
      name: "reservationKey",
      type: "text",
      admin: {
        description: "Unique reservation attempt key to prevent double-reserve on retries.",
      },
    },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      index: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "reserved",
      options: ["reserved", "consumed", "released"],
      index: true,
    },
    {
      name: "reservedAt",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      index: true,
    },
    { name: "consumedAt", type: "date" },
    {
      name: "invoice",
      type: "relationship",
      relationTo: "invoices",
      index: true,
    },
    { name: "stripeCheckoutSessionId", type: "text", index: true },
    { name: "stripePaymentIntentId", type: "text", index: true },
    { name: "appliedRateBps", type: "number", required: true },
    { name: "appliedRuleId", type: "text", required: true, index: true },
    { name: "notes", type: "textarea" },
  ],
  indexes: [
    { fields: ["counterKey", "status"] },
    { fields: ["promotion", "status"] },
    // Partial unique indexes live in payload.config.ts:onInit.
    // Payload collection-level indexes do not support partialFilterExpression.
  ],
  timestamps: true,
};
