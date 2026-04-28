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
import {
  type SupportChatAction,
  type SupportChatMessage,
} from "@/modules/support-chat/ui/types";

type SupportChatContextValue = {
  lang: AppLang;
  open: boolean;
  setOpen: (open: boolean) => void;
  openChat: () => void;
  closeChat: () => void;
  messages: SupportChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isSending: boolean;
  error: string | null;
  sendMessage: (message?: string) => Promise<void>;
  sendAction: (action: SupportChatAction) => Promise<void>;
};

const SupportChatContext = createContext<SupportChatContextValue | null>(null);

function createMessageId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
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

  const [open, setOpen] = useState(initialOpen);
  const [threadId, setThreadId] = useState<string | undefined>();
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingSendRef = useRef(false);

  const openChat = useCallback(() => setOpen(true), []);
  const closeChat = useCallback(() => setOpen(false), []);

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
        const response = await sendSupportMessage.mutateAsync({
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
    [input, lang, sendSupportMessage, t, threadId]
  );

  const sendAction = useCallback(
    async (action: SupportChatAction) => {
      if (pendingSendRef.current) return;
      pendingSendRef.current = true;

      const message = `Selected: ${action.label}`;
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

  const value = useMemo<SupportChatContextValue>(
    () => ({
      lang,
      open,
      setOpen,
      openChat,
      closeChat,
      messages,
      input,
      setInput,
      isSending,
      error,
      sendMessage,
      sendAction,
    }),
    [
      closeChat,
      error,
      input,
      isSending,
      lang,
      messages,
      open,
      openChat,
      sendMessage,
      sendAction,
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
