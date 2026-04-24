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
type AdminDisposition =
  | "answered"
  | "uncertain"
  | "escalate"
  | "unsupported_account_question";

export function SupportChatAdminView() {
  const trpc = useTRPC();
  const t = useTranslations("supportChatAdmin");
  const params = useParams<{ lang?: string }>();
  const lang = normalizeToSupported(params?.lang);

  const [page, setPage] = useState(1);
  const [locale, setLocale] = useState<AdminFilterValue<AppLang>>("all");
  const [status, setStatus] = useState<
    AdminFilterValue<"open" | "escalated" | "closed">
  >("all");
  const [lastDisposition, setLastDisposition] =
    useState<AdminFilterValue<AdminDisposition>>("all");
  const [needsHumanSupport, setNeedsHumanSupport] =
    useState<AdminFilterValue<"yes" | "no">>("all");
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const filters = useMemo(
    () => ({
      page,
      limit: 20,
      locale: locale === "all" ? undefined : locale,
      status: status === "all" ? undefined : status,
      lastDisposition: lastDisposition === "all" ? undefined : lastDisposition,
      needsHumanSupport:
        needsHumanSupport === "all"
          ? undefined
          : needsHumanSupport === "yes",
    }),
    [lastDisposition, locale, needsHumanSupport, page, status]
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

      <div className="rounded-lg border bg-white p-4 flex flex-col gap-3 lg:flex-row lg:items-end">
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
          <label className="text-sm text-muted-foreground">{t("filters.status")}</label>
          <select
            className="h-10 rounded-md border bg-white px-3 text-sm"
            value={status}
            onChange={(event) => {
              setStatus(
                event.target.value as AdminFilterValue<
                  "open" | "escalated" | "closed"
                >
              );
              setPage(1);
            }}
          >
            <option value="all">{t("filters.all")}</option>
            <option value="open">{t("status.open")}</option>
            <option value="escalated">{t("status.escalated")}</option>
            <option value="closed">{t("status.closed")}</option>
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm text-muted-foreground">{t("filters.lastDisposition")}</label>
          <select
            className="h-10 rounded-md border bg-white px-3 text-sm"
            value={lastDisposition}
            onChange={(event) => {
              setLastDisposition(
                event.target.value as AdminFilterValue<AdminDisposition>
              );
              setPage(1);
            }}
          >
            <option value="all">{t("filters.all")}</option>
            <option value="answered">answered</option>
            <option value="uncertain">uncertain</option>
            <option value="escalate">escalate</option>
            <option value="unsupported_account_question">unsupported_account_question</option>
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm text-muted-foreground">{t("filters.needsHumanSupport")}</label>
          <select
            className="h-10 rounded-md border bg-white px-3 text-sm"
            value={needsHumanSupport}
            onChange={(event) => {
              setNeedsHumanSupport(
                event.target.value as AdminFilterValue<"yes" | "no">
              );
              setPage(1);
            }}
          >
            <option value="all">{t("filters.all")}</option>
            <option value="yes">{t("common.yes")}</option>
            <option value="no">{t("common.no")}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
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
  );
}
