"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send } from "lucide-react";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type UpsertForTenantOutput = RouterOutputs["conversations"]["upsertForTenant"];

type ChatMessage = {
  id: string;
  role: "me" | "tenant";
  text: string;
};

type ConversationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  tenantName: string;
  tenantAvatarUrl?: string | null;
  myAvatarUrl?: string | null;
  disabled?: boolean;
};

export function ConversationSheet({
  open,
  onOpenChange,
  tenantSlug,
  tenantName,
  tenantAvatarUrl,
  myAvatarUrl,
  disabled,
}: ConversationSheetProps) {
  const trpc = useTRPC();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // prevent double upsert while open
  const startedRef = useRef(false);

  const upsert = useMutation({
    ...trpc.conversations.upsertForTenant.mutationOptions(),
    onSuccess: (doc: UpsertForTenantOutput) => {
      setConversationId(doc.id);
    },
  });

  // Reset when tenant changes
  useEffect(() => {
    setConversationId(null);
    setMessages([]);
    setDraft("");
    startedRef.current = false;
  }, [tenantSlug]);

  // Upsert when sheet opens
  useEffect(() => {
    if (!open) return;
    if (disabled) return;
    if (startedRef.current) return;

    startedRef.current = true;
    upsert.mutate({ tenantSlug });
  }, [open, disabled, tenantSlug, upsert]); // intentionally minimal deps

  const canSend = useMemo(
    () => draft.trim().length > 0 && !disabled,
    [draft, disabled]
  );

  // if user closes and reopens in the same tenant, allow upsert return
  useEffect(() => {
    if (!open) startedRef.current = false;
  }, [open]);

  const sendLocal = () => {
    const text = draft.trim();
    if (!text) return;

    // TEMP: local-only messages until we build Messages collection + procedures
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "me", text },
    ]);
    setDraft("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col"
      >
        <SheetHeader className="px-4 py-4 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={tenantAvatarUrl ?? undefined} />
              <AvatarFallback>
                {tenantName.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <SheetTitle className="text-base truncate">
                {tenantName}
              </SheetTitle>
              <p className="text-xs text-muted-foreground truncate">
                {disabled
                  ? "Sign in to contact this provider."
                  : upsert.isPending
                    ? "Starting conversation…"
                    : conversationId
                      ? "Conversation ready"
                      : " "}
              </p>
            </div>

            {upsert.isPending && (
              <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </SheetHeader>

        {/* History */}
        <ScrollArea className="flex-1 px-4 py-4">
          {/* Small “system” hint for now */}
          <div className="mb-4 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            This is the chat UI shell. Next step: persist messages in the
            database.
          </div>

          <div className="space-y-3">
            {messages.map((m) => {
              const isMe = m.role === "me";

              return (
                <div
                  key={m.id}
                  className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
                >
                  {!isMe && (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={tenantAvatarUrl ?? undefined} />
                      <AvatarFallback>
                        {tenantName.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    {m.text}
                  </div>

                  {isMe && (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={myAvatarUrl ?? undefined} />
                      <AvatarFallback>Me</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="border-t p-3 bg-background">
          <div className="flex gap-2 items-end">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={disabled ? "Sign in to write…" : "Write a message…"}
              disabled={disabled}
              className="min-h-11 max-h-32 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) sendLocal();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              disabled={!canSend}
              onClick={sendLocal}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Press Enter to send, Shift+Enter for a new line.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
