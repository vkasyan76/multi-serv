"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { normalizeToSupported, SUPPORTED_APP_LANGS } from "@/lib/i18n/app-lang";
import type { AppLang } from "@/lib/i18n/app-lang";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { SupportChatReviewSummary } from "@/modules/support-chat/ui/admin/support-chat-review-summary";
import { SupportChatThreadDetail } from "@/modules/support-chat/ui/admin/support-chat-thread-detail";
import { SupportChatThreadsTable } from "@/modules/support-chat/ui/admin/support-chat-threads-table";

type AdminFilterValue<T extends string> = T | "all";
type AdminReviewFilter =
  | "answered"
  | "order_selection_requested"
  | "uncertain"
  | "account_blocked"
  | "needs_review";

export function SupportChatAdminView() {
  const trpc = useTRPC();
  const t = useTranslations("supportChatAdmin");
  const params = useParams<{ lang?: string }>();
  const lang = normalizeToSupported(params?.lang);

  const [page, setPage] = useState(1);
  const [locale, setLocale] = useState<AdminFilterValue<AppLang>>("all");
  const [review, setReview] =
    useState<AdminFilterValue<AdminReviewFilter>>("all");
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const filters = useMemo(
    () => ({
      page,
      limit: 20,
      locale: locale === "all" ? undefined : locale,
      review: review === "all" ? undefined : review,
    }),
    [locale, page, review]
  );

  const summaryQ = useQuery(trpc.supportChat.adminReviewSummary.queryOptions());
  const threadsQ = useQuery(trpc.supportChat.adminListThreads.queryOptions(filters));
  const detailQ = useQuery({
    ...trpc.supportChat.adminGetThreadMessages.queryOptions({
      id: selectedId ?? "",
    }),
    enabled: Boolean(selectedId),
  });

  return (
    <div className="space-y-6">
      {summaryQ.isLoading ? (
        <div className="rounded-lg border bg-white px-4 py-6 text-sm text-muted-foreground">
          {t("loadingSummary")}
        </div>
      ) : summaryQ.isError || !summaryQ.data ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("loadSummaryError")}
        </div>
      ) : (
        <SupportChatReviewSummary summary={summaryQ.data} />
      )}

      <div className="rounded-lg border bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm text-muted-foreground">{t("filters.locale")}</label>
            <select
              className="h-10 rounded-md border bg-white px-3 text-sm"
              value={locale}
              onChange={(event) => {
                setLocale(
                  event.target.value === "all"
                    ? "all"
                    : normalizeToSupported(event.target.value)
                );
                setPage(1);
              }}
            >
              <option value="all">{t("filters.all")}</option>
              {SUPPORTED_APP_LANGS.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-muted-foreground">{t("filters.review")}</label>
            <select
              className="h-10 rounded-md border bg-white px-3 text-sm"
              value={review}
              onChange={(event) => {
                setReview(
                  event.target.value as AdminFilterValue<AdminReviewFilter>
                );
                setPage(1);
              }}
            >
              <option value="all">{t("filters.all")}</option>
              <option value="answered">{t("reviewState.answered")}</option>
              <option value="order_selection_requested">
                {t("reviewState.orderSelectionRequested")}
              </option>
              <option value="uncertain">{t("reviewState.uncertain")}</option>
              <option value="account_blocked">
                {t("reviewState.accountBlocked")}
              </option>
              <option value="needs_review">{t("reviewState.needsReview")}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-14rem)] items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="min-w-0 space-y-4">
          {threadsQ.isLoading ? (
            <div className="rounded-lg border bg-white px-4 py-6 text-sm text-muted-foreground">
              {t("loadingThreads")}
            </div>
          ) : threadsQ.isError || !threadsQ.data ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {t("loadThreadsError")}
            </div>
          ) : (
            <>
              <SupportChatThreadsTable
                locale={lang}
                resetSortKey={`${page}:${locale}:${review}`}
                rows={threadsQ.data.items}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />

              {threadsQ.data.totalPages > 1 ? (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="text-muted-foreground">
                    {t("pagination.pageOf", {
                      page: threadsQ.data.page,
                      totalPages: threadsQ.data.totalPages,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={threadsQ.data.page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      {t("pagination.previous")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!threadsQ.data.hasMore}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      {t("pagination.next")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="min-w-0 lg:sticky lg:top-4 lg:h-[calc(100vh-6rem)]">
          {detailQ.isLoading ? (
            <div className="rounded-lg border bg-white px-4 py-6 text-sm text-muted-foreground">
              {t("loadingThread")}
            </div>
          ) : detailQ.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {t("loadThreadError")}
            </div>
          ) : (
            <SupportChatThreadDetail locale={lang} detail={detailQ.data} />
          )}
        </div>
      </div>
    </div>
  );
}
