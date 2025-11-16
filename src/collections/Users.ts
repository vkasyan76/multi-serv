import type { CollectionConfig } from "payload";
import { tenantsArrayField } from "@payloadcms/plugin-multi-tenant/fields";
import { isSuperAdmin } from "../lib/access.ts";
// import { ClerkAuthStrategy } from "@/lib/auth/clerk-strategy.ts";
import { ClerkAuthStrategy } from "../lib/auth/clerk-strategy.ts";

const defaultTenantArrayField = tenantsArrayField({
  tenantsArrayFieldName: "tenants",
  tenantsCollectionSlug: "tenants",
  tenantsArrayTenantFieldName: "tenant",
  arrayFieldAccess: {
    read: () => true,
    create: ({ req }) => isSuperAdmin(req.user), // only super-admin can create
    update: ({ req }) => isSuperAdmin(req.user),
  },
  tenantFieldAccess: {
    read: () => true,
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
  },
});

export const Users: CollectionConfig = {
  slug: "users",
  access: {
    read: () => true, // all users can read
    create: ({ req }) => isSuperAdmin(req.user), // only super-admin can create users
    delete: ({ req }) => isSuperAdmin(req.user), // only super-admin can delete users
    update: ({ req, id }) => {
      if (isSuperAdmin(req.user)) {
        return true; // super-admin can update any user
      }
      return req.user?.id === id; // regular users can only update their own profile
    },
  },
  admin: {
    useAsTitle: "email",
    hidden: ({ user }) => !isSuperAdmin(user), // hide from admin panel if not super-admin
  },
  // auth: true,
  // In production, the custom auth.cookies config ensures that authentication cookies work correctly across subdomains, allowing loging out.
  auth: {
    disableLocalStrategy: true, // Crucial for Clerk-only authentication
    strategies: [ClerkAuthStrategy], // Use your custom Clerk strategy
    cookies: {
      ...(process.env.NODE_ENV !== "development" && {
        sameSite: "None",
        domain: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
        secure: true,
      }),
    },
  },
  fields: [
    // Email added by default
    // Add more fields as needed
    {
      name: "username",
      required: true,
      unique: true,
      type: "text",
      admin: { description: "App username (set once on create)." },
    },
    {
      name: "clerkUsername",
      type: "text",
      required: false,
      unique: false,
      admin: { description: "Raw username from Clerk (for reference only)." },
    },
    {
      name: "usernameSource",
      type: "select",
      required: false,
      defaultValue: "app",
      options: [
        { label: "App", value: "app" },
        { label: "Clerk", value: "clerk" },
      ],
      admin: { position: "sidebar" },
    },
    {
      name: "usernameSyncedAt",
      type: "date",
      required: false,
      admin: { position: "sidebar", description: "When username was set." },
    },
    // Email field is required for Clerk integration
    {
      name: "email",
      type: "email",
      required: false,
      unique: true, // initially optional to avoid breaking existing records
    },
    // added clerk userId field
    {
      name: "clerkUserId",
      type: "text",
      unique: true,
      required: false, // initially optional to avoid breaking existing records
    },
    {
      admin: { position: "sidebar" },
      name: "roles",
      type: "select",
      defaultValue: ["user"],
      hasMany: true,
      options: ["super-admin", "user"],
      access: {
        update: ({ req }) => isSuperAdmin(req.user), // only super-admin can change roles
      },
    },
    {
      ...defaultTenantArrayField,
      // to display the tenants in the sidebar: || {} part is important: if defaultTenantArrayField.admin is undefined, this ensures you don't get an error when spreading.
      admin: {
        ...(defaultTenantArrayField.admin || {}),
        position: "sidebar",
      },
    },
    // General profile fields
    {
      name: "location",
      type: "text",
      label: "Location",
      admin: {
        description: "User's location/address",
      },
    },
    {
      name: "country",
      type: "text",
      label: "Country",
      admin: {
        description: "User's country",
      },
    },
    {
      name: "language",
      type: "select",
      options: [
        { label: "English", value: "en" },
        { label: "Spanish", value: "es" },
        { label: "French", value: "fr" },
        { label: "German", value: "de" },
        { label: "Italian", value: "it" },
        { label: "Portuguese", value: "pt" },
      ],
      label: "Language",
      admin: {
        description: "User's preferred language",
      },
    },
    {
      name: "coordinates",
      type: "group",
      fields: [
        {
          name: "lat",
          type: "number",
          label: "Latitude",
          admin: {
            description: "Location latitude",
          },
        },
        {
          name: "lng",
          type: "number",
          label: "Longitude",
          admin: {
            description: "Location longitude",
          },
        },
        {
          name: "city",
          type: "text",
          label: "City",
          admin: {
            description: "City name from IP geolocation",
          },
        },
        {
          name: "countryISO",
          type: "text",
          label: "Country ISO Code",
          admin: {
            description: "Country ISO code (e.g., DE, US)",
          },
        },
        {
          name: "countryName",
          type: "text",
          label: "Country Name",
          admin: {
            description: "Full country name (e.g., Germany, United States)",
          },
        },
        {
          name: "region",
          type: "text",
          label: "Region",
          admin: {
            description: "Region/state name from IP geolocation",
          },
        },
        {
          name: "postalCode",
          type: "text",
          label: "Postal Code",
          admin: {
            description: "Postal/ZIP code",
          },
        },
        {
          name: "street",
          type: "text",
          label: "Street Address",
          admin: {
            description: "Street address",
          },
        },
        {
          name: "ipDetected",
          type: "checkbox",
          label: "IP Detected",
          defaultValue: false,
          admin: {
            description: "Whether coordinates were detected from IP",
          },
        },
        {
          name: "manuallySet",
          type: "checkbox",
          label: "Manually Set",
          defaultValue: false,
          admin: {
            description: "Whether coordinates were manually set by user",
          },
        },
      ],
      label: "Coordinates",
      admin: {
        description: "Location coordinates with metadata",
      },
    },
    {
      name: "onboardingCompleted",
      type: "checkbox",
      defaultValue: false,
      label: "Onboarding Completed",
      admin: {
        description: "Whether the user has completed onboarding",
      },
    },
    {
      name: "geoUpdatedAt",
      type: "date",
      label: "Geolocation Updated At",
      admin: {
        description: "When the user's geolocation was last updated",
        position: "sidebar",
      },
    },
  ],
};
