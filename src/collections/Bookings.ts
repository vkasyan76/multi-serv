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
      name: "status",
      type: "select",
      options: ["available", "booked", "confirmed"],
      defaultValue: "available",
      required: true,
      index: true,
    }, // available -> booked -> confirmed (for payment flow)

    // NEW: chosen subcategory/service at booking time
    {
      name: "service",
      type: "relationship",
      relationTo: "categories",
      required: false,
      index: true,
      admin: {
        description: "Selected service (subcategory) for this booking.",
      },
    },

    { name: "notes", type: "textarea" },
    {
      name: "serviceSnapshot",
      type: "group",
      admin: {
        description: "Denormalized display-only snapshot at booking time",
        position: "sidebar",
      },
      fields: [
        // service (category) bits
        { name: "serviceName", type: "text", admin: { readOnly: true } },
        { name: "serviceSlug", type: "text", admin: { readOnly: true } },

        // tenant bits (where the price lives)
        { name: "tenantName", type: "text", admin: { readOnly: true } },
        { name: "tenantSlug", type: "text", admin: { readOnly: true } },
        { name: "hourlyRate", type: "number", admin: { readOnly: true } },
      ],
    },
  ],
  indexes: [
    // Compound index for tenant + start time queries (most common)
    { fields: ["tenant", "start"] },
    // Compound index for tenant + end time queries
    { fields: ["tenant", "end"] },
  ],
  timestamps: true,
};
