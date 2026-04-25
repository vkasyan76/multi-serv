"use client";

import { useTranslations } from "next-intl";
import type { AdminSupportThreadRow } from "@/modules/support-chat/server/admin-procedures";
import { cn } from "@/lib/utils";

function formatShortDate(value: string | null, locale: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

export function SupportChatThreadsTable({
  locale,
  rows,
  selectedId,
  onSelect,
}: {
  locale: string;
  rows: AdminSupportThreadRow[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("supportChatAdmin");

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-white px-4 py-6 text-sm text-muted-foreground">
        {t("emptyThreads")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr className="border-b">
              <th className="px-4 py-3 font-medium">{t("table.threadId")}</th>
              <th className="px-4 py-3 font-medium">{t("table.locale")}</th>
              <th className="px-4 py-3 font-medium">{t("table.status")}</th>
              <th className="px-4 py-3 font-medium">{t("table.lastDisposition")}</th>
              <th className="px-4 py-3 font-medium">{t("table.needsHumanSupport")}</th>
              <th className="px-4 py-3 font-medium">{t("table.messageCount")}</th>
              <th className="px-4 py-3 font-medium">{t("table.lastMessageAt")}</th>
              <th className="px-4 py-3 font-medium">{t("table.retentionUntil")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "cursor-pointer border-b last:border-b-0 hover:bg-muted/30",
                  selectedId === row.id && "bg-blue-50"
                )}
                onClick={() => onSelect(row.id)}
              >
                <td className="px-4 py-3 font-mono text-xs">{row.threadId}</td>
                <td className="px-4 py-3 uppercase">{row.locale}</td>
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3">{row.lastDisposition ?? "-"}</td>
                <td className="px-4 py-3">{row.lastNeedsHumanSupport ? t("common.yes") : t("common.no")}</td>
                <td className="px-4 py-3">{row.messageCount}</td>
                <td className="px-4 py-3">{formatShortDate(row.lastMessageAt, locale)}</td>
                <td className="px-4 py-3">{formatShortDate(row.retentionUntil, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
