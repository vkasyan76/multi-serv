import type { CollectionConfig } from "payload";

import { isSuperAdmin } from "../lib/access";

export const Bookings: CollectionConfig = {
  slug: "bookings",
  admin: { useAsTitle: "status" },
  access: {
    // anonymous users (and non-admins) see only available slots; super-admins see everything.
    read: ({ req }) =>
      isSuperAdmin(req.user) ? true : { status: { equals: "available" } },

    // Mutations: must be authenticated. Ownership checks are enforced in tRPC
    // and we call Payload with overrideAccess: true there.
    // Keep deletes strict & consistent with other collections
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
    { name: "customer", type: "relationship", relationTo: "users" }, // null when "available"
    { name: "start", type: "date", required: true, index: true }, // ISO UTC
    { name: "end", type: "date", required: true },
    {
      name: "mode",
      type: "select",
      options: ["online", "onsite"],
      required: true,
    },
    {
      name: "status",
      type: "select",
      options: ["available", "confirmed"],
      defaultValue: "available",
      required: true,
      index: true,
    }, // optional, for later pricing
    { name: "notes", type: "textarea" },
  ],
  indexes: [
    // Compound index for tenant + start time queries (most common)
    { fields: ["tenant", "start"] },
    // Compound index for tenant + end time queries
    { fields: ["tenant", "end"] },
  ],
  timestamps: true,
};
