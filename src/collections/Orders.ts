import type { CollectionConfig } from "payload";
import { isSuperAdmin } from "../lib/access.ts";

export const Orders: CollectionConfig = {
  slug: "orders",
  access: {
    // Keep strict for now; later you can let tenants read their own orders.
    read: ({ req }) => isSuperAdmin(req.user),
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  admin: {
    // NOTE: keep `status` as the payment status for now (matches your current Stripe flow)
    useAsTitle: "status",
    defaultColumns: [
      "status",
      "serviceStatus",
      "invoiceStatus",
      "amount",
      "currency",
      "tenant",
      "user",
      "paymentDueAt",
      "receiptUrl",
      "createdAt",
    ],
  },
  fields: [
    /**
     * PAYMENT STATUS (current behavior)
     * - Keep this unchanged so your existing checkout + webhook flow continues to work.
     */
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: ["pending", "paid", "canceled", "refunded"],
      index: true,
    },
    /**
     * SERVICE / ACCEPTANCE STATUS (new)
     * - This tracks the pay-after-acceptance lifecycle.
     * - It is independent from Stripe/payment.
     */
    {
      name: "serviceStatus",
      type: "select",
      required: true,
      defaultValue: "scheduled",
      options: ["scheduled", "completed", "accepted", "disputed"],
      index: true,
      admin: {
        description:
          "Order-level service lifecycle: scheduled → completed → accepted (or disputed).",
      },
    },

    /**
     * INVOICE STATUS (new)
     * - This tracks invoice issuance & due/overdue state.
     */
    {
      name: "invoiceStatus",
      type: "select",
      required: true,
      defaultValue: "none",
      options: ["none", "draft", "issued", "void", "overdue", "paid"],
      index: true,
      admin: {
        description:
          "Invoice lifecycle: none → draft/issued → overdue/paid (or void).",
      },
    },
    // Key lifecycle timestamps (new)
    { name: "serviceCompletedAt", type: "date", index: true },
    { name: "acceptedAt", type: "date", index: true },
    { name: "disputedAt", type: "date", index: true },

    // Invoice identifiers + timing (new)
    { name: "invoiceNumber", type: "text", index: true },
    { name: "invoiceIssuedAt", type: "date", index: true },
    { name: "paymentDueAt", type: "date", index: true },

    // Optional: record the moment we consider it paid (in addition to status=paid)
    { name: "paidAt", type: "date", index: true },

    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      hasMany: false,
    },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      required: true,
      hasMany: false,
    },
    {
      name: "slots",
      type: "relationship",
      relationTo: "bookings",
      hasMany: true,
      required: true,
      admin: { description: "Booked slots included in this order." },
    },
    {
      name: "amount",
      type: "number",
      required: true,
      admin: { description: "Total amount in cents." },
    },
    {
      name: "currency",
      type: "text",
      required: true,
      defaultValue: "eur",
    },
    {
      name: "applicationFee",
      type: "number",
      admin: { description: "Platform fee in cents." },
    },
    {
      name: "destination",
      type: "text",
      admin: { description: "Connected account (Stripe) receiving the funds." },
    },
    {
      name: "checkoutSessionId",
      type: "text",
      index: true,
      admin: { description: "Stripe Checkout Session ID." },
    },
    {
      name: "paymentIntentId",
      type: "text",
      index: true,
      admin: { description: "Stripe Payment Intent ID." },
    },
    {
      name: "balanceTxId",
      type: "text",
      admin: { description: "Stripe Balance Transaction ID (optional)." },
    },
    {
      name: "receiptUrl",
      type: "text",
    },
    {
      name: "reservedUntil",
      type: "date",
      admin: { description: "Optional hold window for UX." },
    },
    {
      name: "notes",
      type: "textarea",
    },
    // NEW: Immutable identity snapshots (required)
    {
      name: "customerSnapshot",
      type: "group",
      admin: {
        description: "Immutable customer identity captured at checkout time.",
        readOnly: true,
      },
      fields: [
        { name: "firstName", type: "text", required: true },
        { name: "lastName", type: "text", required: true },
        { name: "location", type: "text", required: true },
        { name: "country", type: "text", required: true },
        { name: "email", type: "email", required: false },
      ],
    },
    {
      name: "vendorSnapshot",
      type: "group",
      admin: {
        description: "Immutable vendor identity captured at checkout time.",
        readOnly: true,
      },
      fields: [
        { name: "tenantName", type: "text", required: true },
        { name: "tenantSlug", type: "text", required: true },
        { name: "stripeAccountId", type: "text", required: false },
      ],
    },
  ],
  timestamps: true,
};
