"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTRPC } from "@/trpc/client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, ArrowUpDown } from "lucide-react";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";
import { Input } from "@/components/ui/input";
import { normalizeToSupported } from "@/lib/i18n/app-lang";
import { getLocaleAndCurrency } from "@/lib/i18n/locale";

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
  const tDashboard = useTranslations("dashboard");
  const params = useParams<{ lang?: string }>();
  const appLang = normalizeToSupported(params?.lang);
  const locale = getLocaleAndCurrency(appLang).locale;

  // Fetch messages with interval.
  // useQuery for the newest chunk, and useState/useEffect for the "history enabled" toggle.
  const [historyEnabled, setHistoryEnabled] = useState(false);

  const [search, setSearch] = useState("");

  const [dateOrder, setDateOrder] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    setHistoryEnabled(false);
    setSearch("");
    setDateOrder("desc");
  }, [tenantSlug]);

  const latestQ = useQuery({
    ...trpc.conversations.listForTenant.queryOptions({
      tenantSlug,
      limit: 10,
      cursor: 1,
    }),
    refetchInterval: 8000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // Infinite query is opt-in after "Load more" to avoid eagerly fetching older pages.
  const olderQ = useInfiniteQuery({
    ...trpc.conversations.listForTenant.infiniteQueryOptions({
      tenantSlug,
      limit: 10,
    }),
    enabled: historyEnabled && !!latestQ.data?.hasNextPage,
    initialPageParam: latestQ.data?.nextPage ?? 2,
    getNextPageParam: (last) => last.nextPage,
    refetchOnWindowFocus: false,
  });

  const items = useMemo(() => {
    const latestDocs = latestQ.data?.docs ?? [];
    const olderDocs = (olderQ.data?.pages ?? []).flatMap((p) => p.docs);

    const seen = new Set<string>();
    const merged: InboxItem[] = [];

    for (const conversation of [...latestDocs, ...olderDocs]) {
      if (seen.has(conversation.id)) continue;
      seen.add(conversation.id);
      merged.push(conversation);
    }

    return merged;
  }, [latestQ.data?.docs, olderQ.data]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const customerFallback = tDashboard("inbox.customer_fallback");

    const withMessages = items.filter((conversation) => !!conversation.lastMessageAt);

    const sorted = [...withMessages].sort((a, b) => {
      const aTs = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTs = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;

      return dateOrder === "desc" ? bTs - aTs : aTs - bTs;
    });

    if (!q) return sorted;

    return sorted.filter((conversation) =>
      (conversation.customer?.name ?? customerFallback)
        .toLowerCase()
        .includes(q),
    );
  }, [items, search, dateOrder, tDashboard]);

  const hasMore = !historyEnabled
    ? !!latestQ.data?.hasNextPage
    : olderQ.hasNextPage;

  const sortLabel =
    dateOrder === "desc"
      ? tDashboard("inbox.recent")
      : tDashboard("inbox.oldest");

  return (
    <div className="h-full min-h-0 flex flex-col bg-background md:border-r border-b md:border-b-0">
      <div className="px-4 py-3 border-b space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">
              {tDashboard("inbox.title")}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {tenantSlug}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="shrink-0"
            onClick={() => setDateOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
            title={sortLabel}
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            {sortLabel}
          </Button>
        </div>

        <Input
          type="search"
          placeholder={tDashboard("inbox.search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 text-sm placeholder:text-sm"
        />
      </div>

      <div className="flex-1 overflow-auto">
        {latestQ.isLoading ? (
          <div className="p-4 text-xs text-muted-foreground">
            {tDashboard("inbox.loading")}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">
            {search.trim()
              ? tDashboard("inbox.empty_search")
              : tDashboard("inbox.empty")}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {visibleItems.map((conversation) => {
              const active = conversation.id === activeConversationId;
              const preview = (conversation.lastMessagePreview ?? "").slice(0, 80);

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelectAction(conversation)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left hover:bg-muted/60 transition-colors",
                    active && "bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium truncate">
                      {conversation.customer?.name ??
                        tDashboard("inbox.customer_fallback")}
                    </div>
                    <div className="text-[11px] text-muted-foreground shrink-0">
                      {conversation.lastMessageAt
                        ? new Intl.DateTimeFormat(locale).format(
                            new Date(conversation.lastMessageAt),
                          )
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
              tDashboard("inbox.load_more")
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
