import type { CollectionConfig } from "payload";
import { tenantsArrayField } from "@payloadcms/plugin-multi-tenant/fields";
import { isSuperAdmin } from "../lib/access.ts";

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
  ],
};
