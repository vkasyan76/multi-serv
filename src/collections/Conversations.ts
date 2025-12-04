import type { CollectionConfig, Where } from "payload";
import { isSuperAdmin } from "../lib/access.ts";

export const Conversations: CollectionConfig = {
  slug: "conversations",
  indexes: [{ fields: ["tenant", "customer"], unique: true }],
  admin: {
    useAsTitle: "id",
    defaultColumns: ["tenant", "customer", "status", "updatedAt"],
  },
  access: {
    read: ({ req }) => {
      if (isSuperAdmin(req.user)) return true;
      if (!req.user) return false;

      const where: Where = {
        or: [
          { customer: { equals: req.user.id } },
          { tenantUser: { equals: req.user.id } },
        ],
      };

      return where;
    },
    create: ({ req }) => !!req.user,
    update: ({ req }) => {
      if (isSuperAdmin(req.user)) return true;
      if (!req.user) return false;

      const where: Where = {
        or: [
          { customer: { equals: req.user.id } },
          { tenantUser: { equals: req.user.id } },
        ],
      };

      return where;
    },
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        // Normalize ids
        const tenantId =
          typeof data.tenant === "string" ? data.tenant : data.tenant?.id;

        const customerId =
          typeof data.customer === "string" ? data.customer : data.customer?.id;

        // Default customer to the authenticated payload user (unless superadmin is doing admin work)
        if (!data.customer && req.user && !isSuperAdmin(req.user)) {
          data.customer = req.user.id;
        }

        // Cache tenantUser from the tenant.user relation
        if (tenantId) {
          const tenant = await req.payload.findByID({
            collection: "tenants",
            id: tenantId,
            depth: 0,
          });

          const tenantUserId =
            typeof tenant.user === "string" ? tenant.user : tenant.user?.id;

          if (tenantUserId) data.tenantUser = tenantUserId;
        }

        // Prevent duplicates (tenant + customer)
        if (
          operation === "create" &&
          tenantId &&
          (customerId || data.customer)
        ) {
          const cust =
            customerId ??
            (typeof data.customer === "string"
              ? data.customer
              : data.customer?.id);

          if (cust) {
            const existing = await req.payload.find({
              collection: "conversations",
              limit: 1,
              where: {
                and: [
                  { tenant: { equals: tenantId } },
                  { customer: { equals: cust } },
                ],
              },
            });

            if (existing.docs.length) {
              throw new Error(
                "Conversation already exists for this tenant and user."
              );
            }
          }
        }

        return data;
      },
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
      name: "customer",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      // cached for fast access checks + dashboard queries
      name: "tenantUser",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
      admin: {
        description:
          "Cached from tenant.user for faster filtering and access control.",
        position: "sidebar",
      },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "open",
      options: [
        { label: "Open", value: "open" },
        { label: "Archived", value: "archived" },
        { label: "Closed", value: "closed" },
      ],
      index: true,
      admin: { position: "sidebar" },
    },
    {
      name: "lastMessageAt",
      type: "date",
      admin: { readOnly: true, position: "sidebar" },
    },
    {
      name: "lastMessagePreview",
      type: "text",
      admin: { readOnly: true },
    },
  ],
};
