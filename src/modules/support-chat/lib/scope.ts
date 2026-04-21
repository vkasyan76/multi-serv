export const SUPPORT_CHAT_ALLOWED_TOPICS = [
  "terms_policy",
  "registration_onboarding",
  "booking_policy",
  "payment_policy",
  "cancellation_policy",
  "dispute_policy",
  "general_failure_guidance",
  "marketplace_usage",
] as const;

export const SUPPORT_CHAT_FORBIDDEN_TOPICS = [
  "live_order_lookup",
  "live_payment_lookup",
  "specific_order_cancellation_decision",
  "vendor_admin_action",
  "broad_database_read",
  "direct_backend_system_access",
  "professional_advice_beyond_platform_rules",
] as const;

export const SUPPORT_CHAT_SCOPE_RULES = {
  allowPlainLanguagePolicyExplanation: true,
  requireConservativeParaphrase: true,
  forbidProfessionalAdviceBeyondPlatformRules: true,
  forbidLiveAccountDataClaims: true,
  requireBoundaryResponseForInvalidInput: true,
  allowSupportHandoff: true,
} as const;

// Public-facing capability summary. Keep this smaller than the internal scope
// taxonomy so client code does not couple itself to prompt/test policy details.
export const SUPPORT_CHAT_CAPABILITIES = {
  generalSupport: true,
  accountSpecificSupport: false,
  humanSupportHandoff: true,
} as const;

export type SupportChatAllowedTopic =
  (typeof SUPPORT_CHAT_ALLOWED_TOPICS)[number];

export type SupportChatForbiddenTopic =
  (typeof SUPPORT_CHAT_FORBIDDEN_TOPICS)[number];

export type SupportChatScopeRule = keyof typeof SUPPORT_CHAT_SCOPE_RULES;
