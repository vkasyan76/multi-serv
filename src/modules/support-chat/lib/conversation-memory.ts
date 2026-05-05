export type SupportConversationMemoryTopic =
  | "booking"
  | "payment"
  | "cancellation"
  | "provider_onboarding";

export type SupportConversationMemory = {
  previousUserMessage?: string;
  previousAssistantMessage?: string;
  activeTopic?: SupportConversationMemoryTopic;
  hasSelectedOrderContext: boolean;
  lastAssistantAskedForSelection: boolean;
};

const MAX_PREVIOUS_USER_MESSAGE_CHARS = 500;
const MAX_PREVIOUS_ASSISTANT_MESSAGE_CHARS = 1000;

function cleanMemoryText(value: string | undefined, maxLength: number) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

export function sanitizeSupportConversationMemory(
  memory: SupportConversationMemory | undefined,
): SupportConversationMemory | undefined {
  if (!memory) return undefined;

  const sanitized: SupportConversationMemory = {
    previousUserMessage: cleanMemoryText(
      memory.previousUserMessage,
      MAX_PREVIOUS_USER_MESSAGE_CHARS,
    ),
    previousAssistantMessage: cleanMemoryText(
      memory.previousAssistantMessage,
      MAX_PREVIOUS_ASSISTANT_MESSAGE_CHARS,
    ),
    activeTopic: memory.activeTopic,
    hasSelectedOrderContext: Boolean(memory.hasSelectedOrderContext),
    lastAssistantAskedForSelection: Boolean(
      memory.lastAssistantAskedForSelection,
    ),
  };

  if (
    !sanitized.previousUserMessage &&
    !sanitized.previousAssistantMessage &&
    !sanitized.activeTopic &&
    !sanitized.hasSelectedOrderContext &&
    !sanitized.lastAssistantAskedForSelection
  ) {
    return undefined;
  }

  return sanitized;
}
