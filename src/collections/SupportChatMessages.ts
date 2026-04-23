import type { CollectionConfig } from "payload";
import { isSuperAdmin } from "../lib/access.ts";
import { SUPPORTED_LANGUAGES } from "../lib/i18n/app-lang.ts";

const SUPPORT_CHAT_DISPOSITIONS = [
  "answered",
  "uncertain",
  "escalate",
  "unsupported_account_question",
] as const;

const SUPPORT_KNOWLEDGE_SOURCE_TYPES = [
  "operational-guidance",
  "policy-summary",
  "terms-reference",
  "fallback-guidance",
] as const;

const SUPPORT_CHAT_RESPONSE_ORIGINS = ["server", "model"] as const;

export const SupportChatMessages: CollectionConfig = {
  slug: "support_chat_messages",
  indexes: [
    { fields: ["thread", "createdAt"] },
    { fields: ["role", "createdAt"] },
    { fields: ["disposition", "createdAt"] },
  ],
  admin: {
    useAsTitle: "redactedText",
    defaultColumns: [
      "thread",
      "role",
      "locale",
      "responseOrigin",
      "disposition",
      "needsHumanSupport",
      "createdAt",
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
      name: "thread",
      type: "relationship",
      relationTo: "support_chat_threads",
      required: true,
      index: true,
    },
    {
      name: "role",
      type: "select",
      required: true,
      options: [
        { label: "User", value: "user" },
        { label: "Assistant", value: "assistant" },
      ],
      index: true,
    },
    {
      name: "text",
      type: "textarea",
      required: true,
    },
    {
      name: "redactedText",
      type: "textarea",
      required: false,
    },
    {
      name: "redactionApplied",
      type: "checkbox",
      defaultValue: false,
      index: true,
    },
    {
      name: "redactionTypes",
      type: "array",
      fields: [{ name: "type", type: "text", required: true }],
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
      name: "responseOrigin",
      type: "select",
      required: true,
      defaultValue: "server",
      options: SUPPORT_CHAT_RESPONSE_ORIGINS.map((value) => ({
        label: value,
        value,
      })),
      index: true,
    },
    {
      name: "disposition",
      type: "select",
      required: false,
      options: SUPPORT_CHAT_DISPOSITIONS.map((value) => ({
        label: value,
        value,
      })),
      index: true,
    },
    {
      name: "needsHumanSupport",
      type: "checkbox",
      defaultValue: false,
      index: true,
    },
    { name: "model", type: "text" },
    { name: "modelVersion", type: "text" },
    { name: "promptVersion", type: "text" },
    { name: "guardrailVersion", type: "text" },
    { name: "retrievalVersion", type: "text" },
    { name: "knowledgePackVersion", type: "text" },
    { name: "openAIRequestId", type: "text" },
    {
      name: "sources",
      type: "array",
      fields: [
        { name: "documentId", type: "text", required: true },
        { name: "documentVersion", type: "text", required: true },
        { name: "chunkId", type: "text", required: true },
        { name: "sectionId", type: "text", required: true },
        { name: "sectionTitle", type: "text" },
        {
          name: "sourceType",
          type: "select",
          required: true,
          options: SUPPORT_KNOWLEDGE_SOURCE_TYPES.map((value) => ({
            label: value,
            value,
          })),
        },
        {
          name: "sourceLocale",
          type: "select",
          required: true,
          options: SUPPORTED_LANGUAGES.map(({ code, label }) => ({
            label,
            value: code,
          })),
        },
        { name: "score", type: "number", required: true },
        {
          name: "matchedTerms",
          type: "array",
          fields: [{ name: "term", type: "text", required: true }],
        },
      ],
    },
  ],
  timestamps: true,
};
