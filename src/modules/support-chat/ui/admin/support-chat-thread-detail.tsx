"use client";

import { useTranslations } from "next-intl";
import type { AppLang } from "@/lib/i18n/app-lang";
import type {
  AdminSupportMessageRow,
  AdminSupportThreadRow,
} from "@/modules/support-chat/server/admin-procedures";

type SupportThreadDetail = {
  thread: AdminSupportThreadRow;
  messages: AdminSupportMessageRow[];
};

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right break-all">{value ?? "-"}</span>
    </div>
  );
}

export function SupportChatThreadDetail({
  locale,
  detail,
}: {
  locale: AppLang;
  detail?: SupportThreadDetail;
}) {
  const t = useTranslations("supportChatAdmin");

  if (!detail) {
    return (
      <div className="rounded-lg border bg-white px-4 py-6 text-sm text-muted-foreground">
        {t("selectThread")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 space-y-2 text-sm">
        <h2 className="text-base font-semibold">{t("detail.thread")}</h2>
        <MetaRow label={t("table.threadId")} value={detail.thread.threadId} />
        <MetaRow label={t("table.locale")} value={detail.thread.locale.toUpperCase()} />
        <MetaRow label={t("table.status")} value={detail.thread.status} />
        <MetaRow label={t("table.lastDisposition")} value={detail.thread.lastDisposition} />
        <MetaRow
          label={t("table.needsHumanSupport")}
          value={detail.thread.lastNeedsHumanSupport ? t("common.yes") : t("common.no")}
        />
        <MetaRow label={t("table.messageCount")} value={detail.thread.messageCount} />
        <MetaRow label={t("detail.userId")} value={detail.thread.userId} />
        <MetaRow
          label={t("table.retentionUntil")}
          value={formatDate(detail.thread.retentionUntil, locale)}
        />
      </div>

      <div className="space-y-3">
        {detail.messages.map((message) => (
          <div key={message.id} className="rounded-lg border bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium capitalize">{message.role}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(message.createdAt, locale)}
              </p>
            </div>

            <div className="whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm">
              {message.text ?? "-"}
            </div>

            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <MetaRow label={t("detail.responseOrigin")} value={message.responseOrigin} />
              <MetaRow label={t("table.lastDisposition")} value={message.disposition} />
              <MetaRow
                label={t("table.needsHumanSupport")}
                value={message.needsHumanSupport ? t("common.yes") : t("common.no")}
              />
              <MetaRow label={t("detail.redactionApplied")} value={message.redactionApplied ? t("common.yes") : t("common.no")} />
              <MetaRow label={t("detail.model")} value={message.model} />
              <MetaRow label={t("detail.modelVersion")} value={message.modelVersion} />
              <MetaRow label={t("detail.promptVersion")} value={message.promptVersion} />
              <MetaRow label={t("detail.guardrailVersion")} value={message.guardrailVersion} />
              <MetaRow label={t("detail.retrievalVersion")} value={message.retrievalVersion} />
              <MetaRow label={t("detail.knowledgePackVersion")} value={message.knowledgePackVersion} />
            </div>

            {message.redactionTypes.length > 0 ? (
              <div className="space-y-1 text-xs">
                <p className="font-medium">{t("detail.redactionTypes")}</p>
                <p className="text-muted-foreground">{message.redactionTypes.join(", ")}</p>
              </div>
            ) : null}

            {message.sources.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("detail.sources")}</p>
                <div className="space-y-2">
                  {message.sources.map((source) => (
                    <div key={`${message.id}-${source.chunkId}`} className="rounded-md border bg-muted/20 p-3 text-xs space-y-1">
                      <MetaRow label={t("detail.documentId")} value={source.documentId} />
                      <MetaRow label={t("detail.sectionId")} value={source.sectionId} />
                      <MetaRow label={t("detail.sourceType")} value={source.sourceType} />
                      <MetaRow label={t("detail.sourceLocale")} value={source.sourceLocale.toUpperCase()} />
                      <MetaRow label={t("detail.score")} value={source.score} />
                      <MetaRow
                        label={t("detail.matchedTerms")}
                        value={source.matchedTerms.join(", ") || "-"}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
