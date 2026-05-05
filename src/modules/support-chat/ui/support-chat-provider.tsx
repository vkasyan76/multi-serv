"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { type AppLang } from "@/lib/i18n/app-lang";
import { useTRPC } from "@/trpc/client";
import { sanitizeSupportConversationMemory } from "@/modules/support-chat/lib/conversation-memory";
import {
  type SupportChatAction,
  type SupportConversationMemory,
  type SupportChatMessage,
  type SupportSelectedOrderContext,
  type SupportTopicContext,
} from "@/modules/support-chat/ui/types";

type SupportChatContextValue = {
  lang: AppLang;
  open: boolean;
  setOpen: (open: boolean) => void;
  openChat: () => void;
  closeChat: () => void;
  mode: "chat" | "email";
  openEmailMode: () => void;
  backToChat: () => void;
  messages: SupportChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isSending: boolean;
  error: string | null;
  isSendingEmail: boolean;
  emailError: string | null;
  emailSent: boolean;
  sendMessage: (message?: string) => Promise<void>;
  sendAction: (action: SupportChatAction) => Promise<void>;
  sendSupportEmail: (message: string) => Promise<boolean>;
  resetEmailState: () => void;
  clearChat: () => void;
};

const SupportChatContext = createContext<SupportChatContextValue | null>(null);

function createMessageId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function isTopicContextFresh(context: SupportTopicContext | null) {
  if (!context?.expiresAt) return false;
  return new Date(context.expiresAt).getTime() > Date.now();
}

function latestMessageByRole(
  messages: SupportChatMessage[],
  role: SupportChatMessage["role"],
) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === role) return message;
  }
  return undefined;
}

function messageAskedForCandidateSelection(message: SupportChatMessage | undefined) {
  return Boolean(
    message?.actions?.some((action) => action.type === "account_candidate_select"),
  );
}

function buildConversationMemory(input: {
  messages: SupportChatMessage[];
  supportTopicContext: SupportTopicContext | null;
  selectedOrderContext: SupportSelectedOrderContext | null;
}): SupportConversationMemory | undefined {
  const latestAssistant = latestMessageByRole(input.messages, "assistant");
  const latestUser = latestMessageByRole(input.messages, "user");
  const freshTopicContext = isTopicContextFresh(input.supportTopicContext)
    ? input.supportTopicContext
    : null;

  return sanitizeSupportConversationMemory({
    previousUserMessage: latestUser?.content,
    previousAssistantMessage: latestAssistant?.content,
    activeTopic: freshTopicContext?.topic,
    hasSelectedOrderContext: Boolean(input.selectedOrderContext),
    lastAssistantAskedForSelection:
      messageAskedForCandidateSelection(latestAssistant),
  });
}

export function SupportChatProvider({
  lang,
  initialOpen = false,
  children,
}: {
  lang: AppLang;
  initialOpen?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("supportChat");
  const trpc = useTRPC();
  const sendSupportMessage = useMutation(
    trpc.supportChat.sendMessage.mutationOptions()
  );
  const sendSupportEmailMutation = useMutation(
    trpc.supportChat.sendSupportEmail.mutationOptions()
  );

  const [open, setOpen] = useState(initialOpen);
  const [mode, setMode] = useState<"chat" | "email">("chat");
  const [threadId, setThreadId] = useState<string | undefined>();
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [selectedOrderContext, setSelectedOrderContext] =
    useState<SupportSelectedOrderContext | null>(null);
  const [supportTopicContext, setSupportTopicContext] =
    useState<SupportTopicContext | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const pendingSendRef = useRef(false);

  const openChat = useCallback(() => setOpen(true), []);
  const closeChat = useCallback(() => setOpen(false), []);
  const openEmailMode = useCallback(() => setMode("email"), []);
  const backToChat = useCallback(() => setMode("chat"), []);
  const resetEmailState = useCallback(() => {
    setEmailError(null);
    setEmailSent(false);
  }, []);
  const clearChat = useCallback(() => {
    setThreadId(undefined);
    setMessages([]);
    setSelectedOrderContext(null);
    setSupportTopicContext(null);
    setInput("");
    setError(null);
    setEmailError(null);
    setEmailSent(false);
    setMode("chat");
  }, []);

  const sendMessage = useCallback(
    async (messageOverride?: string) => {
      const draft = messageOverride ?? input;
      const message = draft.trim();

      // React state is async; keep a ref guard so same-tick submits cannot fork
      // duplicate requests before isSending flips on the next render.
      if (!message || pendingSendRef.current) return;
      pendingSendRef.current = true;

      const userMessage: SupportChatMessage = {
        id: createMessageId(),
        role: "user",
        content: message,
      };

      setError(null);
      setIsSending(true);
      setMessages((current) => [...current, userMessage]);
      if (messageOverride == null) {
        setInput("");
      }

      try {
        const freshTopicContext =
          supportTopicContext && isTopicContextFresh(supportTopicContext)
            ? supportTopicContext
            : undefined;
        const conversationMemory = buildConversationMemory({
          messages,
          supportTopicContext: freshTopicContext ?? null,
          selectedOrderContext,
        });
        const response = await sendSupportMessage.mutateAsync({
          message,
          threadId,
          locale: lang,
          conversationMemory,
          selectedOrderContext: selectedOrderContext ?? undefined,
          supportTopicContext: freshTopicContext
            ? { type: freshTopicContext.type, token: freshTopicContext.token }
            : undefined,
        });

        setThreadId(response.threadId);
        if (response.selectedOrderContext) {
          setSelectedOrderContext(response.selectedOrderContext);
        }
        setSupportTopicContext(response.supportTopicContext ?? null);
        setMessages((current) => [
          ...current,
          {
            id: createMessageId(),
            role: "assistant",
            content: response.assistantMessage,
            disposition: response.disposition,
            needsHumanSupport: response.needsHumanSupport,
            sources: response.sources,
            actions: response.actions,
          },
        ]);
      } catch {
        setMessages((current) =>
          current.filter((item) => item.id !== userMessage.id)
        );
        if (messageOverride == null) {
          setInput(draft);
        }
        setError(t("error"));
      } finally {
        pendingSendRef.current = false;
        setIsSending(false);
      }
    },
    [
      input,
      lang,
      messages,
      selectedOrderContext,
      sendSupportMessage,
      supportTopicContext,
      t,
      threadId,
    ]
  );

  const sendAction = useCallback(
    async (action: SupportChatAction) => {
      if (pendingSendRef.current) return;
      pendingSendRef.current = true;

      // The visible selection label is user-facing only; the server trusts the
      // signed action token, not this localized text.
      const message = `${t("selectedCandidate")}: ${action.label}`;
      const userMessage: SupportChatMessage = {
        id: createMessageId(),
        role: "user",
        content: action.description
          ? `${message}\n${action.description}`
          : message,
      };

      setError(null);
      setIsSending(true);
      setMessages((current) => [...current, userMessage]);

      try {
        const response = await sendSupportMessage.mutateAsync({
          message: userMessage.content,
          threadId,
          locale: lang,
          action: {
            type: action.type,
            token: action.token,
          },
        });

        setThreadId(response.threadId);
        if (response.selectedOrderContext) {
          setSelectedOrderContext(response.selectedOrderContext);
        }
        setSupportTopicContext(response.supportTopicContext ?? null);
        setMessages((current) => [
          ...current,
          {
            id: createMessageId(),
            role: "assistant",
            content: response.assistantMessage,
            disposition: response.disposition,
            needsHumanSupport: response.needsHumanSupport,
            sources: response.sources,
            actions: response.actions,
          },
        ]);
      } catch {
        setMessages((current) =>
          current.filter((item) => item.id !== userMessage.id)
        );
        setError(t("error"));
      } finally {
        pendingSendRef.current = false;
        setIsSending(false);
      }
    },
    [lang, sendSupportMessage, t, threadId]
  );

  const sendSupportEmail = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (trimmed.length < 10) return false;

      setEmailError(null);
      setEmailSent(false);

      try {
        await sendSupportEmailMutation.mutateAsync({
          message: trimmed,
          locale: lang,
          threadId,
          currentUrl:
            typeof window === "undefined" ? undefined : window.location.href,
          selectedOrderContext: selectedOrderContext ?? undefined,
        });
        setEmailSent(true);
        return true;
      } catch {
        setEmailError(t("emailMode.sendError"));
        return false;
      }
    },
    [lang, selectedOrderContext, sendSupportEmailMutation, t, threadId],
  );

  const value = useMemo<SupportChatContextValue>(
    () => ({
      lang,
      open,
      setOpen,
      openChat,
      closeChat,
      mode,
      openEmailMode,
      backToChat,
      messages,
      input,
      setInput,
      isSending,
      error,
      isSendingEmail: sendSupportEmailMutation.isPending,
      emailError,
      emailSent,
      sendMessage,
      sendAction,
      sendSupportEmail,
      resetEmailState,
      clearChat,
    }),
    [
      clearChat,
      backToChat,
      closeChat,
      emailError,
      emailSent,
      error,
      input,
      isSending,
      lang,
      messages,
      mode,
      open,
      openChat,
      openEmailMode,
      resetEmailState,
      sendMessage,
      sendAction,
      sendSupportEmail,
      sendSupportEmailMutation.isPending,
    ]
  );

  return (
    <SupportChatContext.Provider value={value}>
      {children}
    </SupportChatContext.Provider>
  );
}

export function useSupportChat() {
  const context = useContext(SupportChatContext);

  if (!context) {
    throw new Error("useSupportChat must be used within SupportChatProvider");
  }

  return context;
}
