import "server-only";

import { getOpenAIClient } from "@/lib/openai";
import { type AppLang } from "@/lib/i18n/app-lang";
import {
  SUPPORT_CHAT_OPENAI_MAX_OUTPUT_TOKENS,
  SUPPORT_CHAT_OPENAI_MODEL,
  SUPPORT_CHAT_OPENAI_MODEL_VERSION,
} from "@/modules/support-chat/server/openai-config";
import { getSupportChatCopy } from "@/modules/support-chat/server/support-chat-copy";

export type SupportChatModelRequest = {
  instructions: string;
  input: string;
  locale: AppLang;
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

export async function createSupportChatModelResponse(
  request: SupportChatModelRequest
): Promise<SupportChatModelResult> {
  const fallbackMessage =
    getSupportChatCopy(request.locale).serverMessages.outage;

  try {
    const response = await getOpenAIClient().responses.create({
      model: SUPPORT_CHAT_OPENAI_MODEL,
      instructions: request.instructions,
      input: request.input,
      max_output_tokens: SUPPORT_CHAT_OPENAI_MAX_OUTPUT_TOKENS,
      metadata: {
        ...(request.metadata ?? {}),
        feature: "support-chat",
        modelVersion: SUPPORT_CHAT_OPENAI_MODEL_VERSION,
      },
    });

    const requestId = response._request_id ?? null;
    const text = (response.output_text ?? "").trim();

    if (!text) {
      return {
        ok: false,
        reason: "empty_output",
        fallbackMessage,
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
      fallbackMessage,
      model: SUPPORT_CHAT_OPENAI_MODEL,
      modelVersion: SUPPORT_CHAT_OPENAI_MODEL_VERSION,
      requestId: null,
    };
  }
}
