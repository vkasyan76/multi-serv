import type { CollectionConfig } from "payload";
import { isSuperAdmin } from "../lib/access.ts";
import { SUPPORTED_LANGUAGES } from "../lib/i18n/app-lang.ts";

const SUPPORT_CHAT_DISPOSITIONS = [
  "answered",
  "uncertain",
  "escalate",
  "unsupported_account_question",
] as const;

export const SupportChatThreads: CollectionConfig = {
  slug: "support_chat_threads",
  indexes: [
    { fields: ["user", "lastMessageAt"] },
    { fields: ["status", "lastMessageAt"] },
    { fields: ["retentionUntil"] },
  ],
  admin: {
    useAsTitle: "threadId",
    defaultColumns: [
      "threadId",
      "user",
      "locale",
      "status",
      "lastDisposition",
      "lastMessageAt",
    ],
  },
  access: {
    // Support-chat logs are admin-only; app writes use overrideAccess.
    read: ({ req }) => isSuperAdmin(req.user),
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  fields: [
    {
      name: "threadId",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          "Public support-chat continuity id; distinct from the Payload document id.",
      },
    },
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: false,
      index: true,
    },
    {
      name: "sessionKey",
      type: "text",
      required: false,
      index: true,
      admin: {
        description:
          "Reserved for future anonymous continuity; not wired by the chat flow yet.",
      },
    },
    {
      name: "locale",
      type: "select",
      required: true,
      options: SUPPORTED_LANGUAGES.map(({ code, label }) => ({
        label,
        value: code,
      })),
      index: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      options: [
        { label: "Open", value: "open" },
        { label: "Escalated", value: "escalated" },
        { label: "Closed", value: "closed" },
      ],
      index: true,
    },
    {
      name: "lastMessageAt",
      type: "date",
      index: true,
      admin: { position: "sidebar" },
    },
    {
      name: "lastDisposition",
      type: "select",
      required: false,
      options: SUPPORT_CHAT_DISPOSITIONS.map((value) => ({
        label: value,
        value,
      })),
      index: true,
      admin: { position: "sidebar" },
    },
    {
      name: "lastNeedsHumanSupport",
      type: "checkbox",
      defaultValue: false,
      admin: { position: "sidebar" },
    },
    {
      name: "messageCount",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description:
          "Total stored messages in this support thread. Each completed exchange adds two.",
        position: "sidebar",
      },
    },
    {
      name: "retentionUntil",
      type: "date",
      index: true,
      admin: { position: "sidebar" },
    },
  ],
  timestamps: true,
};
