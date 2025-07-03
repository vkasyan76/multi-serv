import { isSuperAdmin } from "../lib/access.ts";
import type { CollectionConfig } from "payload";

export const Tenants: CollectionConfig = {
  slug: "tenants",
  access: {
    create: ({ req }) => isSuperAdmin(req.user), // Users should be able to update their details by default, the rest - not
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  admin: {
    useAsTitle: "slug",
  },
  fields: [
    {
      name: "name",
      required: true,
      type: "text",
      label: "Store Name",
      admin: {
        description: "This is the name of the store.",
      },
    },
    {
      name: "slug",
      type: "text",
      index: true,
      required: true,
      unique: true,
      access: {
        update: ({ req }) => isSuperAdmin(req.user), // Only super-admin can update the subdomain slug
      },
      admin: {
        description:
          "This is the subdomain of the store  (e.g. [slug].yourdomain.com.)",
      },
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
    },
    // to ensure that the tenant has verified their stripe account:
    {
      name: "stripeAccountId",
      type: "text",
      required: true,
      admin: {
        // readOnly: true,
        description: "Stripe account ID associated with your shop.",
      },
      access: {
        update: ({ req }) => isSuperAdmin(req.user), // Only super-admin can update this field
      },
    },
    {
      name: "stripeDetailsSubmitted",
      type: "checkbox", // boolean
      access: {
        update: ({ req }) => isSuperAdmin(req.user), // Only super-admin can update this field
      },
      admin: {
        // readOnly: true,
        description:
          "You cannot create products until you submit your stripe details.",
      },
    },
  ],
};
