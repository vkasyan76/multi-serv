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
    useAsTitle: "status",
    defaultColumns: [
      "status",
      "amount",
      "currency",
      "tenant",
      "user",
      "receiptUrl",
      "createdAt",
    ],
  },
  fields: [
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: ["pending", "paid", "canceled", "refunded"],
      index: true,
    },
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
  ],
  timestamps: true,
};
