import type {
  AdminSupportAssistantOutcome,
  AdminSupportMessageRow,
  AdminSupportThreadRow,
} from "@/modules/support-chat/server/admin-procedures";

export type SupportThreadCsvDetail = {
  thread: AdminSupportThreadRow;
  messages: AdminSupportMessageRow[];
};

const CSV_HEADERS = [
  "thread_id",
  "thread_locale",
  "thread_review_state",
  "thread_backend_status",
  "user_email",
  "user_name",
  "message_index",
  "message_created_at",
  "message_role",
  "message_text",
  "assistant_outcome",
  "needs_human_support",
  "triage_intent",
  "triage_topic",
  "triage_status_filter",
  "triage_confidence",
  "triage_mapped_helper",
  "triage_eligibility_allowed",
  "grounding_kind",
  "account_context_summary",
  "sources_summary",
] as const;

function safeCsvText(value: unknown) {
  const text = value == null ? "" : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function csvCell(value: unknown) {
  const text = safeCsvText(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: readonly unknown[]) {
  return values.map(csvCell).join(",");
}

function userName(thread: AdminSupportThreadRow) {
  const user = thread.user;
  if (!user) return "";

  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.email ||
    ""
  );
}

function assistantOutcome(
  message: AdminSupportMessageRow,
): AdminSupportAssistantOutcome {
  if (message.role !== "assistant") return null;
  if (message.disposition === "escalate") return "escalated";
  return message.disposition ?? null;
}

function summarizeAccountContext(message: AdminSupportMessageRow) {
  const parts: string[] = [];

  for (const snapshot of message.accountContextSnapshots) {
    const orderParts = snapshot.orders.map((order) =>
      [
        order.displayReference,
        order.label,
        order.providerDisplayName,
        order.firstSlotStart,
        order.serviceStatusCategory,
        order.paymentStatusCategory,
        order.invoiceStatusCategory,
      ]
        .filter(Boolean)
        .join(" | "),
    );

    const snapshotParts = [
      snapshot.kind,
      snapshot.statusFilter ? `filter: ${snapshot.statusFilter}` : null,
      snapshot.helper ? `helper: ${snapshot.helper}` : null,
      snapshot.resultCategory ? `result: ${snapshot.resultCategory}` : null,
      !snapshot.orders.length ? "0 matching items" : null,
      orderParts.join(" || "),
    ].filter(Boolean);

    if (snapshotParts.length) parts.push(snapshotParts.join(": "));
  }

  return parts.join(" / ");
}

function summarizeSources(message: AdminSupportMessageRow) {
  return message.sources
    .map((source) => `${source.documentId}:${source.sectionId}`)
    .join("; ");
}

export function buildSupportThreadCsv(detail: SupportThreadCsvDetail) {
  const rows = [
    csvRow(CSV_HEADERS),
    ...detail.messages.map((message, index) =>
      csvRow([
        detail.thread.threadId,
        detail.thread.locale,
        detail.thread.reviewState,
        detail.thread.status,
        detail.thread.user?.email ?? "",
        userName(detail.thread),
        index + 1,
        message.createdAt,
        message.role,
        message.text ?? "",
        assistantOutcome(message) ?? "",
        message.role === "assistant" ? message.needsHumanSupport : "",
        message.triageIntent ?? "",
        message.triageTopic ?? "",
        message.triageStatusFilter ?? "",
        message.triageConfidence ?? "",
        message.triageMappedHelper ?? "",
        typeof message.triageEligibilityAllowed === "boolean"
          ? message.triageEligibilityAllowed
          : "",
        message.groundingKind ?? "",
        summarizeAccountContext(message),
        summarizeSources(message),
      ]),
    ),
  ];

  return `\uFEFF${rows.join("\r\n")}\r\n`;
}

function filenameDate(now: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join("");
}

export function supportThreadCsvFilename(
  detail: SupportThreadCsvDetail,
  now = new Date(),
) {
  const shortThreadId = detail.thread.threadId.slice(0, 8) || detail.thread.id;
  return `support-chat-${detail.thread.locale}-${shortThreadId}-${filenameDate(
    now,
  )}.csv`;
}

export function downloadSupportThreadCsv(detail: SupportThreadCsvDetail) {
  const csv = buildSupportThreadCsv(detail);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = supportThreadCsvFilename(detail);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
