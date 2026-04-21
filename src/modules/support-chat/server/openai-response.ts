import "server-only";

import { getOpenAIClient } from "@/lib/openai";
import {
  SUPPORT_CHAT_OPENAI_MAX_OUTPUT_TOKENS,
  SUPPORT_CHAT_OPENAI_MODEL,
  SUPPORT_CHAT_OPENAI_MODEL_VERSION,
} from "@/modules/support-chat/server/openai-config";

export type SupportChatModelRequest = {
  instructions: string;
  input: string;
  metadata?: Record<string, string>;
};

export type SupportChatModelResult =
  | {
      ok: true;
      text: string;
      model: string;
      modelVersion: string;
      requestId: string | null;
    }
  | {
      ok: false;
      reason: "openai_unavailable" | "empty_output";
      fallbackMessage: string;
      model: string;
      modelVersion: string;
      requestId: string | null;
    };

const SUPPORT_CHAT_OPENAI_FALLBACK_MESSAGE =
  "Support chat is temporarily unavailable. Please try again later or contact support.";

export async function createSupportChatModelResponse(
  request: SupportChatModelRequest
): Promise<SupportChatModelResult> {
  try {
    const response = await getOpenAIClient().responses.create({
      model: SUPPORT_CHAT_OPENAI_MODEL,
      instructions: request.instructions,
      input: request.input,
      max_output_tokens: SUPPORT_CHAT_OPENAI_MAX_OUTPUT_TOKENS,
      metadata: {
        feature: "support-chat",
        modelVersion: SUPPORT_CHAT_OPENAI_MODEL_VERSION,
        ...(request.metadata ?? {}),
      },
    });

    const requestId = response._request_id ?? null;
    const text = (response.output_text ?? "").trim();

    if (!text) {
      return {
        ok: false,
        reason: "empty_output",
        fallbackMessage: SUPPORT_CHAT_OPENAI_FALLBACK_MESSAGE,
        model: SUPPORT_CHAT_OPENAI_MODEL,
        modelVersion: SUPPORT_CHAT_OPENAI_MODEL_VERSION,
        requestId,
      };
    }

    return {
      ok: true,
      text,
      model: SUPPORT_CHAT_OPENAI_MODEL,
      modelVersion: SUPPORT_CHAT_OPENAI_MODEL_VERSION,
      requestId,
    };
  } catch (error) {
    console.warn("[support-chat] OpenAI request failed", error);

    return {
      ok: false,
      reason: "openai_unavailable",
      fallbackMessage: SUPPORT_CHAT_OPENAI_FALLBACK_MESSAGE,
      model: SUPPORT_CHAT_OPENAI_MODEL,
      modelVersion: SUPPORT_CHAT_OPENAI_MODEL_VERSION,
      requestId: null,
    };
  }
}
