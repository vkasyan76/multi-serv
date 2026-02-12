import type { CollectionConfig } from "payload";
import { isSuperAdmin } from "../lib/access.ts";

export const CommissionStatements: CollectionConfig = {
  slug: "commission_statements",
  access: {
    // Keep admin-only; server code uses overrideAccess for inserts.
    read: ({ req }) => isSuperAdmin(req.user),
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  admin: {
    useAsTitle: "statementNumber",
    defaultColumns: [
      "statementNumber",
      "tenant",
      "periodStart",
      "periodEnd",
      "currency",
      "totalsNetCents",
      "status",
      "createdAt",
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
    { name: "periodStart", type: "date", required: true, index: true },
    { name: "periodEnd", type: "date", required: true, index: true },
    { name: "currency", type: "text", required: true },
    {
      name: "timezone",
      type: "text",
      required: true,
      defaultValue: "Europe/Berlin",
      admin: { description: "Statement period timezone (locked for MVP)." },
    },
    {
      name: "basis",
      type: "text",
      required: true,
      defaultValue: "collectedAt",
      admin: { description: "Date basis used to include ledger events." },
    },
    { name: "totalsNetCents", type: "number", required: true },
    { name: "totalsVatCents", type: "number", required: true },
    { name: "totalsGrossCents", type: "number", required: true },
    {
      name: "lineItems",
      type: "array",
      fields: [
        {
          name: "commissionEvent",
          type: "relationship",
          relationTo: "commission_events",
          required: true,
        },
        { name: "feeCents", type: "number", required: true },
        { name: "paymentIntentId", type: "text", required: true },
        { name: "collectedAt", type: "date", required: true },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "issued",
      options: ["draft", "issued", "void", "settled"],
      index: true,
    },
    { name: "statementNumber", type: "text", required: true, unique: true, index: true },
  ],
  indexes: [{ fields: ["tenant", "periodStart", "currency"], unique: true }],
};
