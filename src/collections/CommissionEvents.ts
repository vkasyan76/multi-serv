import type { CollectionConfig } from "payload";
import { isSuperAdmin } from "../lib/access.ts";

export const CommissionEvents: CollectionConfig = {
  slug: "commission_events",
  access: {
    // Keep admin-only; server code uses overrideAccess for inserts.
    read: ({ req }) => isSuperAdmin(req.user),
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  admin: {
    useAsTitle: "paymentIntentId",
    defaultColumns: [
      "collectedAt",
      "tenant",
      "invoice",
      "feeCents",
      "rateBps",
      "ruleId",
      "currency",
      "paymentIntentId",
    ],
  },
  fields: [
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      required: true,
      index: true,
    },
    {
      name: "invoice",
      type: "relationship",
      relationTo: "invoices",
      required: true,
      index: true,
    },
    { name: "currency", type: "text", required: true },
    { name: "feeCents", type: "number", required: true },
    { name: "rateBps", type: "number", required: true },
    { name: "ruleId", type: "text", required: true },
    {
      name: "paymentIntentId",
      type: "text",
      required: true,
      unique: true, // idempotency across webhook retries
      index: true,
    },
    {
      name: "collectedAt",
      type: "date",
      required: true,
      index: true,
      admin: {
        description: "Webhook time when the fee was collected in Stripe.",
      },
    },
  ],
  indexes: [
    { fields: ["tenant", "collectedAt"] },
    { fields: ["collectedAt"] },
    { fields: ["invoice", "collectedAt"] },
  ],
};
