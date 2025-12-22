"use client";

import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, ArrowUpDown } from "lucide-react";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";
import { Input } from "@/components/ui/input";

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

  const [search, setSearch] = useState(""); // Search by customer name

  const [dateOrder, setDateOrder] = useState<"desc" | "asc">("desc"); // Date sort toggle (Recent ⇄ Oldest)(local UI state)

  useEffect(() => {
    setHistoryEnabled(false);

    // Optional: reset search/sort when switching tenant
    setSearch("");
    setDateOrder("desc");
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

  // ✅ Apply: hide empty convos + date sort + search-by-name
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    // 1) Hide conversations without messages (UI safety net)
    const withMessages = items.filter((c) => !!c.lastMessage?.createdAt);

    // 2) Sort by date (Recent ⇄ Oldest)
    const sorted = [...withMessages].sort((a, b) => {
      const aTs = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : 0;

      const bTs = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : 0;

      // desc = Recent first, asc = Oldest first
      return dateOrder === "desc" ? bTs - aTs : aTs - bTs;
    });

    // 3) Search by customer name
    if (!q) return sorted;

    return sorted.filter((c) =>
      (c.customer?.name ?? "Customer").toLowerCase().includes(q)
    );
  }, [items, search, dateOrder]);

  // params for refetcging older messages
  const hasMore = !historyEnabled
    ? !!latestQ.data?.hasNextPage
    : olderQ.hasNextPage;

  return (
    // (italki-style: search box + date sort toggle in the header area)
    <div className="h-full min-h-0 flex flex-col bg-background md:border-r border-b md:border-b-0">
      <div className="px-4 py-3 border-b space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Inbox</div>
            <div className="text-xs text-muted-foreground truncate">
              {tenantSlug}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="shrink-0"
            onClick={() => setDateOrder((p) => (p === "desc" ? "asc" : "desc"))}
            title={dateOrder === "desc" ? "Sort: Recent" : "Sort: Oldest"}
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            {dateOrder === "desc" ? "Recent" : "Oldest"}
          </Button>
        </div>

        <Input
          type="search"
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 text-sm placeholder:text-sm"
        />
      </div>

      <div className="flex-1 overflow-auto">
        {latestQ.isLoading ? (
          <div className="p-4 text-xs text-muted-foreground">Loading…</div>
        ) : visibleItems.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">
            {search.trim()
              ? "No matching conversations."
              : "No conversations yet."}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {visibleItems.map((c) => {
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
                    {preview}
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
