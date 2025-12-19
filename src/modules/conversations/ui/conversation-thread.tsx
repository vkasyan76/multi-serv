"use client";

import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Loader2, Send, MoreVertical, Pencil, Trash2 } from "lucide-react";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";
import { DEFAULT_LIMIT } from "@/constants";

import { useUser } from "@clerk/nextjs";
import {
  mapAppLangToLocale,
  type AppLang,
} from "@/modules/profile/location-utils";

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
  appLang?: AppLang; // NEW (optional)
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
  appLang,
}: ConversationThreadProps) {
  const trpc = useTRPC();
  const [draft, setDraft] = useState("");
  const [historyEnabled, setHistoryEnabled] = useState(false);

  // Message Editing
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsTouch(window.matchMedia("(hover: none)").matches);
  }, []);

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

  // Compute locale + format helpers (date + time)
  const locale = useMemo(() => {
    if (appLang) return mapAppLangToLocale(appLang);
    if (typeof navigator !== "undefined") return navigator.language || "en-US";
    return "en-US";
  }, [appLang]);

  const formatMsgTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatMsgDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  // local “day key” (so separators follow the viewer’s local timezone)
  const dayKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  // Fetch messages with interval: poll only the newest chunk with a normal query, and load older pages separately.

  // -- MESSAGE FETCHING LOGIC --

  const latestQ = useQuery({
    ...trpc.messages.list.queryOptions({
      conversationId: conversationId ?? "",
      limit: DEFAULT_LIMIT,
    }),
    enabled: !!conversationId && !disabled,
    refetchInterval: !!conversationId && !disabled ? 5000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    setHistoryEnabled(false);

    // reset per-conversation UI state
    setMenuOpenId(null);
    setEditingId(null);
    setEditDraft("");
    setDeleteId(null);
  }, [conversationId]);

  const olderQ = useInfiniteQuery({
    ...trpc.messages.list.infiniteQueryOptions({
      conversationId: conversationId ?? "",
      limit: DEFAULT_LIMIT,
    }),
    enabled:
      historyEnabled &&
      !!conversationId &&
      !disabled &&
      latestQ.data?.nextCursor != null,
    initialPageParam: latestQ.data?.nextCursor ?? null,
    getNextPageParam: (last) => last.nextCursor ?? null,
  });

  // Editing Mutations
  const editMsg = useMutation({
    ...trpc.messages.edit.mutationOptions(),
    onSuccess: () => {
      setEditingId(null);
      setEditDraft("");
      latestQ.refetch();
      if (historyEnabled) olderQ.refetch();
    },
  });

  const removeMsg = useMutation({
    ...trpc.messages.remove.mutationOptions(),
    onSuccess: () => {
      setDeleteId(null);
      latestQ.refetch();
      if (historyEnabled) olderQ.refetch();
    },
  });

  // older pages: reverse pages then flatten
  const olderMessages = useMemo(() => {
    const pages = olderQ.data?.pages ?? [];
    return [...pages].reverse().flatMap((p) => p.items);
  }, [olderQ.data]);

  // Make message ordering robust (so separators work)
  const allMessages: MessageItem[] = useMemo(() => {
    const latestMessages = latestQ.data?.items ?? [];
    return [...olderMessages, ...latestMessages];
  }, [olderMessages, latestQ.data?.items]);

  const sortedMessages = useMemo(() => {
    return [...allMessages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [allMessages]);

  const send = useMutation({
    ...trpc.messages.send.mutationOptions(),
    onSuccess: () => {
      setDraft("");
      latestQ.refetch(); // ✅ refetch newest chunk only
    },
  });

  const hasOlder = !!latestQ.data?.nextCursor;

  //---

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
        {(!historyEnabled ? hasOlder : olderQ.hasNextPage) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!historyEnabled) setHistoryEnabled(true);
              else olderQ.fetchNextPage();
            }}
            disabled={olderQ.isFetchingNextPage || olderQ.isLoading}
          >
            {olderQ.isFetchingNextPage || olderQ.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Load earlier"
            )}
          </Button>
        )}

        {latestQ.isLoading ? (
          <div className="text-xs text-muted-foreground">Loading messages…</div>
        ) : sortedMessages.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            {emptyStateText ?? (
              <>
                No messages yet. Start a conversation with{" "}
                <span className="font-medium">{otherName}</span>.
              </>
            )}
          </div>
        ) : (
          // Date pill separators (per day, localized) & Time under each message (localized)
          <div className="space-y-3">
            {sortedMessages.map((m, idx) => {
              const mine = isMe(m);

              const deleted = !!(m as { deletedAt?: string | null }).deletedAt;

              const prev = sortedMessages[idx - 1];
              const showDateSeparator =
                !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);

              return (
                <div key={m.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center py-2">
                      <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                        {formatMsgDate(m.createdAt)}
                      </span>
                    </div>
                  )}
                  {/* Message Bubble */}
                  <div
                    className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
                    onClick={() => {
                      if (!mine) return;
                      if (!isTouch) return;
                      if (deleted) return;
                      if (editingId) return;
                      setMenuOpenId((prev) => (prev === m.id ? null : m.id));
                    }}
                  >
                    {!mine && (
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={otherAvatarUrl ?? undefined} />
                        <AvatarFallback>{otherInitial}</AvatarFallback>
                      </Avatar>
                    )}

                    <div
                      className={`relative group max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        mine
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      }`}
                    >
                      {/* Message Bubble */}
                      {/* Actions button (only for my messages, not deleted, not editing) */}
                      <div className="relative">
                        {!deleted && mine && editingId !== m.id && (
                          <TooltipProvider>
                            <DropdownMenu
                              open={menuOpenId === m.id}
                              onOpenChange={(open) =>
                                setMenuOpenId(open ? m.id : null)
                              }
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label="Actions"
                                      onClick={(e) => e.stopPropagation()}
                                      className={[
                                        "absolute -top-2 -right-2 rounded-full border bg-background shadow-sm p-1",
                                        // if you want “tap bubble to open” on touch, hide the icon visually on small screens:
                                        "opacity-0 sm:opacity-0 sm:group-hover:opacity-100",
                                        "focus:opacity-100",
                                      ].join(" ")}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Actions</TooltipContent>
                              </Tooltip>

                              <DropdownMenuContent align="end" side="top">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setEditingId(m.id);
                                    setEditDraft(m.text);
                                    setMenuOpenId(null);
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setDeleteId(m.id);
                                    setMenuOpenId(null);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TooltipProvider>
                        )}
                      </div>

                      {/* ✅ INSERT THIS BLOCK HERE (message body) */}
                      {editingId === m.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            className="min-h-20 resize-none bg-background/60"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(null);
                                setEditDraft("");
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={
                                editMsg.isPending ||
                                editDraft.trim().length === 0 ||
                                editDraft.trim().length > 5000
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                editMsg.mutate({
                                  messageId: m.id,
                                  text: editDraft,
                                });
                              }}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : deleted ? (
                        <div
                          className={
                            mine
                              ? "italic opacity-80"
                              : "italic text-muted-foreground"
                          }
                        >
                          Message deleted
                        </div>
                      ) : (
                        <div>{m.text}</div>
                      )}

                      {/* WhatsApp-style timestamp */}
                      <div
                        className={`mt-1 text-[10px] leading-none text-right ${
                          mine ? "opacity-80" : "text-muted-foreground"
                        }`}
                      >
                        {formatMsgTime(m.createdAt)}
                      </div>
                    </div>

                    {mine && (
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={myAvatarSrc} />
                        <AvatarFallback>{myInitial}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the message for both participants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteId(null)}
              disabled={removeMsg.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteId) return;
                removeMsg.mutate({ messageId: deleteId });
              }}
              disabled={removeMsg.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
