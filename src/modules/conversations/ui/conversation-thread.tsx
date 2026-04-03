"use client";

import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { MessageActions } from "@/modules/conversations/ui/message-actions";
import { Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";

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
  appLang?: AppLang;
};

type MessageBodyProps = {
  tTenantPage: (key: string) => string;
  mine: boolean;
  deleted: boolean;
  isEditing: boolean;
  text: string;
  editDraft: string;
  onEditDraftChange: (value: string) => void;
  onCancelEditAction: () => void;
  onSaveEditAction: () => void;
  saveDisabled: boolean;
};

function MessageBody({
  tTenantPage,
  mine,
  deleted,
  isEditing,
  text,
  editDraft,
  onEditDraftChange,
  onCancelEditAction,
  onSaveEditAction,
  saveDisabled,
}: MessageBodyProps) {
  if (isEditing) {
    return (
      <div className="space-y-2">
        <Textarea
          value={editDraft}
          onChange={(e) => onEditDraftChange(e.target.value)}
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
              onCancelEditAction();
            }}
          >
            {tTenantPage("conversation.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saveDisabled}
            onClick={(e) => {
              e.stopPropagation();
              onSaveEditAction();
            }}
          >
            {tTenantPage("conversation.save")}
          </Button>
        </div>
      </div>
    );
  }

  if (deleted) {
    return (
      <div
        className={mine ? "italic opacity-80" : "italic text-muted-foreground"}
      >
        {tTenantPage("conversation.message_deleted")}
      </div>
    );
  }

  return <div>{text}</div>;
}

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
  const tTenantPage = useTranslations("tenantPage");
  const [draft, setDraft] = useState("");
  const [historyEnabled, setHistoryEnabled] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { user } = useUser();

  const myAvatarSrc =
    myAvatarUrl ?? (viewerRole === "customer" ? user?.imageUrl : undefined);

  const myLabel = (
    (myName && myName.trim().length > 0 ? myName : null) ??
    user?.username ??
    user?.firstName ??
    user?.lastName ??
    ""
  ).trim();

  const otherLabel = (otherName ?? "").trim();
  const otherInitial = otherLabel ? otherLabel.slice(0, 1).toUpperCase() : "👤";
  const myInitial = myLabel ? myLabel.slice(0, 1).toUpperCase() : "👤";

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

  const dayKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

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

  const olderMessages = useMemo(() => {
    const pages = olderQ.data?.pages ?? [];
    return [...pages].reverse().flatMap((p) => p.items);
  }, [olderQ.data]);

  const allMessages: MessageItem[] = useMemo(() => {
    const latestMessages = latestQ.data?.items ?? [];
    return [...olderMessages, ...latestMessages];
  }, [olderMessages, latestQ.data?.items]);

  const sortedMessages = useMemo(() => {
    return [...allMessages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [allMessages]);

  const send = useMutation({
    ...trpc.messages.send.mutationOptions(),
    onSuccess: () => {
      setDraft("");
      latestQ.refetch();
    },
  });

  const hasOlder = !!latestQ.data?.nextCursor;

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
      <ScrollArea className="flex-1 min-h-0 px-4 py-4">
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
              tTenantPage("conversation.load_earlier")
            )}
          </Button>
        )}

        {latestQ.isLoading ? (
          <div className="text-xs text-muted-foreground">
            {tTenantPage("conversation.loading_messages")}
          </div>
        ) : sortedMessages.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            {emptyStateText ??
              tTenantPage.rich("conversation.empty", {
                provider: (chunks) => (
                  <span className="font-medium">{chunks}</span>
                ),
                name: otherName,
              })}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedMessages.map((m, idx) => {
              const mine = isMe(m);
              const deleted = !!(m as { deletedAt?: string | null }).deletedAt;
              const updatedAt =
                (m as { updatedAt?: string | null }).updatedAt ?? null;
              const edited = !deleted && !!updatedAt && updatedAt !== m.createdAt;
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
                  <div
                    className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
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
                          ? "bg-blue-600 text-white rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      }`}
                    >
                      {!deleted && mine && editingId !== m.id && (
                        <MessageActions
                          open={menuOpenId === m.id}
                          onOpenChangeAction={(open) =>
                            setMenuOpenId(open ? m.id : null)
                          }
                          onEditAction={() => {
                            setEditingId(m.id);
                            setEditDraft(m.text);
                            setMenuOpenId(null);
                          }}
                          onDeleteAction={() => {
                            setDeleteId(m.id);
                            setMenuOpenId(null);
                          }}
                        />
                      )}

                      <MessageBody
                        tTenantPage={tTenantPage}
                        mine={mine}
                        deleted={deleted}
                        isEditing={editingId === m.id}
                        text={m.text}
                        editDraft={editDraft}
                        onEditDraftChange={(value) => setEditDraft(value)}
                        onCancelEditAction={() => {
                          setEditingId(null);
                          setEditDraft("");
                        }}
                        onSaveEditAction={() => {
                          editMsg.mutate({ messageId: m.id, text: editDraft });
                        }}
                        saveDisabled={
                          editMsg.isPending ||
                          editDraft.trim().length === 0 ||
                          editDraft.trim().length > 5000
                        }
                      />

                      <div
                        className={[
                          "mt-1 flex items-center justify-end gap-1 text-[10px] leading-none",
                          mine ? "opacity-80" : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {deleted && (
                          <span className="rounded-full bg-background/60 px-2 py-0.5">
                            {tTenantPage("conversation.deleted")}
                          </span>
                        )}

                        {!deleted && edited && (
                          <span className="rounded-full bg-background/60 px-2 py-0.5">
                            {tTenantPage("conversation.edited")}
                          </span>
                        )}

                        <span>{formatMsgTime(m.createdAt)}</span>
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

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tTenantPage("conversation.delete_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tTenantPage("conversation.delete_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteId(null)}
              disabled={removeMsg.isPending}
            >
              {tTenantPage("conversation.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteId) return;
                removeMsg.mutate({ messageId: deleteId });
              }}
              disabled={removeMsg.isPending}
            >
              {tTenantPage("conversation.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="border-t p-3 bg-background">
        <div className="flex gap-2 items-end">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              disabled
                ? tTenantPage("conversation.composer_disabled")
                : tTenantPage("conversation.composer_placeholder")
            }
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
            aria-label={tTenantPage("conversation.send")}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {tTenantPage("conversation.composer_hint")}
        </p>
      </div>
    </div>
  );
}
