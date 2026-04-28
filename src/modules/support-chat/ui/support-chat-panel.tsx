"use client";

import Link from "next/link";
import { MessageCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { withLocalePrefix } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SupportChatComposer } from "@/modules/support-chat/ui/support-chat-composer";
import {
  type SupportChatSuggestion,
  SupportChatSuggestions,
} from "@/modules/support-chat/ui/support-chat-suggestions";
import { SupportChatThread } from "@/modules/support-chat/ui/support-chat-thread";
import { useSupportChat } from "@/modules/support-chat/ui/support-chat-provider";
import { type SupportChatMessage } from "@/modules/support-chat/ui/types";

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

  if (message.disposition === "escalate" || message.needsHumanSupport) {
    return labels.general;
  }

  return null;
}

export function SupportChatPanel({ className }: { className?: string }) {
  const t = useTranslations("supportChat");
  const {
    lang,
    open,
    closeChat,
    messages,
    input,
    setInput,
    isSending,
    error,
    sendMessage,
    sendAction,
  } = useSupportChat();

  const contactHref = withLocalePrefix("/contact", lang);
  const hasUserMessage = messages.some((message) => message.role === "user");
  const suggestions: SupportChatSuggestion[] = [
    {
      id: "booking",
      label: t("suggestions.booking"),
      prompt: t("suggestionPrompts.booking"),
    },
    {
      id: "payment",
      label: t("suggestions.payment"),
      prompt: t("suggestionPrompts.payment"),
    },
    {
      id: "cancel",
      label: t("suggestions.cancel"),
      prompt: t("suggestionPrompts.cancel"),
    },
    {
      id: "provider",
      label: t("suggestions.provider"),
      prompt: t("suggestionPrompts.provider"),
    },
  ];

  if (!open) return null;

  return (
    <aside
      aria-label={t("panelTitle")}
      className={cn(
        "fixed inset-x-3 bottom-3 z-50 flex h-[78vh] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl",
        "sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-20 sm:h-auto sm:w-[450px]",
        className
      )}
    >
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{t("panelTitle")}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {t("panelSubtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={closeChat}
          aria-label={t("close")}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 px-4 py-4">
          {!hasUserMessage ? (
            <div className="space-y-3 py-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">{t("emptyTitle")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("emptySubtitle")}
                </p>
              </div>
              <SupportChatSuggestions
                suggestions={suggestions}
                disabled={isSending}
                onSelect={(suggestion) => sendMessage(suggestion.prompt)}
              />
            </div>
          ) : null}

          <SupportChatThread
            messages={messages}
            isSending={isSending}
            sendingText={t("sending")}
            onActionSelect={sendAction}
            getHandoffText={(message) =>
              getHandoffText(message, {
                account: t("handoffAccount"),
                general: t("handoffGeneral"),
              })
            }
          />
        </div>
      </ScrollArea>

      <footer className="space-y-2.5 border-t bg-white px-4 py-3">
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        <SupportChatComposer
          value={input}
          onChange={setInput}
          onSubmit={() => sendMessage()}
          disabled={isSending}
          isSending={isSending}
          placeholder={t("composerPlaceholder")}
          sendLabel={t("send")}
        />

        <div className="flex flex-col gap-1 text-[11px] leading-4 text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-[280px]">{t("disclaimer")}</p>
          <Link
            href={contactHref}
            className="shrink-0 font-medium text-foreground underline underline-offset-4"
          >
            {t("contactSupport")}
          </Link>
        </div>
      </footer>
    </aside>
  );
}
