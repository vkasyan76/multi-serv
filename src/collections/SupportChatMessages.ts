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

const SUPPORT_ACCOUNT_ANSWER_MODES = [
  "server_deterministic",
  "model_rewritten",
  "model_rewrite_rejected",
  "model_rewrite_disabled",
] as const;

const SUPPORT_ACCOUNT_REWRITE_REJECTED_REASONS = [
  "feature_disabled",
  "model_error",
  "empty_output",
  "wrong_locale",
  "unsafe_system_claim",
  "unsupported_fact",
  "contradicts_fallback",
  "mutation_claim",
  "missing_required_limitation",
] as const;

const SUPPORT_TRIAGE_INTENTS = [
  "general_support",
  "account_candidate_lookup",
  "selected_order_follow_up",
  "unsafe_mutation",
  "unsupported_account_scope",
  "clarify",
  "none",
  "not_applicable",
] as const;

const SUPPORT_TRIAGE_TOPICS = [
  "booking",
  "payment",
  "cancellation",
  "provider_onboarding",
] as const;

const SUPPORT_TRIAGE_STATUS_FILTERS = [
  "requested",
  "scheduled",
  "canceled",
  "paid",
  "payment_pending",
  "payment_not_due",
] as const;

const SUPPORT_TRIAGE_CONFIDENCES = ["low", "medium", "high"] as const;

const SUPPORT_GROUNDING_KINDS = [
  "knowledge",
  "account_safe_dto",
  "none",
] as const;

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
    {
      name: "accountAnswerMode",
      type: "select",
      options: SUPPORT_ACCOUNT_ANSWER_MODES.map((value) => ({
        label: value,
        value,
      })),
      index: true,
    },
    { name: "accountRewriteModel", type: "text" },
    { name: "accountRewriteModelVersion", type: "text" },
    {
      name: "accountRewriteRejectedReason",
      type: "select",
      options: SUPPORT_ACCOUNT_REWRITE_REJECTED_REASONS.map((value) => ({
        label: value,
        value,
      })),
      index: true,
    },
    {
      name: "accountRewriteFallbackUsed",
      type: "checkbox",
      defaultValue: false,
      index: true,
    },
    {
      name: "accountContextSnapshots",
      type: "array",
      fields: [
        {
          name: "kind",
          type: "select",
          required: true,
          options: [
            { label: "Candidate selection", value: "candidate_selection" },
            { label: "Selected order", value: "selected_order" },
            { label: "Helper result", value: "helper_result" },
            { label: "Payment overview", value: "payment_overview" },
          ],
        },
        { name: "helper", type: "text" },
        { name: "resultCategory", type: "text" },
        { name: "statusFilter", type: "text" },
        {
          name: "orders",
          type: "array",
          fields: [
            { name: "orderId", type: "text" },
            { name: "referenceType", type: "text" },
            { name: "referenceId", type: "text" },
            { name: "displayReference", type: "text" },
            { name: "label", type: "text" },
            { name: "description", type: "text" },
            { name: "providerDisplayName", type: "text" },
            {
              name: "serviceNames",
              type: "array",
              fields: [{ name: "name", type: "text", required: true }],
            },
            { name: "firstSlotStart", type: "date" },
            { name: "createdAt", type: "date" },
            { name: "serviceStatusCategory", type: "text" },
            { name: "paymentStatusCategory", type: "text" },
            { name: "invoiceStatusCategory", type: "text" },
            { name: "nextStepKey", type: "text" },
          ],
        },
      ],
      admin: {
        description:
          "Support-safe account/order context shown or used by account-aware support. Do not store raw records or Stripe payloads.",
      },
    },
    {
      name: "triageIntent",
      type: "select",
      options: SUPPORT_TRIAGE_INTENTS.map((value) => ({
        label: value,
        value,
      })),
      index: true,
    },
    {
      name: "triageTopic",
      type: "select",
      options: SUPPORT_TRIAGE_TOPICS.map((value) => ({
        label: value,
        value,
      })),
      index: true,
    },
    {
      name: "triageStatusFilter",
      type: "select",
      options: SUPPORT_TRIAGE_STATUS_FILTERS.map((value) => ({
        label: value,
        value,
      })),
      index: true,
    },
    {
      name: "triageConfidence",
      type: "select",
      options: SUPPORT_TRIAGE_CONFIDENCES.map((value) => ({
        label: value,
        value,
      })),
      index: true,
    },
    { name: "triageReason", type: "textarea" },
    {
      name: "groundingKind",
      type: "select",
      required: true,
      defaultValue: "none",
      options: SUPPORT_GROUNDING_KINDS.map((value) => ({
        label: value,
        value,
      })),
      index: true,
    },
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
