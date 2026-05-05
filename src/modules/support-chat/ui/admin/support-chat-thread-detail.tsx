"use client";

import { useTranslations } from "next-intl";
import type { AppLang } from "@/lib/i18n/app-lang";
import { cn } from "@/lib/utils";
import type {
  AdminSupportAssistantOutcome,
  AdminSupportMessageRow,
  AdminSupportReviewState,
  AdminSupportThreadRow,
  AdminSupportUserSummary,
} from "@/modules/support-chat/server/admin-procedures";

type SupportThreadDetail = {
  thread: AdminSupportThreadRow;
  messages: AdminSupportMessageRow[];
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "-";

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

function userDisplayName(user: AdminSupportUserSummary) {
  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fullName || user.username || user.email;
}

function ReviewBadge({ state }: { state: AdminSupportReviewState }) {
  const t = useTranslations("supportChatAdmin");
  const label =
    state === "needs_review"
      ? t("reviewState.needsReview")
      : state === "order_selection_requested"
      ? t("reviewState.orderSelectionRequested")
      : state === "uncertain"
      ? t("reviewState.uncertain")
      : state === "account_blocked"
      ? t("reviewState.accountBlocked")
      : t("reviewState.answered");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        state === "needs_review" && "bg-amber-100 text-amber-900",
        state === "order_selection_requested" && "bg-sky-100 text-sky-900",
        state === "uncertain" && "bg-yellow-100 text-yellow-900",
        state === "account_blocked" && "bg-orange-100 text-orange-900",
        state === "answered" && "bg-emerald-100 text-emerald-900"
      )}
    >
      {label}
    </span>
  );
}

function outcomeFromDisposition(
  disposition: AdminSupportMessageRow["disposition"]
): AdminSupportAssistantOutcome {
  if (disposition === "escalate") return "escalated";
  return disposition ?? null;
}

function OutcomeBadge({
  outcome,
  orderSelectionRequested = false,
}: {
  outcome: AdminSupportAssistantOutcome;
  orderSelectionRequested?: boolean;
}) {
  const t = useTranslations("supportChatAdmin");
  if (!outcome) return null;
  const label =
    orderSelectionRequested
      ? t("reviewState.orderSelectionRequested")
      : outcome === "unsupported_account_question"
        ? t("outcome.accountBlocked")
        : outcome === "escalated"
          ? t("outcome.escalated")
          : outcome === "uncertain"
            ? t("outcome.uncertain")
            : t("outcome.answered");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        orderSelectionRequested && "bg-sky-50 text-sky-800",
        outcome === "answered" && "bg-emerald-50 text-emerald-800",
        outcome === "uncertain" &&
          !orderSelectionRequested &&
          "bg-amber-50 text-amber-800",
        outcome === "escalated" && "bg-red-50 text-red-800",
        outcome === "unsupported_account_question" &&
          "bg-orange-50 text-orange-800"
      )}
    >
      {label}
    </span>
  );
}

function hasCandidateSelectionContext(message: AdminSupportMessageRow) {
  return message.accountContextSnapshots.some(
    (snapshot) => snapshot.kind === "candidate_selection"
  );
}

function outcomeHelp(
  t: ReturnType<typeof useTranslations>,
  outcome: Exclude<AdminSupportAssistantOutcome, "answered" | null>
) {
  if (outcome === "unsupported_account_question") {
    return t("outcomeHelp.accountBlocked");
  }
  if (outcome === "escalated") return t("outcomeHelp.escalated");
  return t("outcomeHelp.uncertain");
}

function ConversationMessage({
  message,
  locale,
}: {
  message: AdminSupportMessageRow;
  locale: AppLang;
}) {
  const t = useTranslations("supportChatAdmin");
  const isAssistant = message.role === "assistant";
  const outcome = isAssistant ? outcomeFromDisposition(message.disposition) : null;
  const orderSelectionRequested =
    isAssistant && outcome === "uncertain" && hasCandidateSelectionContext(message);
  const shouldExplain =
    outcome && outcome !== "answered" && !orderSelectionRequested;

  return (
    <article
      className={cn(
        "rounded-lg border p-4",
        isAssistant ? "bg-white" : "bg-muted/30"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="font-medium">
            {isAssistant ? t("detail.assistant") : t("detail.user")}
          </p>
          <OutcomeBadge
            outcome={outcome}
            orderSelectionRequested={orderSelectionRequested}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDate(message.createdAt, locale)}
        </p>
      </div>

      <div className="mt-3 whitespace-pre-wrap rounded-md bg-white/70 px-3 py-2 text-sm leading-6">
        {message.text ?? "-"}
      </div>

      {shouldExplain ? (
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {outcomeHelp(
            t,
            outcome as Exclude<AdminSupportAssistantOutcome, "answered" | null>
          )}
        </div>
      ) : null}

      {isAssistant ? (
        <div className="mt-3 space-y-2">
          <AccountContextSnapshots message={message} locale={locale} />

          {message.sources.length > 0 ? (
            <details className="rounded-md border bg-muted/20 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {t("detail.sourcesSummary", { count: message.sources.length })}
              </summary>
              <div className="mt-3 space-y-2">
                {message.sources.map((source) => (
                  <div
                    key={`${message.id}-${source.chunkId}`}
                    className="rounded-md border bg-white p-3 text-xs"
                  >
                    <p className="font-medium">{source.documentId}</p>
                    <p className="mt-1 text-muted-foreground">
                      {source.sectionTitle ?? source.sectionId}
                    </p>
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      <MetaRow
                        label={t("detail.sourceType")}
                        value={source.sourceType}
                      />
                      <MetaRow
                        label={t("detail.sourceLocale")}
                        value={source.sourceLocale.toUpperCase()}
                      />
                      <MetaRow label={t("detail.score")} value={source.score} />
                      <MetaRow
                        label={t("detail.sectionId")}
                        value={source.sectionId}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function formatSnapshotDate(value: string | null, locale: AppLang) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function snapshotTitle(kind: string, t: ReturnType<typeof useTranslations>) {
  if (kind === "candidate_selection") return t("detail.orderCandidatesShown");
  if (kind === "selected_order") return t("detail.selectedOrderUsed");
  if (kind === "payment_overview") return t("detail.paymentOverviewExamples");
  return t("detail.accountHelperResult");
}

function AccountContextSnapshots({
  message,
  locale,
}: {
  message: AdminSupportMessageRow;
  locale: AppLang;
}) {
  const t = useTranslations("supportChatAdmin");
  const snapshots = message.accountContextSnapshots.filter(
    (snapshot) => snapshot.orders.length > 0
  );

  if (!snapshots.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {snapshots.map((snapshot, snapshotIndex) => (
        <details
          key={`${message.id}-account-context-${snapshotIndex}`}
          className="rounded-md border bg-blue-50/40 p-3"
          open={snapshot.orders.length <= 2}
        >
          <summary className="cursor-pointer text-sm font-medium">
            {snapshotTitle(snapshot.kind, t)}
          </summary>

          <div className="mt-3 space-y-2">
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <MetaRow label={t("detail.helper")} value={snapshot.helper} />
              <MetaRow
                label={t("detail.resultCategory")}
                value={snapshot.resultCategory}
              />
            </div>

            {snapshot.orders.map((order, orderIndex) => {
              const date =
                formatSnapshotDate(order.firstSlotStart, locale) ??
                formatSnapshotDate(order.createdAt, locale);
              const title =
                order.displayReference ??
                order.label ??
                order.providerDisplayName ??
                `${t("detail.order")} ${orderIndex + 1}`;
              const serviceLine = [
                order.providerDisplayName,
                ...(order.serviceNames ?? []),
                date,
              ]
                .filter(Boolean)
                .join(" - ");
              const statusLine = [
                order.serviceStatusCategory,
                order.paymentStatusCategory,
                order.invoiceStatusCategory,
              ]
                .filter(Boolean)
                .join(" - ");
              const nonOrderReference =
                order.referenceId && order.referenceType !== "order_id"
                  ? `${order.referenceType ?? "reference"}: ${order.referenceId}`
                  : null;

              return (
                <div
                  key={`${message.id}-account-context-${snapshotIndex}-${orderIndex}`}
                  className="rounded-md border bg-white p-3 text-xs"
                >
                  <p className="font-medium">{title}</p>
                  {order.description ? (
                    <p className="mt-1 text-muted-foreground">
                      {order.description}
                    </p>
                  ) : null}
                  {serviceLine ? <p className="mt-1">{serviceLine}</p> : null}
                  {statusLine ? (
                    <p className="mt-1 text-muted-foreground">{statusLine}</p>
                  ) : null}
                  {order.nextStepKey ? (
                    <p className="mt-1 text-muted-foreground">
                      {t("detail.nextStep")}: {order.nextStepKey}
                    </p>
                  ) : null}
                  {order.orderId ? (
                    <p className="mt-2 break-all text-[11px] text-muted-foreground">
                      {t("detail.internalOrderId")}: {order.orderId}
                    </p>
                  ) : null}
                  {nonOrderReference ? (
                    <p className="mt-2 break-all text-[11px] text-muted-foreground">
                      {t("detail.internalReference")}: {nonOrderReference}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </details>
      ))}
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

  const userName = userDisplayName(detail.thread.user);
  const latestAssistantMessage = [...detail.messages]
    .reverse()
    .find((message) => message.role === "assistant");

  return (
    <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-lg border bg-white">
      <div className="shrink-0 border-b p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">
              {userName ?? t("thread.anonymous")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.thread.user?.email ??
                detail.thread.user?.username ??
                t("thread.anonymousSubtitle")}
            </p>
          </div>
          <ReviewBadge state={detail.thread.reviewState} />
        </div>

        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
          <MetaRow
            label={t("table.locale")}
            value={detail.thread.locale.toUpperCase()}
          />
          <MetaRow label={t("detail.backendStatus")} value={detail.thread.status} />
          <MetaRow
            label={t("detail.lastActivity")}
            value={formatDate(detail.thread.lastMessageAt, locale)}
          />
          <MetaRow
            label={t("table.messageCount")}
            value={detail.thread.messageCount}
          />
        </div>

        {detail.thread.user ? (
          <div className="mt-4 rounded-md bg-muted/30 p-3 text-xs">
            <div className="grid gap-2 sm:grid-cols-2">
              <MetaRow label={t("detail.userId")} value={detail.thread.user.id} />
              <MetaRow
                label={t("detail.username")}
                value={detail.thread.user.username}
              />
              <MetaRow
                label={t("detail.userLanguage")}
                value={detail.thread.user.language?.toUpperCase() ?? null}
              />
              <MetaRow
                label={t("detail.userCountry")}
                value={detail.thread.user.country}
              />
              <MetaRow
                label={t("detail.userRoles")}
                value={detail.thread.user.roles.join(", ") || null}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {detail.messages.map((message) => (
          <ConversationMessage
            key={message.id}
            locale={locale}
            message={message}
          />
        ))}
      </div>

      <div className="shrink-0 border-t bg-muted/20 p-4">
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">
            {t("detail.threadDiagnostics")}
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <MetaRow label={t("table.threadId")} value={detail.thread.threadId} />
            <MetaRow
              label={t("table.retentionUntil")}
              value={formatDate(detail.thread.retentionUntil, locale)}
            />
            <MetaRow
              label={t("table.lastAssistantOutcome")}
              value={
                detail.thread.lastAssistantOutcome
                  ? detail.thread.lastAssistantOutcome ===
                    "unsupported_account_question"
                    ? t("outcome.accountBlocked")
                    : detail.thread.lastAssistantOutcome === "escalated"
                      ? t("outcome.escalated")
                      : detail.thread.lastAssistantOutcome === "uncertain"
                        ? t("outcome.uncertain")
                        : t("outcome.answered")
                  : null
              }
            />
            <MetaRow
              label={t("table.needsHumanSupport")}
              value={
                detail.thread.lastNeedsHumanSupport
                ? t("common.yes")
                  : t("common.no")
              }
            />
          </div>

          {latestAssistantMessage ? (
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 font-medium">
                {t("detail.latestAssistantMetadata")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <MetaRow
                  label={t("detail.responseOrigin")}
                  value={latestAssistantMessage.responseOrigin}
                />
                <MetaRow
                  label={t("detail.redactionApplied")}
                  value={
                    latestAssistantMessage.redactionApplied
                      ? t("common.yes")
                      : t("common.no")
                  }
                />
                <MetaRow
                  label={t("detail.model")}
                  value={latestAssistantMessage.model}
                />
                <MetaRow
                  label={t("detail.modelVersion")}
                  value={latestAssistantMessage.modelVersion}
                />
                <MetaRow
                  label={t("detail.promptVersion")}
                  value={latestAssistantMessage.promptVersion}
                />
                <MetaRow
                  label={t("detail.guardrailVersion")}
                  value={latestAssistantMessage.guardrailVersion}
                />
                <MetaRow
                  label={t("detail.retrievalVersion")}
                  value={latestAssistantMessage.retrievalVersion}
                />
                <MetaRow
                  label={t("detail.knowledgePackVersion")}
                  value={latestAssistantMessage.knowledgePackVersion}
                />
                <MetaRow
                  label={t("detail.openAIRequestId")}
                  value={latestAssistantMessage.openAIRequestId}
                />
              </div>

              {latestAssistantMessage.redactionTypes.length > 0 ? (
                <div className="mt-3">
                  <p className="font-medium">{t("detail.redactionTypes")}</p>
                  <p className="mt-1 text-muted-foreground">
                    {latestAssistantMessage.redactionTypes.join(", ")}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </details>
      </div>
    </div>
  );
}
