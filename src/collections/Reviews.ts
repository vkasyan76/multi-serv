import type { CollectionConfig } from "payload";
import { isSuperAdmin } from "../lib/access";

export const Reviews: CollectionConfig = {
  slug: "reviews",
  admin: { useAsTitle: "title" },
  access: {
    read: ({ req }) => isSuperAdmin(req.user),
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  fields: [
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      required: true,
      index: true,
    },
    { name: "tenantSlug", type: "text", required: true, index: true },
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    { name: "rating", type: "number", required: true, min: 1, max: 5 },
    { name: "title", type: "text", required: true, maxLength: 120 },
    { name: "body", type: "textarea", required: true },
  ],
  indexes: [
    { fields: ["tenant", "author"], unique: true }, // <— add this row
  ],
};
