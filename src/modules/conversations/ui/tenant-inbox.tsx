"use client";

import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type InboxPage = RouterOutputs["conversations"]["listForTenant"];
type InboxItem = InboxPage["docs"][number];

type TenantInboxProps = {
  tenantSlug: string;
  activeConversationId: string | null;
  onSelectAction: (c: InboxItem) => void;
};

export function TenantInbox({
  tenantSlug,
  activeConversationId,
  onSelectAction,
}: TenantInboxProps) {
  const trpc = useTRPC();

  // Fetch messages with interval.
  // useQuery for the newest chunk, and useState/useEffect for the “history enabled” toggle.

  const [historyEnabled, setHistoryEnabled] = useState(false);

  useEffect(() => {
    setHistoryEnabled(false);
  }, [tenantSlug]);

  const latestQ = useQuery({
    ...trpc.conversations.listForTenant.queryOptions({
      tenantSlug,
      limit: 10,
      cursor: 1, // newest page
    }),
    refetchInterval: 8000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // infinite query (only when user clicks “Load more”): historyEnabled keeps older fetching “opt-in”
  const olderQ = useInfiniteQuery({
    ...trpc.conversations.listForTenant.infiniteQueryOptions({
      tenantSlug,
      limit: 10,
    }),
    enabled: historyEnabled && latestQ.data?.hasNextPage === true,
    initialPageParam: latestQ.data?.nextPage ?? null,
    getNextPageParam: (last) => last.nextPage ?? null,

    // optional but recommended: don't auto-refetch old pages
    refetchOnWindowFocus: false,
  });

  // Merge newest + older + dedupe by id

  const items = useMemo(() => {
    const latestDocs = latestQ.data?.docs ?? [];
    const olderDocs = (olderQ.data?.pages ?? []).flatMap((p) => p.docs);

    // Dedupe: conversations can move between pages when updatedAt changes
    const seen = new Set<string>();
    const merged: InboxItem[] = [];

    for (const c of [...latestDocs, ...olderDocs]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      merged.push(c);
    }

    return merged;
  }, [latestQ.data?.docs, olderQ.data]);

  // params for refetcging older messages
  const hasMore = !historyEnabled
    ? !!latestQ.data?.hasNextPage
    : olderQ.hasNextPage;

  return (
    <div className="h-full flex flex-col border-r bg-background">
      <div className="px-4 py-3 border-b">
        <div className="text-sm font-semibold">Inbox</div>
        <div className="text-xs text-muted-foreground truncate">
          {tenantSlug}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {latestQ.isLoading ? (
          <div className="p-4 text-xs text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">
            No conversations yet.
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {items.map((c) => {
              const active = c.id === activeConversationId;
              const preview = c.lastMessage?.text?.slice(0, 80) ?? "";

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectAction(c)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left hover:bg-muted/60 transition-colors",
                    active && "bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium truncate">
                      {c.customer?.name ?? "Customer"}
                    </div>
                    <div className="text-[11px] text-muted-foreground shrink-0">
                      {c.lastMessage?.createdAt
                        ? new Date(c.lastMessage.createdAt).toLocaleDateString()
                        : ""}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {preview || "No messages yet"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {(hasMore || olderQ.isLoading) && (
        <div className="p-2 border-t">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              if (!historyEnabled) setHistoryEnabled(true);
              else olderQ.fetchNextPage();
            }}
            disabled={olderQ.isFetchingNextPage || olderQ.isLoading}
          >
            {olderQ.isFetchingNextPage || olderQ.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
