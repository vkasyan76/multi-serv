import type { CollectionConfig } from "payload";
import { isSuperAdmin } from "../lib/access.ts";

function requireWhen<T>(
  condition: boolean,
  value: T | null | undefined,
  message: string,
) {
  if (!condition) return true;
  if (Array.isArray(value)) return value.length > 0 || message;
  if (typeof value === "string") return value.trim().length > 0 || message;
  return value != null || message;
}

function normalizeReferralCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // Canonical form avoids case/whitespace duplicates in referral campaigns.
  const normalized = value.trim().replace(/\s+/g, "-").toUpperCase();
  return normalized.length ? normalized : undefined;
}

export const Promotions: CollectionConfig = {
  slug: "promotions",
  access: {
    read: ({ req }) => isSuperAdmin(req.user),
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: [
      "name",
      "active",
      "type",
      "scope",
      "priority",
      "rateBps",
      "startsAt",
      "endsAt",
    ],
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data || typeof data !== "object") return data;
        const next = { ...(data as Record<string, unknown>) };
        if ("referralCode" in next) {
          // Normalize before write so DB uniqueness works predictably.
          next.referralCode = normalizeReferralCode(next.referralCode);
        }
        return next;
      },
    ],
  },
  fields: [
    { name: "name", type: "text", required: true, index: true },
    { name: "description", type: "textarea" },
    { name: "active", type: "checkbox", required: true, defaultValue: false, index: true },
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        { label: "First N", value: "first_n" },
        { label: "Time Window Rate", value: "time_window_rate" },
      ],
      index: true,
    },
    {
      name: "scope",
      type: "select",
      required: true,
      options: [
        { label: "Global", value: "global" },
        { label: "Tenants", value: "tenants" },
        { label: "Referral", value: "referral" },
      ],
      index: true,
    },
    { name: "priority", type: "number", required: true, defaultValue: 100, index: true },
    {
      name: "rateBps",
      type: "number",
      required: true,
      validate: (value: unknown) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return "Rate is required.";
        // Basis points are integer units; decimals introduce avoidable rounding ambiguity.
        if (!Number.isInteger(num))
          return "Rate must be an integer number of basis points.";
        if (num < 0 || num > 10000) return "Rate must be between 0 and 10000 bps.";
        return true;
      },
    },
    {
      name: "currency",
      type: "select",
      required: true,
      defaultValue: "eur",
      options: [{ label: "EUR", value: "eur" }],
      index: true,
    },
    { name: "startsAt", type: "date", index: true },
    {
      name: "endsAt",
      type: "date",
      index: true,
      validate: (value, { siblingData }) => {
        if (!value) return true;
        const endMs = Date.parse(String(value));
        if (!Number.isFinite(endMs)) return "Invalid endsAt date.";
        const startRaw = (siblingData as { startsAt?: unknown } | undefined)
          ?.startsAt;
        if (!startRaw) return true;
        const startMs = Date.parse(String(startRaw));
        if (!Number.isFinite(startMs)) return true;
        return endMs > startMs || "endsAt must be after startsAt.";
      },
    },
    {
      name: "tenantIds",
      type: "relationship",
      relationTo: "tenants",
      hasMany: true,
      admin: {
        condition: (data) =>
          (data as { scope?: string } | undefined)?.scope === "tenants",
      },
      validate: (
        value: unknown,
        { siblingData }: { siblingData?: Record<string, unknown> },
      ) =>
        requireWhen(
          siblingData?.scope === "tenants",
          value as string[] | null | undefined,
          "At least one tenant is required for tenant-scoped promotions.",
        ),
    },
    {
      name: "referralCode",
      type: "text",
      index: true,
      admin: {
        condition: (data) =>
          (data as { scope?: string } | undefined)?.scope === "referral",
      },
      validate: (
        value: unknown,
        { siblingData }: { siblingData?: Record<string, unknown> },
      ) =>
        requireWhen(
          siblingData?.scope === "referral",
          value as string | null | undefined,
          "Referral code is required for referral-scoped promotions.",
        ),
    },
    {
      name: "firstNLimit",
      type: "number",
      admin: {
        condition: (data) =>
          (data as { type?: string } | undefined)?.type === "first_n",
      },
      validate: (
        value: unknown,
        { siblingData }: { siblingData?: Record<string, unknown> },
      ) => {
        if (siblingData?.type !== "first_n") return true;
        const num = Number(value);
        if (!Number.isFinite(num)) return "firstNLimit is required for first_n promotions.";
        if (num < 1) return "firstNLimit must be at least 1.";
        return true;
      },
    },
    {
      name: "firstNScope",
      type: "select",
      options: [
        { label: "Global", value: "global" },
        { label: "Per Tenant", value: "per_tenant" },
      ],
      admin: {
        condition: (data) =>
          (data as { type?: string } | undefined)?.type === "first_n",
      },
      validate: (
        value: unknown,
        { siblingData }: { siblingData?: Record<string, unknown> },
      ) =>
        requireWhen(
          siblingData?.type === "first_n",
          value as string | null | undefined,
          "firstNScope is required for first_n promotions.",
        ),
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
    },
  ],
  indexes: [
    { fields: ["active", "priority", "startsAt", "endsAt", "type", "scope"] },
    { fields: ["scope", "referralCode"] },
  ],
  timestamps: true,
};
