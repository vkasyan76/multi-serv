"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
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

type MessagesListOutput = RouterOutputs["messages"]["list"];
type MessageItem = MessagesListOutput["items"][number];

type ConversationSheetProps = {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  tenantSlug: string;
  tenantName: string;
  tenantAvatarUrl?: string | null;
  myAvatarUrl?: string | null;
  disabled?: boolean;
};

export function ConversationSheet({
  open,
  onOpenChangeAction,
  tenantSlug,
  tenantName,
  tenantAvatarUrl,
  myAvatarUrl,
  disabled,
}: ConversationSheetProps) {
  const trpc = useTRPC();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  // prevent double upsert while open
  const startedRef = useRef(false);

  // Upsert conversation for this tenant
  const upsert = useMutation({
    ...trpc.conversations.upsertForTenant.mutationOptions(),
    onSuccess: (doc: UpsertForTenantOutput) => {
      setConversationId(doc.id);
    },
  });

  // create a list of messages
  const messagesQ = useInfiniteQuery({
    ...trpc.messages.list.infiniteQueryOptions({
      conversationId: conversationId ?? "",
      limit: 30,
    }),
    enabled: open && !!conversationId && !disabled,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  // pages: first page = newest chunk, next pages = older chunks
  // so for UI (oldest -> newest), reverse pages then flatten
  const allMessages: MessageItem[] = useMemo(() => {
    const pages = messagesQ.data?.pages ?? [];
    return [...pages].reverse().flatMap((p) => p.items);
  }, [messagesQ.data]);

  // sending messages
  const send = useMutation({
    ...trpc.messages.send.mutationOptions(),
    onSuccess: () => {
      setDraft("");
      messagesQ.refetch(); // simplest: refresh latest page so new msg appears
    },
  });

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;
    if (!conversationId) return;
    if (disabled) return;

    send.mutate({ conversationId, text });
  };

  // Reset when tenant changes
  useEffect(() => {
    setConversationId(null);
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

  // enable message send

  const canSend = useMemo(
    () =>
      draft.trim().length > 0 &&
      !disabled &&
      !!conversationId &&
      !send.isPending,
    [draft, disabled, conversationId, send.isPending]
  );

  // Don’t render empty-state while upsert is still running / no conversationId yet
  const conversationReady = !!conversationId && !upsert.isPending;

  // if user closes and reopens in the same tenant, allow upsert return
  useEffect(() => {
    if (!open) startedRef.current = false;
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChangeAction}>
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
        {/* History */}
        <ScrollArea className="flex-1 px-4 py-4">
          {messagesQ.hasNextPage && (
            <div className="mb-3 flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => messagesQ.fetchNextPage()}
                disabled={messagesQ.isFetchingNextPage}
              >
                {messagesQ.isFetchingNextPage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Load earlier"
                )}
              </Button>
            </div>
          )}

          {!conversationReady && !disabled ? (
            <div className="text-xs text-muted-foreground">
              Loading messages…
            </div>
          ) : allMessages.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No messages yet. Start a conversation with{" "}
              <span className="font-medium">{tenantSlug}</span>.
            </div>
          ) : (
            <div className="space-y-3">
              {allMessages.map((m) => {
                // on the public tenant page, "customer" is ME, "tenant" is THE OTHER SIDE
                // When you reuse this in the tenant dashboard, you’ll either: invert that (senderRole === "tenant" isMe), or add a prop like viewerRole: "customer" | "tenant" and compute isMe from it.
                const isMe = m.senderRole === "customer";

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
          )}
        </ScrollArea>

        {/* Composer */}
        <div className="border-t p-3 bg-background">
          <div className="flex gap-2 items-end">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                disabled
                  ? "Sign in to write…"
                  : !conversationReady
                    ? "Starting conversation…"
                    : "Write a message…"
              }
              disabled={disabled || !conversationReady}
              className="min-h-11 max-h-32 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) sendMessage();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              className="h-11 w-11"
              disabled={!canSend}
              onClick={sendMessage}
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
