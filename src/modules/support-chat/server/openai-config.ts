import "server-only";

const supportChatModel = process.env.OPENAI_SUPPORT_CHAT_MODEL;
const supportChatModelVersion = process.env.OPENAI_SUPPORT_CHAT_MODEL_VERSION;

if (!supportChatModel) {
  throw new Error("Missing OPENAI_SUPPORT_CHAT_MODEL.");
}

if (!supportChatModelVersion) {
  throw new Error("Missing OPENAI_SUPPORT_CHAT_MODEL_VERSION.");
}

export const SUPPORT_CHAT_OPENAI_MODEL = supportChatModel;

export const SUPPORT_CHAT_OPENAI_MODEL_VERSION = supportChatModelVersion;

export const SUPPORT_CHAT_OPENAI_MAX_OUTPUT_TOKENS = 700;
