import type { CollectionConfig } from "payload";
import { isSuperAdmin } from "../lib/access.ts";

export const PromotionCounters: CollectionConfig = {
  slug: "promotion_counters",
  access: {
    read: ({ req }) => isSuperAdmin(req.user),
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  admin: {
    useAsTitle: "counterKey",
    defaultColumns: [
      "counterKey",
      "promotion",
      "tenant",
      "used",
      "limit",
      "active",
      "updatedAt",
    ],
  },
  fields: [
    {
      name: "counterKey",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description:
          "Unique atomic gate key (e.g. promo:<promotionId>:global or promo:<promotionId>:tenant:<tenantId>).",
      },
    },
    {
      name: "promotion",
      type: "relationship",
      relationTo: "promotions",
      required: true,
      index: true,
    },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      index: true,
      admin: {
        description: "Set only for per-tenant counters.",
      },
    },
    {
      name: "limit",
      type: "number",
      required: true,
      admin: {
        description:
          "Initialized from promotion at first reservation. Enforced cap for this counter. To change limits, duplicate promotion.",
      },
      validate: (value: unknown) => {
        const num = Number(value);
        if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1) {
          return "Limit must be an integer >= 1.";
        }
        return true;
      },
    },
    {
      name: "used",
      type: "number",
      required: true,
      defaultValue: 0,
      validate: (value: unknown) => {
        const num = Number(value);
        if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
          return "Used must be a non-negative integer.";
        }
        return true;
      },
    },
    {
      name: "active",
      type: "checkbox",
      required: true,
      defaultValue: true,
      index: true,
    },
  ],
  indexes: [{ fields: ["promotion", "tenant"] }],
  timestamps: true,
};
