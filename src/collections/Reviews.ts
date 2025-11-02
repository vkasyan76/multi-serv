import type { CollectionConfig } from "payload";

export const Reviews: CollectionConfig = {
  slug: "reviews",
  admin: { useAsTitle: "title" },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
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
