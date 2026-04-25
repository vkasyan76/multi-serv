"use client";

import { useTranslations } from "next-intl";

export function SupportChatReviewSummary({
  summary,
}: {
  summary: {
    totals: {
      threads: number;
      messages: number;
      assistantMessages: number;
    };
    dispositions: {
      answered: number;
      uncertain: number;
      escalate: number;
      unsupported_account_question: number;
    };
    needsHumanSupportCount: number;
    responseOrigins: {
      server: number;
      model: number;
    };
    locales: Array<{
      locale: string;
      count: number;
    }>;
    topSourceDocuments: Array<{
      documentId: string;
      count: number;
    }>;
  };
}) {
  const t = useTranslations("supportChatAdmin");

  const cards = [
    { label: t("summary.threads"), value: summary.totals.threads },
    { label: t("summary.assistantMessages"), value: summary.totals.assistantMessages },
    { label: t("summary.uncertain"), value: summary.dispositions.uncertain },
    { label: t("summary.escalate"), value: summary.dispositions.escalate },
    {
      label: t("summary.unsupportedAccount"),
      value: summary.dispositions.unsupported_account_question,
    },
    {
      label: t("summary.needsHumanSupport"),
      value: summary.needsHumanSupportCount,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold">{t("summary.localeBreakdown")}</h2>
          {summary.locales.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emptySummary")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {summary.locales.map((locale) => (
                <li key={locale.locale} className="flex items-center justify-between gap-3">
                  <span className="uppercase">{locale.locale}</span>
                  <span className="font-medium">{locale.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold">{t("summary.topSourceDocuments")}</h2>
          {summary.topSourceDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emptySummary")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {summary.topSourceDocuments.map((source) => (
                <li key={source.documentId} className="flex items-center justify-between gap-3">
                  <span className="truncate">{source.documentId}</span>
                  <span className="font-medium">{source.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
