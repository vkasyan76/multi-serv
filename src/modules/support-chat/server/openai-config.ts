import "server-only";

const supportChatModel = process.env.OPENAI_SUPPORT_CHAT_MODEL;

if (!supportChatModel) {
  throw new Error("Missing OPENAI_SUPPORT_CHAT_MODEL.");
}

export const SUPPORT_CHAT_OPENAI_MODEL = supportChatModel;

export const SUPPORT_CHAT_OPENAI_MODEL_VERSION =
  process.env.OPENAI_SUPPORT_CHAT_MODEL_VERSION ??
  "support-chat-model-unversioned";

export const SUPPORT_CHAT_OPENAI_MAX_OUTPUT_TOKENS = 700;
