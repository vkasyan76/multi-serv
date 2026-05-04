"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  AdminSupportReviewState,
  AdminSupportThreadRow,
  AdminSupportUserSummary,
} from "@/modules/support-chat/server/admin-procedures";
import { cn } from "@/lib/utils";

type SupportChatSortKey = "user" | "status" | "lastActivity";
type SupportChatSortDir = "asc" | "desc";

function formatShortDate(value: string | null, locale: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

function userDisplayName(user: AdminSupportUserSummary) {
  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fullName || user.username || user.email;
}

function userSecondaryLine(user: AdminSupportUserSummary) {
  if (!user) return null;
  return user.email || user.username || user.id;
}

function userSortValue(row: AdminSupportThreadRow) {
  return (
    userDisplayName(row.user) ??
    row.user?.email ??
    row.user?.username ??
    row.threadId
  ).toLocaleLowerCase();
}

function statusSortValue(row: AdminSupportThreadRow) {
  if (row.reviewState === "needs_review") return 0;
  if (row.reviewState === "uncertain") return 1;
  if (row.reviewState === "account_blocked") return 2;
  return 3;
}

function activitySortValue(row: AdminSupportThreadRow) {
  return row.lastMessageAt ? new Date(row.lastMessageAt).getTime() : 0;
}

function sortRows(
  rows: AdminSupportThreadRow[],
  sort: { key: SupportChatSortKey; dir: SupportChatSortDir } | null
) {
  if (!sort) return rows;

  const list = [...rows];
  list.sort((a, b) => {
    let cmp = 0;

    if (sort.key === "user") {
      cmp = userSortValue(a).localeCompare(userSortValue(b));
    } else if (sort.key === "status") {
      cmp = statusSortValue(a) - statusSortValue(b);
    } else {
      cmp = activitySortValue(a) - activitySortValue(b);
    }

    if (cmp === 0) {
      cmp = activitySortValue(a) - activitySortValue(b);
    }

    return sort.dir === "asc" ? cmp : -cmp;
  });

  return list;
}

function reviewStateLabel(
  t: ReturnType<typeof useTranslations>,
  state: AdminSupportReviewState
) {
  if (state === "needs_review") return t("reviewState.needsReview");
  if (state === "uncertain") return t("reviewState.uncertain");
  if (state === "account_blocked") return t("reviewState.accountBlocked");
  return t("reviewState.answered");
}

function ReviewBadge({ state }: { state: AdminSupportReviewState }) {
  const t = useTranslations("supportChatAdmin");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        state === "needs_review" && "bg-amber-100 text-amber-900",
        state === "uncertain" && "bg-yellow-100 text-yellow-900",
        state === "account_blocked" && "bg-orange-100 text-orange-900",
        state === "answered" && "bg-emerald-100 text-emerald-900"
      )}
    >
      {reviewStateLabel(t, state)}
    </span>
  );
}

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: SupportChatSortDir;
}) {
  if (!active) return <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 h-4 w-4 opacity-70" />
  ) : (
    <ArrowDown className="ml-1 h-4 w-4 opacity-70" />
  );
}

function SortButton({
  children,
  sortKey,
  activeSort,
  onSort,
}: {
  children: React.ReactNode;
  sortKey: SupportChatSortKey;
  activeSort: { key: SupportChatSortKey; dir: SupportChatSortDir } | null;
  onSort: (key: SupportChatSortKey) => void;
}) {
  const t = useTranslations("supportChatAdmin");
  const active = activeSort?.key === sortKey;
  const dir = activeSort?.dir ?? "asc";

  return (
    <button
      type="button"
      className="inline-flex items-center text-left font-medium"
      aria-label={
        active
          ? dir === "asc"
            ? t("sort.ascending")
            : t("sort.descending")
          : t("sort.notSorted")
      }
      onClick={() => onSort(sortKey)}
    >
      {children}
      <SortIcon active={active} dir={dir} />
    </button>
  );
}

export function SupportChatThreadsTable({
  locale,
  resetSortKey,
  rows,
  selectedId,
  onSelect,
}: {
  locale: string;
  resetSortKey: string;
  rows: AdminSupportThreadRow[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("supportChatAdmin");
  const [sort, setSort] = useState<{
    key: SupportChatSortKey;
    dir: SupportChatSortDir;
  } | null>(null);

  useEffect(() => {
    setSort(null);
  }, [resetSortKey]);

  const sortedRows = useMemo(() => sortRows(rows, sort), [rows, sort]);

  function toggleSort(key: SupportChatSortKey) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: "asc" };
      if (current.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-white px-4 py-6 text-sm text-muted-foreground">
        {t("emptyThreads")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <table className="w-full table-fixed text-sm">
        <thead className="border-b bg-muted/40 text-left">
          <tr>
            <th className="w-[24%] px-3 py-3 font-medium">
              <SortButton
                activeSort={sort}
                sortKey="user"
                onSort={toggleSort}
              >
                {t("table.user")}
              </SortButton>
            </th>
            <th className="w-[40%] px-3 py-3 font-medium">
              {t("table.latestMessage")}
            </th>
            <th className="w-[18%] px-3 py-3 font-medium">
              <SortButton
                activeSort={sort}
                sortKey="status"
                onSort={toggleSort}
              >
                {t("table.statusSummary")}
              </SortButton>
            </th>
            <th className="w-[18%] px-3 py-3 font-medium">
              <SortButton
                activeSort={sort}
                sortKey="lastActivity"
                onSort={toggleSort}
              >
                {t("table.lastActivity")}
              </SortButton>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const displayName = userDisplayName(row.user);
            const secondary = userSecondaryLine(row.user);

            return (
              <tr
                key={row.id}
                role="button"
                tabIndex={0}
                className={cn(
                  "cursor-pointer border-b border-l-4 border-l-transparent last:border-b-0 hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40",
                  selectedId === row.id && "border-l-primary bg-blue-50"
                )}
                onClick={() => onSelect(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(row.id);
                  }
                }}
              >
                <td className="px-3 py-3 align-top">
                  <p className="truncate font-medium">
                    {displayName ?? t("thread.anonymous")}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {secondary ?? t("thread.anonymousSubtitle")}
                  </p>
                </td>
                <td className="px-3 py-3 align-top">
                  <p className="line-clamp-2 leading-5">
                    {row.latestUserMessagePreview ?? t("thread.noPreview")}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {row.locale.toUpperCase()}{" "}
                    <span aria-hidden="true">&middot;</span>{" "}
                    {t("thread.messageCount", { count: row.messageCount })}
                  </p>
                </td>
                <td className="px-3 py-3 align-top">
                  <ReviewBadge state={row.reviewState} />
                </td>
                <td className="px-3 py-3 align-top text-xs">
                  <span className="block leading-5">
                    {formatShortDate(row.lastMessageAt, locale)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
