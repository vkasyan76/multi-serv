"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SupportChatAiIcon } from "@/modules/support-chat/ui/support-chat-ai-icon";
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
  const { isSignedIn, user } = useUser();
  const {
    open,
    closeChat,
    mode,
    openEmailMode,
    backToChat,
    messages,
    input,
    setInput,
    isSending,
    error,
    isSendingEmail,
    emailError,
    emailSent,
    sendMessage,
    sendAction,
    sendSupportEmail,
    resetEmailState,
    clearChat,
  } = useSupportChat();
  const [emailDraft, setEmailDraft] = useState("");

  const accountEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress;
  const handleClearChat = () => {
    setEmailDraft("");
    clearChat();
  };
  const handleOpenEmailMode = () => {
    if (!isSignedIn) {
      toast.error(t("emailMode.loginRequired"));
      return;
    }

    openEmailMode();
  };
  const handleEmailDraftChange = (value: string) => {
    setEmailDraft(value);
    if (emailError || emailSent) {
      resetEmailState();
    }
  };
  const handleSendSupportEmail = async () => {
    const sent = await sendSupportEmail(emailDraft);
    if (sent) {
      setEmailDraft("");
    }
  };
  const canSendEmail = emailDraft.trim().length >= 10 && !isSendingEmail;
  const hasUserMessage = messages.some((message) => message.role === "user");
  const hasMessages = messages.length > 0;
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
        "fixed inset-x-4 bottom-3 top-20 z-50 flex flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl",
        "sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-20 sm:h-auto sm:w-[450px]",
        className
      )}
    >
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <SupportChatAiIcon
          className="h-9 w-9"
          iconClassName="h-5 w-5"
          sparkleClassName="right-1 top-1 h-3.5 w-3.5"
          variant="solid"
        />
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
          {mode === "chat" ? (
            <>
              {!hasUserMessage ? (
                <div className="space-y-3 py-4 text-center">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">
                      {t("emptyTitle")}
                    </h3>
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
            </>
          ) : (
            <div className="space-y-3 py-3">
              <div className="space-y-1.5">
                <h3 className="text-lg font-semibold">
                  {t("emailMode.title")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("emailMode.description")}
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  {t("emailMode.accountEmailLabel")}
                </div>
                {accountEmail ? (
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    {accountEmail}
                  </div>
                ) : (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    {t("emailMode.accountEmailFallback")}
                  </p>
                )}
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("emailMode.messageLabel")}
                </span>
                <textarea
                  value={emailDraft}
                  onChange={(event) =>
                    handleEmailDraftChange(event.target.value)
                  }
                  placeholder={t("emailMode.messagePlaceholder")}
                  className="min-h-[clamp(9rem,24dvh,14rem)] w-full resize-none rounded-xl border bg-white px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 sm:min-h-48"
                />
              </label>

              {emailSent ? (
                <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                  {t("emailMode.sendSuccess")}
                </p>
              ) : null}
              {emailError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {emailError}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </ScrollArea>

      <footer className="space-y-2.5 border-t bg-white px-4 py-3">
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        {mode === "chat" ? (
          <>
            <SupportChatComposer
              value={input}
              onChange={setInput}
              onSubmit={() => sendMessage()}
              disabled={isSending}
              isSending={isSending}
              placeholder={t("composerPlaceholder")}
              sendLabel={t("send")}
            />

            <div className="flex items-center justify-between gap-2">
              {hasMessages ? (
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  onClick={handleClearChat}
                  disabled={isSending}
                >
                  {t("clearChat")}
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
              <button
                type="button"
                className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                onClick={handleOpenEmailMode}
                disabled={isSending}
              >
                {t("writeEmail")}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={backToChat}
              >
                {t("emailMode.backToChat")}
              </button>
              <Button
                type="button"
                size="sm"
                disabled={!canSendEmail}
                onClick={handleSendSupportEmail}
              >
                {isSendingEmail
                  ? t("emailMode.sendingMessage")
                  : t("emailMode.sendMessage")}
              </Button>
            </div>
            {emailDraft.trim().length > 0 && emailDraft.trim().length < 10 ? (
              <p className="px-2 text-xs text-muted-foreground">
                {t("emailMode.messageTooShort")}
              </p>
            ) : null}
          </div>
        )}

        {mode === "chat" ? (
          <div className="text-[11px] leading-4 text-muted-foreground">
            <p>{t("disclaimer")}</p>
          </div>
        ) : null}
      </footer>
    </aside>
  );
}
