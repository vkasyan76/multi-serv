import { isSuperAdmin } from "../lib/access.ts";
import type { CollectionConfig } from "payload";
import { TelephoneField } from "@nouance/payload-better-fields-plugin/Telephone";

export const Tenants: CollectionConfig = {
  slug: "tenants",
  access: {
    create: ({ req }) => isSuperAdmin(req.user), // Users should be able to update their details by default, the rest - not
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  admin: {
    useAsTitle: "slug",
    defaultColumns: ["name", "slug", "hourlyRate"],
  },
  fields: [
    {
      name: "name",
      required: true,
      type: "text",
      unique: true,
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
      index: true, // NEW: speed up lookups
      unique: true, // NEW: enforce one-to-one mapping to Stripe
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

    // --- NEW: Stripe status snapshot (read-only in Admin) ---
    {
      name: "chargesEnabled",
      type: "checkbox",
      defaultValue: false,
      admin: { readOnly: true, description: "Stripe charges_enabled" },
    },
    {
      name: "payoutsEnabled",
      type: "checkbox",
      defaultValue: false,
      admin: { readOnly: true, description: "Stripe payouts_enabled" },
    },
    {
      name: "onboardingStatus",
      type: "select",
      options: [
        { label: "Not started", value: "not_started" },
        { label: "In progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Restricted", value: "restricted" },
      ],
      defaultValue: "not_started", // avoids undefined before first sync
      admin: { readOnly: true },
    },
    {
      name: "stripeRequirements",
      type: "json",
      admin: {
        readOnly: true,
        description: "Stripe requirements.currently_due snapshot",
      },
    },
    {
      name: "lastStripeSyncAt",
      type: "date",
      admin: { readOnly: true },
    },

    // Vendor profile fields

    {
      name: "bio",
      type: "textarea",
      label: "Bio",
      admin: {
        description: "Vendor's bio/description",
      },
    },
    {
      name: "services",
      type: "select",
      hasMany: true,
      options: [
        { label: "On-site", value: "on-site" },
        { label: "On-line", value: "on-line" },
      ],
      label: "Services",
      admin: {
        description: "Types of services offered",
      },
    },
    {
      name: "categories",
      type: "relationship",
      relationTo: "categories",
      hasMany: true,
      label: "Categories",
      admin: {
        description: "Service categories",
      },
    },
    {
      name: "subcategories",
      type: "relationship",
      relationTo: "categories",
      hasMany: true,
      label: "Subcategories",
      admin: {
        description: "Service subcategories",
      },
    },
    {
      name: "tags",
      type: "relationship",
      relationTo: "tags",
      hasMany: true,
    },
    {
      name: "website",
      type: "text",
      label: "Website",
      admin: {
        description: "Vendor's website URL",
      },
    },
    ...TelephoneField(
      {
        name: "phone",
        label: "Phone Number",
        required: false,
      },
      {
        defaultCountry: "DE",
        international: true,
      }
    ),
    {
      name: "hourlyRate",
      type: "number",
      label: "Hourly Rate (EUR)",
      admin: {
        description: "Vendor's hourly rate in EUR",
      },
    },

    // VAT + Country fields

    {
      name: "country",
      type: "text",
      required: true,
      label: "Country (ISO-2)",
      admin: { description: "Two-letter ISO country code (e.g., DE)" },
      validate: (val: unknown): true | string =>
        typeof val === "string" && val.length === 2
          ? true
          : "ISO-2 code required",
    },
    {
      type: "row",
      fields: [
        {
          name: "vatRegistered",
          type: "checkbox",
          label: "VAT registered",
          defaultValue: false,
          admin: { width: "33%" },
        },
        {
          name: "vatId",
          type: "text",
          label: "VAT number (USt-IdNr / EU VAT)",
          index: true,
          admin: {
            width: "67%",
            condition: (data) => Boolean(data?.vatRegistered),
            description: "Required if VAT-registered",
          },
        },
        {
          name: "vatIdValid",
          type: "checkbox",
          label: "VAT ID validated (VIES)",
          defaultValue: false,
          admin: {
            readOnly: true,
            description: "Set by server after VIES check",
            condition: (data) => Boolean(data?.vatRegistered),
          },
          access: {
            update: ({ req }) => isSuperAdmin(req.user),
          },
        },
      ],
    },

    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      label: "Associated User",
      admin: {
        description: "The user account associated with this tenant",
      },
    },
  ],
};
