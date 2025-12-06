"use client";

import { useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send } from "lucide-react";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";
import { DEFAULT_LIMIT } from "@/constants";

import { useUser } from "@clerk/nextjs";

type RouterOutputs = inferRouterOutputs<AppRouter>;

type MessagesListOutput = RouterOutputs["messages"]["list"];
type MessageItem = MessagesListOutput["items"][number];

type ViewerRole = "customer" | "tenant";

type ConversationThreadProps = {
  conversationId: string | null;
  viewerRole: ViewerRole;

  otherName: string;
  otherAvatarUrl?: string | null;

  myName?: string;
  myAvatarUrl?: string | null;

  disabled?: boolean;

  emptyStateText?: React.ReactNode;
};

export function ConversationThread({
  conversationId,
  viewerRole,
  otherName,
  otherAvatarUrl,
  myName,
  myAvatarUrl,
  disabled,
  emptyStateText,
}: ConversationThreadProps) {
  const trpc = useTRPC();
  const [draft, setDraft] = useState("");

  const { user } = useUser();

  //!mine should render otherAvatarUrl / otherInitial
  // mine should render myAvatarSrc / myInitial
  //   Each message belongs to a senderRole: "customer" or "tenant" (stored in messages.senderRole).
  // viewerRole tells the thread who is currently viewing:
  // In the public ConversationSheet: viewerRole="customer"
  // In the tenant dashboard: viewerRole="tenant"

  // fall back to Clerk user image url
  const myAvatarSrc =
    myAvatarUrl ?? (viewerRole === "customer" ? user?.imageUrl : undefined);

  const myLabel = (
    (myName && myName.trim().length > 0 ? myName : null) ??
    user?.username ??
    user?.firstName ??
    user?.lastName ??
    ""
  ).trim();

  // myName/myAvatarUrl = avatar/name of the person using the UI
  // otherName/otherAvatarUrl = the other party in the conversation

  const otherLabel = (otherName ?? "").trim();
  const otherInitial = otherLabel ? otherLabel.slice(0, 1).toUpperCase() : "👤";

  const myInitial = myLabel ? myLabel.slice(0, 1).toUpperCase() : "👤";

  // Fetch messages with interval
  const messagesQ = useInfiniteQuery({
    ...trpc.messages.list.infiniteQueryOptions({
      conversationId: conversationId ?? "",
      limit: DEFAULT_LIMIT,
    }),
    enabled: !!conversationId && !disabled,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,

    refetchInterval: !!conversationId && !disabled ? 5000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const allMessages: MessageItem[] = useMemo(() => {
    const pages = messagesQ.data?.pages ?? [];
    return [...pages].reverse().flatMap((p) => p.items);
  }, [messagesQ.data]);

  const send = useMutation({
    ...trpc.messages.send.mutationOptions(),
    onSuccess: () => {
      setDraft("");
      messagesQ.refetch();
    },
  });

  const canSend =
    draft.trim().length > 0 && !!conversationId && !disabled && !send.isPending;

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || !conversationId || disabled) return;
    send.mutate({ conversationId, text });
  };

  const isMe = (m: MessageItem) => m.senderRole === viewerRole;

  return (
    <div className="flex flex-col h-full">
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

        {messagesQ.isLoading ? (
          <div className="text-xs text-muted-foreground">Loading messages…</div>
        ) : allMessages.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            {emptyStateText ?? (
              <>
                No messages yet. Start a conversation with{" "}
                <span className="font-medium">{otherName}</span>.
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {allMessages.map((m) => {
              const mine = isMe(m);

              return (
                <div
                  key={m.id}
                  className={`flex items-end gap-2 ${
                    mine ? "justify-end" : "justify-start"
                  }`}
                >
                  {!mine && (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={otherAvatarUrl ?? undefined} />
                      <AvatarFallback>{otherInitial}</AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    {m.text}
                  </div>

                  {mine && (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={myAvatarSrc} />
                      <AvatarFallback>{myInitial}</AvatarFallback>
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
            placeholder={disabled ? "Disabled…" : "Write a message…"}
            disabled={disabled || !conversationId}
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
    </div>
  );
}
