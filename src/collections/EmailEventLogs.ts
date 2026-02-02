import type { CollectionConfig } from "payload";
import { isSuperAdmin } from "../lib/access.ts";

export const EmailEventLogs: CollectionConfig = {
  slug: "email_event_logs",
  access: {
    // Keep admin-only; server code uses overrideAccess for inserts.
    read: ({ req }) => isSuperAdmin(req.user),
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  admin: {
    useAsTitle: "dedupeKey",
    defaultColumns: [
      "eventType",
      "entityType",
      "entityId",
      "toEmail",
      "status",
      "provider",
      "providerMessageId",
      "createdAt",
    ],
  },
  fields: [
    {
      name: "eventType",
      type: "text",
      required: true,
      index: true,
      admin: { description: "Domain event key, e.g. invoice.issued.customer" },
    },
    {
      name: "entityType",
      type: "select",
      required: true,
      options: ["order", "booking", "invoice", "message"],
      index: true,
    },
    {
      name: "entityId",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "recipientUser",
      type: "relationship",
      relationTo: "users",
      required: false,
      admin: { description: "Optional: link to the Payload user recipient." },
    },
    {
      name: "toEmail",
      type: "email",
      required: true,
      index: true,
    },
    {
      name: "dedupeKey",
      type: "text",
      required: true,
      unique: true, // prevents duplicate sends on retries
      index: true,
    },
    {
      name: "provider",
      type: "select",
      required: true,
      defaultValue: "resend",
      options: ["resend"],
    },
    {
      name: "providerMessageId",
      type: "text",
      index: true,
      admin: { description: "Message id returned by the provider." },
    },
    {
      name: "status",
      type: "select",
      required: true,
      // pending = reserved by dedupe gate but not finalized yet.
      defaultValue: "pending",
      options: ["pending", "sent", "failed", "skipped"],
      index: true,
    },
    {
      name: "error",
      type: "textarea",
      admin: { description: "Optional error details for failed sends." },
    },
  ],
  timestamps: true,
};
