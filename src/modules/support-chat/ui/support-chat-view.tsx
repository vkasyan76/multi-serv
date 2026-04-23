"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { withLocalePrefix } from "@/i18n/routing";
import { type AppLang } from "@/lib/i18n/app-lang";
import { useTRPC } from "@/trpc/client";
import { SUPPORT_CHAT_PHASE } from "@/modules/support-chat/lib/boundaries";
import { SupportChatInput } from "@/modules/support-chat/ui/support-chat-input";
import {
  SupportChatThread,
  type SupportChatMessage,
} from "@/modules/support-chat/ui/support-chat-thread";

function createMessageId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function getHandoffText(
  message: SupportChatMessage,
  labels: {
    account: string;
    general: string;
  }
) {
  if (message.disposition === "unsupported_account_question") {
    return labels.account;
  }

  if (message.needsHumanSupport) {
    return labels.general;
  }

  return null;
}

export function SupportChatView({ lang }: { lang: AppLang }) {
  const t = useTranslations("supportChat");
  const trpc = useTRPC();
  const sendMessage = useMutation(
    trpc.supportChat.sendMessage.mutationOptions()
  );

  const [threadId, setThreadId] = useState<string | undefined>();
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contactHref = withLocalePrefix("/contact", lang);
  const trimmedInput = input.trim();

  const handleSubmit = async () => {
    const draft = input;
    const message = draft.trim();

    if (!message || isSending) return;

    const userMessage: SupportChatMessage = {
      id: createMessageId(),
      role: "user",
      content: message,
    };

    setError(null);
    setIsSending(true);
    setMessages((current) => [...current, userMessage]);
    setInput("");

    try {
      const response = await sendMessage.mutateAsync({
        message,
        threadId,
        locale: lang,
      });

      setThreadId(response.threadId);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: response.assistantMessage,
          disposition: response.disposition,
          needsHumanSupport: response.needsHumanSupport,
          sources: response.sources,
        },
      ]);
    } catch (sendError) {
      setMessages((current) =>
        current.filter((item) => item.id !== userMessage.id)
      );
      setInput(draft);
      setError(
        sendError instanceof Error && sendError.message
          ? sendError.message
          : t("error")
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-10" lang={lang}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-neutral-700">{t("lead")}</p>
          <p className="text-sm text-neutral-700">
            {t("phaseCopy", { phase: SUPPORT_CHAT_PHASE })}
          </p>
        </header>

        <section
          aria-label={t("threadLabel")}
          className="rounded-md border border-neutral-200 bg-white"
        >
          <SupportChatThread
            messages={messages}
            isSending={isSending}
            emptyText={t("emptyThread")}
            sendingText={t("sending")}
            getHandoffText={(message) =>
              getHandoffText(message, {
                account: t("handoffAccount"),
                general: t("handoffGeneral"),
              })
            }
          />
        </section>

        <div className="space-y-3">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <SupportChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            disabled={isSending}
            isSending={isSending}
            canSubmit={trimmedInput.length > 0}
            placeholder={t("inputPlaceholder")}
            sendLabel={t("send")}
            sendingLabel={t("sendingButton")}
          />

          <div className="flex flex-col gap-2 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
            <p>{t("disclaimer")}</p>
            <Link
              href={contactHref}
              className="font-medium text-neutral-900 underline underline-offset-4"
            >
              {t("contactSupport")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
