import "server-only";

import type { AppLang } from "@/lib/i18n/app-lang";
import type { SupportAccountCancellationBlockReason } from "./types";

type AccountRole = "customer" | "tenant";
type ServiceStatusCopyKey =
  | "requested"
  | "scheduled"
  | "completed"
  | "accepted"
  | "disputed"
  | "canceled"
  | "unknown";

type InvoiceLifecycleCopyKey =
  | "issued"
  | "paid"
  | "void"
  | "requested"
  | "scheduled"
  | "completed"
  | "canceled"
  | "unknown";

type PaymentStatusCopyKey =
  | "paid"
  | "pending"
  | "notDueRequested"
  | "notDueScheduled"
  | "notDueCompleted"
  | "notDueCanceled"
  | "notDue"
  | "void"
  | "unknown";

type CountCopy = {
  paidOrders: (count: number) => string;
  paymentPending: (count: number) => string;
  paymentNotDue: (count: number) => string;
  paymentCanceled: (count: number) => string;
  refunded: (count: number) => string;
  unknown: (count: number) => string;
  inspectedOrders: (count: number) => string;
};

export type AccountAwareLocalizedCopy = {
  candidate: {
    fallbackLabel: string;
    none: string;
    one: string;
    many: string;
    filteredNone: (filter: string) => string;
    filteredOne: (filter: string) => string;
    filteredMany: (filter: string) => string;
  };
  fieldLabels: {
    provider: string;
    service: string;
    date: string;
    status: string;
    payment: string;
    reason: string;
    note: string;
    nextStep: string;
  };
  missingReference: {
    order: string;
    invoice: string;
  };
  statusLabels: Record<string, string>;
  statusFilterLabels: Record<string, string>;
  paymentSummary: {
    payment: (status: string) => string;
    invoice: (status: string) => string;
  };
  orderHeadline: Record<AccountRole, Record<ServiceStatusCopyKey, string>>;
  statusReason: Record<AccountRole, Record<string, string | undefined>>;
  nextStep: Record<AccountRole, Record<string, string | undefined>>;
  invoiceLifecycle: Record<AccountRole, Record<InvoiceLifecycleCopyKey, string>>;
  paymentStatus: Record<PaymentStatusCopyKey, string>;
  cancellation: {
    eligible: string;
    notEligible: string;
    blockReasons: Record<SupportAccountCancellationBlockReason, string>;
  };
  overview: {
    none: string;
    summary: (parts: string) => string;
    inspected: (countText: string) => string;
    counts: CountCopy;
  };
  actionTokenExpired: string;
  genericAccountItem: string;
};

const EN: AccountAwareLocalizedCopy = {
  candidate: {
    fallbackLabel: "Matching order",
    none: "I can help, but I could not find recent orders in the support-safe lookup. Please open your Orders page or contact support with the exact order ID.",
    one: "I found one recent order that may match. Please select it below if it is the order you mean.",
    many: "I found a few recent orders that may match. Which order do you mean?",
    filteredNone: (filter) =>
      `I could not find recent ${filter} bookings in the support-safe lookup. This is not a full history check. Please open your Orders page if you need the complete list.`,
    filteredOne: (filter) =>
      `I found one recent ${filter} booking that may match. Please select it below if it is the order you mean.`,
    filteredMany: (filter) =>
      `I found recent ${filter} bookings that may match. Which order do you mean?`,
  },
  fieldLabels: {
    provider: "Provider",
    service: "Service",
    date: "Date",
    status: "Status",
    payment: "Payment",
    reason: "Reason",
    note: "Provider/customer note",
    nextStep: "Next step",
  },
  missingReference: {
    order: "Please provide the exact order ID so I can check that safely.",
    invoice: "Please provide the exact invoice ID so I can check that safely.",
  },
  statusLabels: {
    requested: "requested",
    scheduled: "scheduled",
    completed: "completed",
    accepted: "accepted",
    disputed: "disputed",
    canceled: "canceled",
    paid: "paid",
    pending: "pending",
    not_due: "not due",
    canceled_payment: "payment canceled",
    none: "none",
    unknown: "unknown",
    issued: "issued",
    overdue: "overdue",
    void: "void",
    refunded: "refunded",
  },
  statusFilterLabels: {
    canceled: "canceled",
    requested: "requested",
    scheduled: "scheduled",
    completed_or_accepted: "completed or accepted",
    payment_not_due: "payment not due",
    payment_pending: "payment pending",
    paid: "paid",
  },
  paymentSummary: {
    payment: (status) => `payment ${status}`,
    invoice: (status) => `invoice ${status}`,
  },
  orderHeadline: {
    tenant: {
      requested: "This customer booking request is awaiting your confirmation.",
      scheduled: "This customer booking is scheduled.",
      completed:
        "This customer order is marked completed and is awaiting the next service-lifecycle step.",
      accepted: "This customer order has been accepted.",
      disputed: "This customer order is marked disputed.",
      canceled: "This customer order is canceled.",
      unknown:
        "I found the order, but its current service status is not available in a support-safe category.",
    },
    customer: {
      requested:
        "This order is awaiting provider confirmation. It is a booking request, not a scheduled booking yet.",
      scheduled: "This order is scheduled.",
      completed:
        "This order is marked completed and is awaiting the next service-lifecycle step.",
      accepted: "This order has been accepted.",
      disputed: "This order is marked disputed.",
      canceled: "This order is canceled.",
      unknown:
        "I found the order, but its current service status is not available in a support-safe category.",
    },
  },
  statusReason: {
    tenant: {
      customer_canceled: "The customer canceled this order.",
      provider_declined: "You declined this booking request.",
      provider_canceled: "The provider side canceled this order.",
      awaiting_provider_confirmation:
        "This booking request is waiting for your confirmation or decline.",
      provider_confirmed: "The provider side has confirmed this booking.",
      completed: "The provider side has marked the service completed.",
      accepted: "The customer accepted the service completion.",
      disputed: "The customer disputed the service completion.",
    },
    customer: {
      customer_canceled: "The order was canceled by the customer.",
      provider_declined: "The provider declined this booking request.",
      provider_canceled: "The provider canceled this order.",
      awaiting_provider_confirmation:
        "The provider has not confirmed or declined this booking request yet.",
      provider_confirmed: "The provider has confirmed this booking.",
      completed: "The provider has marked the service completed.",
      accepted: "The service completion has been accepted.",
      disputed: "The order is currently marked as disputed.",
    },
  },
  nextStep: {
    tenant: {
      await_provider_confirmation:
        "Confirm or decline the request from your dashboard.",
      pay_invoice: "Review the issued invoice from your dashboard.",
      view_orders: "Open your dashboard Orders view for the full order view.",
      no_action_needed: "No payment action is needed right now.",
    },
    customer: {
      await_provider_confirmation:
        "Wait for the provider to confirm or decline the request.",
      pay_invoice: "Open the invoice from your Orders page to pay.",
      view_orders: "Open your Orders page for the full order view.",
      no_action_needed: "No payment action is needed right now.",
    },
  },
  invoiceLifecycle: {
    tenant: {
      issued:
        "An invoice has already been issued for this customer booking. From the provider side, review the order or invoice in your dashboard for the current payment state.",
      paid: "This customer booking is already marked paid in the support-safe order status. Review the order in your dashboard if you need the full order view.",
      void: "The invoice for this customer booking is not currently payable. Review the order in your dashboard or contact support if the customer still needs help.",
      requested:
        "An invoice has not been issued yet for this customer booking because it is still awaiting your confirmation. Booking requests do not become payable immediately. From the provider side, confirm or decline the request in your dashboard; after the order later reaches the invoice/payment step, the invoice/payment status can change.",
      scheduled:
        "An invoice has not been issued yet for this customer booking because this scheduled order has not reached the invoice/payment step. From the provider side, review the order in your dashboard and check whether the service is ready for the next order step.",
      completed:
        "An invoice has not been issued yet for this customer booking even though the order is past the scheduled/requested stage. Review the order in your dashboard and contact support if the invoice/payment step appears stuck.",
      canceled:
        "An invoice has not been issued because this customer booking is canceled. A canceled order is not currently expected to move into the invoice/payment step.",
      unknown:
        "An invoice has not been issued yet for this customer booking because it has not reached a support-safe invoice/payment state. Review the order in your dashboard for the full order view.",
    },
    customer: {
      issued:
        "An invoice has already been issued for this order. Open your Orders page to review the invoice and current payment state.",
      paid: "This order is already marked paid in the support-safe order status. Open your Orders page if you need the full order view.",
      void: "The invoice for this order is not currently payable. Open your Orders page or contact support if you still need help.",
      requested:
        "An invoice has not been issued yet because this booking request is still awaiting provider confirmation. Booking requests do not become payable immediately. Once the provider confirms and the order later reaches the invoice/payment step, the invoice/payment status can change.",
      scheduled:
        "An invoice has not been issued yet for this scheduled booking because it has not reached the invoice/payment step. In this flow, payment may be requested later. Please watch your Orders page for invoice or payment updates.",
      completed:
        "An invoice has not been issued yet for this order even though it is past the scheduled/requested stage. Please check your Orders page and contact support if the invoice/payment step appears stuck.",
      canceled:
        "An invoice has not been issued because this order is canceled. A canceled order is not currently expected to move into the invoice/payment step.",
      unknown:
        "An invoice has not been issued yet because this order has not reached a support-safe invoice/payment state. Open your Orders page for the full order view.",
    },
  },
  paymentStatus: {
    paid: "This payment is marked paid.",
    pending:
      "A payment is pending for this order or invoice. You can open the invoice from your Orders page.",
    notDueRequested:
      "Payment is not due yet because this is still a booking request awaiting provider confirmation. Booking requests do not become payable immediately. Once the provider confirms and the order later reaches the invoice/payment step, the payment status can change.",
    notDueScheduled:
      "Payment is not due yet because no invoice has been issued for this scheduled booking. In this flow, payment is requested later through the invoice/payment step.",
    notDueCompleted:
      "Payment is not due yet because no invoice has been issued for this order. Please check your Orders page for invoice or payment status updates.",
    notDueCanceled:
      "Payment is not due because this order is canceled and no payable invoice is currently associated with it.",
    notDue:
      "Payment is not due for this order yet. No payable invoice is currently associated with it.",
    void: "This invoice is not currently payable.",
    unknown:
      "I found the payment record, but its current payment status is not available in a support-safe category.",
  },
  cancellation: {
    eligible:
      "This order currently appears eligible for in-app cancellation. Please use the cancellation option in your Orders page.",
    notEligible:
      "This order does not currently appear eligible for in-app cancellation. Please use your Orders page or contact support if you need help.",
    blockReasons: {
      already_canceled:
        "This order is already canceled, so it cannot be canceled again in the app.",
      order_paid:
        "This order is already marked paid, so in-app cancellation is currently blocked.",
      not_slot_order:
        "This order is not in the booking flow that supports in-app cancellation.",
      wrong_service_status:
        "This order is not currently in a booking status that supports in-app cancellation.",
      invoice_exists:
        "An invoice already exists for this order, so in-app cancellation is currently blocked.",
      missing_slots:
        "I cannot confirm the booking slots for this order from the support-safe data, so I cannot mark it eligible for in-app cancellation.",
      invalid_slot_dates:
        "The booking time for this order is not available in a support-safe form, so I cannot confirm cancellation eligibility.",
      cutoff_passed:
        "The cancellation window for this booking has already passed, so in-app cancellation is currently blocked.",
      slot_paid:
        "At least one booking slot is already marked paid, so in-app cancellation is currently blocked.",
      unknown:
        "I cannot identify the exact blocking reason from the support-safe data. Please check your Orders page for the available next steps.",
    },
  },
  overview: {
    none: "I could not find recent support-safe orders to summarize. This is not a full account or payment history check.",
    summary: (parts) =>
      `In the recent support-safe order window I checked, I found ${parts}.`,
    inspected: (countText) =>
      `I inspected ${countText}. This is not a full payment history.`,
    counts: {
      paidOrders: (count) => `${count} paid ${count === 1 ? "order" : "orders"}`,
      paymentPending: (count) => `${count} with payment pending`,
      paymentNotDue: (count) => `${count} where payment is not due yet`,
      paymentCanceled: (count) => `${count} with payment canceled`,
      refunded: (count) => `${count} refunded`,
      unknown: (count) => `${count} with an unknown payment status`,
      inspectedOrders: (count) =>
        `${count} recent support-safe ${count === 1 ? "order" : "orders"}`,
    },
  },
  actionTokenExpired:
    "That order selection expired. Please select the order again so I can check it safely.",
  genericAccountItem:
    "I found the account item, but I cannot safely summarize it yet.",
};

const DE: AccountAwareLocalizedCopy = {
  ...EN,
  candidate: {
    fallbackLabel: "Passende Buchung",
    none: "Ich kann helfen, aber ich habe keine aktuellen support-sicheren Buchungen gefunden, die passen. Öffnen Sie bitte Ihre Buchungs-/Bestellseite oder kontaktieren Sie den Support mit der genauen Buchungs- oder Bestell-ID.",
    one: "Ich habe eine aktuelle Buchung gefunden, die passen könnte. Wählen Sie sie bitte unten aus, wenn das die gemeinte Buchung ist.",
    many: "Ich habe einige aktuelle Buchungen gefunden, die passen könnten. Welche Buchung meinen Sie?",
    filteredNone: (filter) =>
      `Ich konnte keine aktuellen Buchungen mit Status ${filter} finden, die passen. Das ist keine vollständige Verlaufssuche. Öffnen Sie bitte Ihre Buchungs-/Bestellseite, wenn Sie die komplette Liste benötigen.`,
    filteredOne: (filter) =>
      `Ich habe eine aktuelle Buchung mit Status ${filter} gefunden, die passen könnte. Wählen Sie sie bitte unten aus, wenn das die gemeinte Buchung ist.`,
    filteredMany: (filter) =>
      `Ich habe aktuelle Buchungen mit Status ${filter} gefunden, die passen könnten. Welche Buchung meinen Sie?`,
  },
  fieldLabels: {
    provider: "Anbieter",
    service: "Leistung",
    date: "Datum",
    status: "Status",
    payment: "Zahlung",
    reason: "Grund",
    note: "Hinweis von Anbieter/Kunde",
    nextStep: "Nächster Schritt",
  },
  missingReference: {
    order: "Bitte geben Sie die genaue Buchungs- oder Bestell-ID an, damit ich sie sicher prüfen kann.",
    invoice: "Bitte geben Sie die genaue Rechnungs-ID an, damit ich sie sicher prüfen kann.",
  },
  statusLabels: {
    ...EN.statusLabels,
    requested: "angefragt",
    scheduled: "geplant",
    completed: "abgeschlossen",
    accepted: "akzeptiert",
    disputed: "strittig",
    canceled: "storniert",
    paid: "bezahlt",
    pending: "ausstehend",
    not_due: "noch nicht fällig",
    canceled_payment: "Zahlung storniert",
    none: "keine",
    unknown: "unbekannt",
    issued: "ausgestellt",
    overdue: "überfällig",
    void: "ungültig",
    refunded: "erstattet",
  },
  statusFilterLabels: {
    canceled: "storniert",
    requested: "angefragt",
    scheduled: "geplant",
    completed_or_accepted: "abgeschlossen oder akzeptiert",
    payment_not_due: "Zahlung noch nicht fällig",
    payment_pending: "Zahlung ausstehend",
    paid: "bezahlt",
  },
  paymentSummary: {
    payment: (status) => `Zahlung ${status}`,
    invoice: (status) => `Rechnung ${status}`,
  },
  orderHeadline: {
    tenant: {
      requested: "Diese Kundenbuchungsanfrage wartet auf Ihre Bestätigung.",
      scheduled: "Diese Kundenbuchung ist geplant.",
      completed:
        "Diese Kundenbuchung ist als abgeschlossen markiert und wartet auf den nächsten Service-Schritt.",
      accepted: "Diese Kundenbuchung wurde akzeptiert.",
      disputed: "Diese Kundenbuchung ist als strittig markiert.",
      canceled: "Diese Kundenbuchung ist storniert.",
      unknown:
        "Ich habe die Buchung gefunden, aber der aktuelle Servicestatus ist nicht in einer support-sicheren Kategorie verfügbar.",
    },
    customer: {
      requested:
        "Diese Buchung wartet auf die Bestätigung des Anbieters. Es ist eine Buchungsanfrage, noch keine geplante Buchung.",
      scheduled: "Diese Buchung ist geplant.",
      completed:
        "Diese Buchung ist als abgeschlossen markiert und wartet auf den nächsten Service-Schritt.",
      accepted: "Diese Buchung wurde akzeptiert.",
      disputed: "Diese Buchung ist als strittig markiert.",
      canceled: "Diese Buchung ist storniert.",
      unknown:
        "Ich habe die Buchung gefunden, aber der aktuelle Servicestatus ist nicht in einer support-sicheren Kategorie verfügbar.",
    },
  },
  statusReason: {
    tenant: {
      customer_canceled: "Der Kunde hat diese Buchung storniert.",
      provider_declined: "Sie haben diese Buchungsanfrage abgelehnt.",
      provider_canceled: "Die Anbieterseite hat diese Buchung storniert.",
      awaiting_provider_confirmation:
        "Diese Buchungsanfrage wartet auf Ihre Bestätigung oder Ablehnung.",
      provider_confirmed: "Die Anbieterseite hat diese Buchung bestätigt.",
      completed: "Die Anbieterseite hat die Leistung als abgeschlossen markiert.",
      accepted: "Der Kunde hat den Abschluss der Leistung akzeptiert.",
      disputed: "Der Kunde hat den Abschluss der Leistung beanstandet.",
    },
    customer: {
      customer_canceled: "Die Buchung wurde vom Kunden storniert.",
      provider_declined: "Der Anbieter hat diese Buchungsanfrage abgelehnt.",
      provider_canceled: "Der Anbieter hat diese Buchung storniert.",
      awaiting_provider_confirmation:
        "Der Anbieter hat diese Buchungsanfrage noch nicht bestätigt oder abgelehnt.",
      provider_confirmed: "Der Anbieter hat diese Buchung bestätigt.",
      completed: "Der Anbieter hat die Leistung als abgeschlossen markiert.",
      accepted: "Der Abschluss der Leistung wurde akzeptiert.",
      disputed: "Die Buchung ist derzeit als strittig markiert.",
    },
  },
  nextStep: {
    tenant: {
      await_provider_confirmation:
        "Bestätigen Sie die Anfrage in Ihrem Dashboard oder lehnen Sie sie dort ab.",
      pay_invoice: "Prüfen Sie die ausgestellte Rechnung in Ihrem Dashboard.",
      view_orders:
        "Öffnen Sie die Buchungs-/Bestellansicht in Ihrem Dashboard für die vollständige Ansicht.",
      no_action_needed: "Derzeit ist keine Zahlungsaktion nötig.",
    },
    customer: {
      await_provider_confirmation:
        "Warten Sie, bis der Anbieter die Anfrage bestätigt oder ablehnt.",
      pay_invoice: "Öffnen Sie die Rechnung auf Ihrer Buchungs-/Bestellseite, um zu zahlen.",
      view_orders: "Öffnen Sie Ihre Buchungs-/Bestellseite für die vollständige Ansicht.",
      no_action_needed: "Derzeit ist keine Zahlungsaktion nötig.",
    },
  },
  invoiceLifecycle: {
    tenant: {
      issued:
        "Für diese Kundenbuchung wurde bereits eine Rechnung ausgestellt. Prüfen Sie als Anbieter die Buchung oder Rechnung in Ihrem Dashboard, um den aktuellen Zahlungsstand zu sehen.",
      paid: "Diese Kundenbuchung ist im support-sicheren Buchungsstatus bereits als bezahlt markiert. Prüfen Sie die Buchung in Ihrem Dashboard, wenn Sie die vollständige Ansicht benötigen.",
      void: "Die Rechnung für diese Kundenbuchung ist derzeit nicht zahlbar. Prüfen Sie die Buchung in Ihrem Dashboard oder kontaktieren Sie den Support, wenn der Kunde weiterhin Hilfe benötigt.",
      requested:
        "Für diese Kundenbuchung wurde noch keine Rechnung ausgestellt, weil sie noch auf Ihre Bestätigung wartet. Buchungsanfragen werden nicht sofort zahlbar. Bestätigen Sie die Anfrage in Ihrem Dashboard oder lehnen Sie sie dort ab; später kann sich der Rechnungs-/Zahlungsstatus ändern.",
      scheduled:
        "Für diese Kundenbuchung wurde noch keine Rechnung ausgestellt, weil diese geplante Buchung den Rechnungs-/Zahlungsschritt noch nicht erreicht hat. Prüfen Sie als Anbieter die Buchung in Ihrem Dashboard und ob die Leistung bereit für den nächsten Schritt ist.",
      completed:
        "Für diese Kundenbuchung wurde noch keine Rechnung ausgestellt, obwohl die Buchung über Anfrage/Planung hinaus ist. Prüfen Sie die Buchung in Ihrem Dashboard und kontaktieren Sie den Support, wenn der Rechnungs-/Zahlungsschritt festhängt.",
      canceled:
        "Es wurde keine Rechnung ausgestellt, weil diese Kundenbuchung storniert ist. Eine stornierte Buchung soll derzeit nicht in den Rechnungs-/Zahlungsschritt wechseln.",
      unknown:
        "Für diese Kundenbuchung wurde noch keine Rechnung ausgestellt, weil sie keinen support-sicheren Rechnungs-/Zahlungsstatus erreicht hat. Prüfen Sie die vollständige Buchung in Ihrem Dashboard.",
    },
    customer: {
      issued:
        "Für diese Buchung wurde bereits eine Rechnung ausgestellt. Öffnen Sie Ihre Buchungs-/Bestellseite, um Rechnung und Zahlungsstand zu prüfen.",
      paid: "Diese Buchung ist im support-sicheren Buchungsstatus bereits als bezahlt markiert. Öffnen Sie Ihre Buchungs-/Bestellseite, wenn Sie die vollständige Ansicht benötigen.",
      void: "Die Rechnung für diese Buchung ist derzeit nicht zahlbar. Öffnen Sie Ihre Buchungs-/Bestellseite oder kontaktieren Sie den Support, wenn Sie Hilfe benötigen.",
      requested:
        "Für diese Buchung wurde noch keine Rechnung ausgestellt, weil diese Buchungsanfrage noch auf die Bestätigung des Anbieters wartet. Buchungsanfragen werden nicht sofort zahlbar. Nach der Bestätigung und dem späteren Rechnungs-/Zahlungsschritt kann sich der Status ändern.",
      scheduled:
        "Für diese geplante Buchung wurde noch keine Rechnung ausgestellt, weil sie den Rechnungs-/Zahlungsschritt noch nicht erreicht hat. In diesem Ablauf kann die Zahlung später angefordert werden. Beobachten Sie Ihre Buchungs-/Bestellseite für Updates.",
      completed:
        "Für diese Buchung wurde noch keine Rechnung ausgestellt, obwohl sie über Anfrage/Planung hinaus ist. Prüfen Sie Ihre Buchungs-/Bestellseite und kontaktieren Sie den Support, wenn der Rechnungs-/Zahlungsschritt festhängt.",
      canceled:
        "Es wurde keine Rechnung ausgestellt, weil diese Buchung storniert ist. Eine stornierte Buchung soll derzeit nicht in den Rechnungs-/Zahlungsschritt wechseln.",
      unknown:
        "Für diese Buchung wurde noch keine Rechnung ausgestellt, weil sie keinen support-sicheren Rechnungs-/Zahlungsstatus erreicht hat. Öffnen Sie Ihre Buchungs-/Bestellseite für die vollständige Ansicht.",
    },
  },
  paymentStatus: {
    paid: "Diese Zahlung ist als bezahlt markiert.",
    pending:
      "Für diese Buchung oder Rechnung ist eine Zahlung ausstehend. Sie können die Rechnung über Ihre Buchungs-/Bestellseite öffnen.",
    notDueRequested:
      "Die Zahlung ist noch nicht fällig, weil dies noch eine Buchungsanfrage ist, die auf die Bestätigung des Anbieters wartet. Buchungsanfragen werden nicht sofort zahlbar. Nach der Bestätigung und dem späteren Rechnungs-/Zahlungsschritt kann sich der Zahlungsstatus ändern.",
    notDueScheduled:
      "Die Zahlung ist noch nicht fällig, weil für diese geplante Buchung noch keine Rechnung ausgestellt wurde. In diesem Ablauf wird die Zahlung später über den Rechnungs-/Zahlungsschritt angefordert.",
    notDueCompleted:
      "Die Zahlung ist noch nicht fällig, weil für diese Buchung noch keine Rechnung ausgestellt wurde. Prüfen Sie Ihre Buchungs-/Bestellseite für Rechnungs- oder Zahlungsupdates.",
    notDueCanceled:
      "Die Zahlung ist nicht fällig, weil diese Buchung storniert ist und derzeit keine zahlbare Rechnung damit verbunden ist.",
    notDue:
      "Die Zahlung ist für diese Buchung noch nicht fällig. Derzeit ist keine zahlbare Rechnung damit verbunden.",
    void: "Diese Rechnung ist derzeit nicht zahlbar.",
    unknown:
      "Ich habe den Zahlungsdatensatz gefunden, aber der aktuelle Zahlungsstatus ist nicht in einer support-sicheren Kategorie verfügbar.",
  },
  cancellation: {
    eligible:
      "Diese Buchung scheint derzeit für eine In-App-Stornierung berechtigt zu sein. Bitte nutzen Sie die Stornierungsoption auf Ihrer Buchungs-/Bestellseite.",
    notEligible:
      "Diese Buchung scheint derzeit nicht für eine In-App-Stornierung berechtigt zu sein. Nutzen Sie bitte Ihre Buchungs-/Bestellseite oder kontaktieren Sie den Support, wenn Sie Hilfe benötigen.",
    blockReasons: {
      already_canceled:
        "Diese Buchung ist bereits storniert und kann deshalb nicht erneut in der App storniert werden.",
      order_paid:
        "Diese Buchung ist bereits als bezahlt markiert. Deshalb ist die In-App-Stornierung derzeit blockiert.",
      not_slot_order:
        "Diese Buchung gehört nicht zu dem Buchungsablauf, der eine In-App-Stornierung unterstützt.",
      wrong_service_status:
        "Diese Buchung ist derzeit nicht in einem Buchungsstatus, der eine In-App-Stornierung unterstützt.",
      invoice_exists:
        "Für diese Buchung existiert bereits eine Rechnung. Deshalb ist die In-App-Stornierung derzeit blockiert.",
      missing_slots:
        "Ich kann die Buchungszeiten dieser Buchung aus den support-sicheren Daten nicht bestätigen und sie deshalb nicht als stornierbar einstufen.",
      invalid_slot_dates:
        "Die Buchungszeit dieser Buchung ist nicht in einer support-sicheren Form verfügbar. Deshalb kann ich die Stornierbarkeit nicht sicher bestätigen.",
      cutoff_passed:
        "Das Stornierungsfenster für diese Buchung ist bereits abgelaufen. Deshalb ist die In-App-Stornierung derzeit blockiert.",
      slot_paid:
        "Mindestens ein Buchungszeitraum ist bereits als bezahlt markiert. Deshalb ist die In-App-Stornierung derzeit blockiert.",
      unknown:
        "Ich kann den genauen Blockierungsgrund aus den support-sicheren Daten nicht sicher erkennen. Prüfen Sie bitte Ihre Buchungs-/Bestellseite für die verfügbaren nächsten Schritte.",
    },
  },
  overview: {
    none: "Ich konnte keine aktuellen support-sicheren Buchungen zum Zusammenfassen finden. Das ist keine vollständige Konto- oder Zahlungshistorie.",
    summary: (parts) =>
      `In den aktuellen Buchungen, die ich sicher prüfen kann, habe ich gefunden: ${parts}.`,
    inspected: (countText) =>
      `Ich habe ${countText} geprüft. Das ist keine vollständige Zahlungshistorie.`,
    counts: {
      paidOrders: (count) => `${count} bezahlte Buchung${count === 1 ? "" : "en"}`,
      paymentPending: (count) => `${count} mit ausstehender Zahlung`,
      paymentNotDue: (count) => `${count}, bei denen die Zahlung noch nicht fällig ist`,
      paymentCanceled: (count) => `${count} mit stornierter Zahlung`,
      refunded: (count) => `${count} erstattet`,
      unknown: (count) => `${count} mit unbekanntem Zahlungsstatus`,
      inspectedOrders: (count) =>
        `${count} aktuelle support-sichere Buchung${count === 1 ? "" : "en"}`,
    },
  },
  actionTokenExpired:
    "Diese Buchungsauswahl ist abgelaufen. Wählen Sie die Buchung bitte erneut aus, damit ich sie sicher prüfen kann.",
  genericAccountItem:
    "Ich habe das Kontoelement gefunden, kann es aber noch nicht sicher zusammenfassen.",
};

const FR: AccountAwareLocalizedCopy = {
  ...EN,
  candidate: {
    fallbackLabel: "Commande possible",
    none: "Je peux aider, mais je n'ai trouvé aucune commande récente pouvant être affichée en toute sécurité. Ouvrez votre page Commandes ou contactez l'assistance avec l'ID exact de la commande.",
    one: "J'ai trouvé une commande récente qui peut correspondre. Sélectionnez-la ci-dessous si c'est la commande concernée.",
    many: "J'ai trouvé quelques commandes récentes qui peuvent correspondre. Laquelle voulez-vous dire ?",
    filteredNone: (filter) =>
      `Je n'ai trouvé aucune réservation récente correspondant au statut ${filter}. Ceci n'est pas une vérification complète de l'historique. Ouvrez votre page Commandes si vous avez besoin de la liste complète.`,
    filteredOne: (filter) =>
      `J'ai trouvé une réservation récente avec le statut ${filter} qui peut correspondre. Sélectionnez-la ci-dessous si c'est la commande concernée.`,
    filteredMany: (filter) =>
      `J'ai trouvé des réservations récentes avec le statut ${filter} qui peuvent correspondre. Laquelle voulez-vous dire ?`,
  },
  fieldLabels: {
    provider: "Prestataire",
    service: "Service",
    date: "Date",
    status: "Statut",
    payment: "Paiement",
    reason: "Raison",
    note: "Note prestataire/client",
    nextStep: "Étape suivante",
  },
  missingReference: {
    order: "Veuillez fournir l'ID exact de la commande afin que je puisse la vérifier en sécurité.",
    invoice: "Veuillez fournir l'ID exact de la facture afin que je puisse la vérifier en sécurité.",
  },
  statusLabels: {
    ...DE.statusLabels,
    requested: "demandée",
    scheduled: "planifiée",
    completed: "terminée",
    accepted: "acceptée",
    disputed: "contestée",
    canceled: "annulée",
    paid: "payé",
    pending: "en attente",
    not_due: "non dû",
    canceled_payment: "paiement annulé",
    none: "aucune",
    unknown: "inconnu",
    issued: "émise",
    overdue: "en retard",
    void: "annulée",
    refunded: "remboursé",
  },
  statusFilterLabels: {
    canceled: "annulée",
    requested: "demandée",
    scheduled: "planifiée",
    completed_or_accepted: "terminée ou acceptée",
    payment_not_due: "paiement non dû",
    payment_pending: "paiement en attente",
    paid: "payée",
  },
  paymentSummary: {
    payment: (status) => `paiement ${status}`,
    invoice: (status) => `facture ${status}`,
  },
  orderHeadline: {
    tenant: {
      requested: "Cette demande de réservation client attend votre confirmation.",
      scheduled: "Cette réservation client est planifiée.",
      completed:
        "Cette commande client est marquée comme terminée et attend la prochaine étape du cycle de service.",
      accepted: "Cette commande client a été acceptée.",
      disputed: "Cette commande client est marquée comme contestée.",
      canceled: "Cette commande client est annulée.",
      unknown:
        "J'ai trouvé la commande, mais son statut de service actuel n'est pas disponible dans une catégorie sûre pour l'assistance.",
    },
    customer: {
      requested:
        "Cette commande attend la confirmation du prestataire. C'est une demande de réservation, pas encore une réservation planifiée.",
      scheduled: "Cette commande est planifiée.",
      completed:
        "Cette commande est marquée comme terminée et attend la prochaine étape du cycle de service.",
      accepted: "Cette commande a été acceptée.",
      disputed: "Cette commande est marquée comme contestée.",
      canceled: "Cette commande est annulée.",
      unknown:
        "J'ai trouvé la commande, mais son statut de service actuel n'est pas disponible dans une catégorie sûre pour l'assistance.",
    },
  },
  statusReason: {
    tenant: {
      customer_canceled: "Le client a annulé cette commande.",
      provider_declined: "Vous avez refusé cette demande de réservation.",
      provider_canceled: "Le côté prestataire a annulé cette commande.",
      awaiting_provider_confirmation:
        "Cette demande de réservation attend votre confirmation ou votre refus.",
      provider_confirmed: "Le côté prestataire a confirmé cette réservation.",
      completed: "Le côté prestataire a marqué le service comme terminé.",
      accepted: "Le client a accepté l'achèvement du service.",
      disputed: "Le client a contesté l'achèvement du service.",
    },
    customer: {
      customer_canceled: "La commande a été annulée par le client.",
      provider_declined: "Le prestataire a refusé cette demande de réservation.",
      provider_canceled: "Le prestataire a annulé cette commande.",
      awaiting_provider_confirmation:
        "Le prestataire n'a pas encore confirmé ou refusé cette demande de réservation.",
      provider_confirmed: "Le prestataire a confirmé cette réservation.",
      completed: "Le prestataire a marqué le service comme terminé.",
      accepted: "L'achèvement du service a été accepté.",
      disputed: "La commande est actuellement marquée comme contestée.",
    },
  },
  nextStep: {
    tenant: {
      await_provider_confirmation:
        "Confirmez ou refusez la demande depuis votre tableau de bord.",
      pay_invoice: "Consultez la facture émise depuis votre tableau de bord.",
      view_orders:
        "Ouvrez la vue Commandes de votre tableau de bord pour voir la commande complète.",
      no_action_needed: "Aucune action de paiement n'est nécessaire pour le moment.",
    },
    customer: {
      await_provider_confirmation:
        "Attendez que le prestataire confirme ou refuse la demande.",
      pay_invoice: "Ouvrez la facture depuis votre page Commandes pour payer.",
      view_orders: "Ouvrez votre page Commandes pour voir la commande complète.",
      no_action_needed: "Aucune action de paiement n'est nécessaire pour le moment.",
    },
  },
  invoiceLifecycle: {
    tenant: {
      issued:
        "Une facture a déjà été émise pour cette réservation client. Côté prestataire, consultez la commande ou la facture dans votre tableau de bord pour voir l'état actuel du paiement.",
      paid: "Cette réservation client est déjà marquée comme payée dans le statut de commande sûr pour l'assistance. Consultez la commande dans votre tableau de bord si vous avez besoin de la vue complète.",
      void: "La facture de cette réservation client n'est pas payable actuellement. Consultez la commande dans votre tableau de bord ou contactez l'assistance si le client a encore besoin d'aide.",
      requested:
        "Aucune facture n'a encore été émise pour cette réservation client, car elle attend encore votre confirmation. Les demandes de réservation ne deviennent pas payables immédiatement. Côté prestataire, confirmez ou refusez la demande dans votre tableau de bord ; le statut facture/paiement pourra changer plus tard.",
      scheduled:
        "Aucune facture n'a encore été émise pour cette réservation client, car cette commande planifiée n'a pas encore atteint l'étape facture/paiement. Côté prestataire, consultez la commande dans votre tableau de bord et vérifiez si le service est prêt pour l'étape suivante.",
      completed:
        "Aucune facture n'a encore été émise pour cette réservation client, même si la commande a dépassé l'étape demande/planification. Consultez la commande dans votre tableau de bord et contactez l'assistance si l'étape facture/paiement semble bloquée.",
      canceled:
        "Aucune facture n'a été émise parce que cette réservation client est annulée. Une commande annulée ne devrait pas passer actuellement à l'étape facture/paiement.",
      unknown:
        "Aucune facture n'a encore été émise pour cette réservation client, car elle n'a pas atteint un état facture/paiement sûr pour l'assistance. Consultez la commande complète dans votre tableau de bord.",
    },
    customer: {
      issued:
        "Une facture a déjà été émise pour cette commande. Ouvrez votre page Commandes pour consulter la facture et l'état actuel du paiement.",
      paid: "Cette commande est déjà marquée comme payée dans le statut de commande sûr pour l'assistance. Ouvrez votre page Commandes si vous avez besoin de la vue complète.",
      void: "La facture de cette commande n'est pas payable actuellement. Ouvrez votre page Commandes ou contactez l'assistance si vous avez encore besoin d'aide.",
      requested:
        "Aucune facture n'a encore été émise parce que cette demande de réservation attend encore la confirmation du prestataire. Les demandes de réservation ne deviennent pas payables immédiatement. Une fois confirmée et arrivée plus tard à l'étape facture/paiement, le statut pourra changer.",
      scheduled:
        "Aucune facture n'a encore été émise pour cette réservation planifiée parce qu'elle n'a pas encore atteint l'étape facture/paiement. Dans ce flux, le paiement peut être demandé plus tard. Surveillez votre page Commandes pour les mises à jour de facture ou de paiement.",
      completed:
        "Aucune facture n'a encore été émise pour cette commande, même si elle a dépassé l'étape demande/planification. Vérifiez votre page Commandes et contactez l'assistance si l'étape facture/paiement semble bloquée.",
      canceled:
        "Aucune facture n'a été émise parce que cette commande est annulée. Une commande annulée ne devrait pas passer actuellement à l'étape facture/paiement.",
      unknown:
        "Aucune facture n'a encore été émise parce que cette commande n'a pas atteint un état facture/paiement sûr pour l'assistance. Ouvrez votre page Commandes pour la vue complète.",
    },
  },
  paymentStatus: {
    paid: "Ce paiement est marqué comme payé.",
    pending:
      "Un paiement est en attente pour cette commande ou cette facture. Vous pouvez ouvrir la facture depuis votre page Commandes.",
    notDueRequested:
      "Le paiement n'est pas encore dû parce qu'il s'agit toujours d'une demande de réservation en attente de confirmation du prestataire. Les demandes de réservation ne deviennent pas payables immédiatement. Une fois confirmée et arrivée plus tard à l'étape facture/paiement, le statut du paiement pourra changer.",
    notDueScheduled:
      "Le paiement n'est pas encore dû parce qu'aucune facture n'a été émise pour cette réservation planifiée. Dans ce flux, le paiement est demandé plus tard via l'étape facture/paiement.",
    notDueCompleted:
      "Le paiement n'est pas encore dû parce qu'aucune facture n'a été émise pour cette commande. Consultez votre page Commandes pour les mises à jour de facture ou de paiement.",
    notDueCanceled:
      "Le paiement n'est pas dû parce que cette commande est annulée et qu'aucune facture payable n'y est actuellement associée.",
    notDue:
      "Le paiement n'est pas encore dû pour cette commande. Aucune facture payable n'y est actuellement associée.",
    void: "Cette facture n'est pas payable actuellement.",
    unknown:
      "J'ai trouvé l'enregistrement de paiement, mais son statut actuel n'est pas disponible dans une catégorie sûre pour l'assistance.",
  },
  cancellation: {
    eligible:
      "Cette commande semble actuellement éligible à une annulation dans l'application. Utilisez l'option d'annulation sur votre page Commandes.",
    notEligible:
      "Cette commande ne semble pas actuellement éligible à une annulation dans l'application. Utilisez votre page Commandes ou contactez l'assistance si vous avez besoin d'aide.",
    blockReasons: {
      already_canceled:
        "Cette commande est déjà annulée, elle ne peut donc pas être annulée à nouveau dans l'application.",
      order_paid:
        "Cette commande est déjà marquée comme payée. L'annulation dans l'application est donc actuellement bloquée.",
      not_slot_order:
        "Cette commande ne fait pas partie du flux de réservation qui prend en charge l'annulation dans l'application.",
      wrong_service_status:
        "Cette commande n'est pas actuellement dans un statut de réservation qui prend en charge l'annulation dans l'application.",
      invoice_exists:
        "Une facture existe déjà pour cette commande. L'annulation dans l'application est donc actuellement bloquée.",
      missing_slots:
        "Je ne peux pas confirmer les créneaux de réservation de cette commande à partir des données sûres pour l'assistance, donc je ne peux pas la marquer comme annulable.",
      invalid_slot_dates:
        "L'heure de réservation de cette commande n'est pas disponible dans un format sûr pour l'assistance, donc je ne peux pas confirmer l'éligibilité à l'annulation.",
      cutoff_passed:
        "La fenêtre d'annulation de cette réservation est déjà dépassée. L'annulation dans l'application est donc actuellement bloquée.",
      slot_paid:
        "Au moins un créneau de réservation est déjà marqué comme payé. L'annulation dans l'application est donc actuellement bloquée.",
      unknown:
        "Je ne peux pas identifier le motif exact du blocage à partir des données sûres pour l'assistance. Veuillez vérifier votre page Commandes pour les prochaines étapes disponibles.",
    },
  },
  overview: {
    none: "Je n'ai trouvé aucune commande récente sûre à résumer. Ceci n'est pas une vérification complète du compte ou de l'historique des paiements.",
    summary: (parts) =>
      `Parmi les commandes récentes que je peux vérifier en sécurité, j'ai trouvé ${parts}.`,
    inspected: (countText) =>
      `J'ai vérifié ${countText}. Ce n'est pas un historique complet des paiements.`,
    counts: {
      paidOrders: (count) => `${count} commande${count === 1 ? "" : "s"} payée${count === 1 ? "" : "s"}`,
      paymentPending: (count) => `${count} avec paiement en attente`,
      paymentNotDue: (count) => `${count} où le paiement n'est pas encore dû`,
      paymentCanceled: (count) => `${count} avec paiement annulé`,
      refunded: (count) => `${count} remboursé${count === 1 ? "" : "s"}`,
      unknown: (count) => `${count} avec un statut de paiement inconnu`,
      inspectedOrders: (count) =>
        `${count} commande${count === 1 ? "" : "s"} récente${count === 1 ? "" : "s"} sûre${count === 1 ? "" : "s"} pour l'assistance`,
    },
  },
  genericAccountItem:
    "J'ai trouvé l'élément du compte, mais je ne peux pas encore le résumer en toute sécurité.",
  actionTokenExpired:
    "Cette sélection de commande a expiré. Sélectionnez à nouveau la commande pour que je puisse la vérifier en toute sécurité.",
};

function withRomanceCopy(overrides: Partial<AccountAwareLocalizedCopy>): AccountAwareLocalizedCopy {
  return {
    ...FR,
    ...overrides,
    candidate: { ...FR.candidate, ...overrides.candidate },
    fieldLabels: { ...FR.fieldLabels, ...overrides.fieldLabels },
    missingReference: { ...FR.missingReference, ...overrides.missingReference },
    statusLabels: { ...FR.statusLabels, ...overrides.statusLabels },
    statusFilterLabels: { ...FR.statusFilterLabels, ...overrides.statusFilterLabels },
    paymentSummary: { ...FR.paymentSummary, ...overrides.paymentSummary },
    orderHeadline: {
      customer: { ...FR.orderHeadline.customer, ...overrides.orderHeadline?.customer },
      tenant: { ...FR.orderHeadline.tenant, ...overrides.orderHeadline?.tenant },
    },
    statusReason: {
      customer: { ...FR.statusReason.customer, ...overrides.statusReason?.customer },
      tenant: { ...FR.statusReason.tenant, ...overrides.statusReason?.tenant },
    },
    nextStep: {
      customer: { ...FR.nextStep.customer, ...overrides.nextStep?.customer },
      tenant: { ...FR.nextStep.tenant, ...overrides.nextStep?.tenant },
    },
    invoiceLifecycle: {
      customer: { ...FR.invoiceLifecycle.customer, ...overrides.invoiceLifecycle?.customer },
      tenant: { ...FR.invoiceLifecycle.tenant, ...overrides.invoiceLifecycle?.tenant },
    },
    paymentStatus: { ...FR.paymentStatus, ...overrides.paymentStatus },
    cancellation: {
      ...FR.cancellation,
      ...overrides.cancellation,
      blockReasons: {
        ...FR.cancellation.blockReasons,
        ...overrides.cancellation?.blockReasons,
      },
    },
    overview: { ...FR.overview, ...overrides.overview },
  };
}

const IT = withRomanceCopy({
  actionTokenExpired:
    "Questa selezione dell'ordine è scaduta. Seleziona di nuovo l'ordine così posso verificarlo in modo sicuro.",
  candidate: {
    fallbackLabel: "Ordine possibile",
    none: "Posso aiutarti, ma non ho trovato ordini recenti sicuri da mostrare. Apri la pagina Ordini o contatta l'assistenza con l'ID esatto dell'ordine.",
    one: "Ho trovato un ordine recente che può corrispondere. Selezionalo qui sotto se è l'ordine corretto.",
    many: "Ho trovato alcuni ordini recenti che possono corrispondere. Quale ordine intendi?",
    filteredNone: (filter) =>
      `Non ho trovato prenotazioni recenti che possono corrispondere con stato ${filter}. Non è una verifica completa della cronologia. Apri la pagina Ordini se ti serve l'elenco completo.`,
    filteredOne: (filter) =>
      `Ho trovato una prenotazione recente che può corrispondere con stato ${filter}. Selezionala qui sotto se è l'ordine corretto.`,
    filteredMany: (filter) =>
      `Ho trovato prenotazioni recenti che possono corrispondere con stato ${filter}. Quale ordine intendi?`,
  },
  fieldLabels: {
    provider: "Fornitore",
    service: "Servizio",
    date: "Data",
    status: "Stato",
    payment: "Pagamento",
    reason: "Motivo",
    note: "Nota fornitore/cliente",
    nextStep: "Passaggio successivo",
  },
  missingReference: {
    order: "Fornisci l'ID esatto dell'ordine così posso verificarlo in modo sicuro.",
    invoice: "Fornisci l'ID esatto della fattura così posso verificarla in modo sicuro.",
  },
  statusLabels: {
    requested: "richiesta",
    scheduled: "programmata",
    completed: "completata",
    accepted: "accettata",
    disputed: "contestata",
    canceled: "annullata",
    paid: "pagato",
    pending: "in sospeso",
    not_due: "non ancora dovuto",
    canceled_payment: "pagamento annullato",
    none: "nessuna",
    unknown: "sconosciuto",
    issued: "emessa",
    overdue: "scaduta",
    void: "annullata",
    refunded: "rimborsato",
  },
  statusFilterLabels: {
    canceled: "annullata",
    requested: "richiesta",
    scheduled: "programmata",
    completed_or_accepted: "completata o accettata",
    payment_not_due: "pagamento non ancora dovuto",
    payment_pending: "pagamento in sospeso",
    paid: "pagata",
  },
  paymentSummary: {
    payment: (status) => `pagamento ${status}`,
    invoice: (status) => `fattura ${status}`,
  },
  orderHeadline: {
    tenant: {
      requested: "Questa richiesta di prenotazione del cliente attende la tua conferma.",
      scheduled: "Questa prenotazione del cliente è programmata.",
      completed: "Questo ordine del cliente è segnato come completato e attende il prossimo passaggio del ciclo del servizio.",
      accepted: "Questo ordine del cliente è stato accettato.",
      disputed: "Questo ordine del cliente è segnato come contestato.",
      canceled: "Questo ordine del cliente è annullato.",
      unknown: "Ho trovato l'ordine, ma lo stato del servizio non è disponibile in una categoria sicura per l'assistenza.",
    },
    customer: {
      requested: "Questo ordine attende la conferma del fornitore. È una richiesta di prenotazione, non ancora una prenotazione programmata.",
      scheduled: "Questo ordine è programmato.",
      completed: "Questo ordine è segnato come completato e attende il prossimo passaggio del ciclo del servizio.",
      accepted: "Questo ordine è stato accettato.",
      disputed: "Questo ordine è segnato come contestato.",
      canceled: "Questo ordine è annullato.",
      unknown: "Ho trovato l'ordine, ma lo stato del servizio non è disponibile in una categoria sicura per l'assistenza.",
    },
  },
  statusReason: {
    tenant: {
      customer_canceled: "Il cliente ha annullato questo ordine.",
      provider_declined: "Hai rifiutato questa richiesta di prenotazione.",
      provider_canceled: "Il lato fornitore ha annullato questo ordine.",
      awaiting_provider_confirmation: "Questa richiesta di prenotazione attende la tua conferma o il tuo rifiuto.",
      provider_confirmed: "Il lato fornitore ha confermato questa prenotazione.",
      completed: "Il lato fornitore ha segnato il servizio come completato.",
      accepted: "Il cliente ha accettato il completamento del servizio.",
      disputed: "Il cliente ha contestato il completamento del servizio.",
    },
    customer: {
      customer_canceled: "L'ordine è stato annullato dal cliente.",
      provider_declined: "Il fornitore ha rifiutato questa richiesta di prenotazione.",
      provider_canceled: "Il fornitore ha annullato questo ordine.",
      awaiting_provider_confirmation: "Il fornitore non ha ancora confermato o rifiutato questa richiesta di prenotazione.",
      provider_confirmed: "Il fornitore ha confermato questa prenotazione.",
      completed: "Il fornitore ha segnato il servizio come completato.",
      accepted: "Il completamento del servizio è stato accettato.",
      disputed: "L'ordine è attualmente segnato come contestato.",
    },
  },
  nextStep: {
    tenant: {
      await_provider_confirmation: "Conferma o rifiuta la richiesta dalla dashboard.",
      pay_invoice: "Controlla la fattura emessa dalla dashboard.",
      view_orders: "Apri la vista Ordini nella dashboard per vedere l'ordine completo.",
      no_action_needed: "Non è necessaria alcuna azione di pagamento adesso.",
    },
    customer: {
      await_provider_confirmation: "Attendi che il fornitore confermi o rifiuti la richiesta.",
      pay_invoice: "Apri la fattura dalla pagina Ordini per pagare.",
      view_orders: "Apri la pagina Ordini per vedere l'ordine completo.",
      no_action_needed: "Non è necessaria alcuna azione di pagamento adesso.",
    },
  },
  invoiceLifecycle: {
    tenant: {
      issued: "Una fattura è già stata emessa per questa prenotazione del cliente. Dal lato fornitore, controlla l'ordine o la fattura nella dashboard per lo stato attuale del pagamento.",
      paid: "Questa prenotazione del cliente è già segnata come pagata nello stato sicuro dell'ordine. Controlla l'ordine nella dashboard se ti serve la vista completa.",
      void: "La fattura per questa prenotazione del cliente non è attualmente pagabile. Controlla l'ordine nella dashboard o contatta l'assistenza se il cliente ha ancora bisogno di aiuto.",
      requested: "Non è ancora stata emessa una fattura per questa prenotazione del cliente perché attende ancora la tua conferma. Le richieste di prenotazione non diventano pagabili subito. Dal lato fornitore, conferma o rifiuta la richiesta nella dashboard; più avanti lo stato fattura/pagamento può cambiare.",
      scheduled: "Non è ancora stata emessa una fattura per questa prenotazione del cliente perché questo ordine programmato non ha ancora raggiunto il passaggio fattura/pagamento. Dal lato fornitore, controlla l'ordine nella dashboard e verifica se il servizio è pronto per il passaggio successivo.",
      completed: "Non è ancora stata emessa una fattura per questa prenotazione del cliente anche se l'ordine ha superato la fase di richiesta/programmazione. Controlla l'ordine nella dashboard e contatta l'assistenza se il passaggio fattura/pagamento sembra bloccato.",
      canceled: "Non è stata emessa una fattura perché questa prenotazione del cliente è annullata. Un ordine annullato non dovrebbe passare al passaggio fattura/pagamento.",
      unknown: "Non è ancora stata emessa una fattura per questa prenotazione del cliente perché non ha raggiunto uno stato fattura/pagamento sicuro per l'assistenza. Controlla l'ordine completo nella dashboard.",
    },
    customer: {
      issued: "Una fattura è già stata emessa per questo ordine. Apri la pagina Ordini per controllare la fattura e lo stato attuale del pagamento.",
      paid: "Questo ordine è già segnato come pagato nello stato sicuro dell'ordine. Apri la pagina Ordini se ti serve la vista completa.",
      void: "La fattura per questo ordine non è attualmente pagabile. Apri la pagina Ordini o contatta l'assistenza se hai ancora bisogno di aiuto.",
      requested: "Non è ancora stata emessa una fattura perché questa richiesta di prenotazione attende ancora la conferma del fornitore. Le richieste di prenotazione non diventano pagabili subito. Dopo la conferma e il successivo passaggio fattura/pagamento, lo stato può cambiare.",
      scheduled: "Non è ancora stata emessa una fattura per questa prenotazione programmata perché non ha ancora raggiunto il passaggio fattura/pagamento. In questo flusso il pagamento può essere richiesto più avanti. Controlla la pagina Ordini per aggiornamenti.",
      completed: "Non è ancora stata emessa una fattura per questo ordine anche se ha superato la fase di richiesta/programmazione. Controlla la pagina Ordini e contatta l'assistenza se il passaggio fattura/pagamento sembra bloccato.",
      canceled: "Non è stata emessa una fattura perché questo ordine è annullato. Un ordine annullato non dovrebbe passare al passaggio fattura/pagamento.",
      unknown: "Non è ancora stata emessa una fattura perché questo ordine non ha raggiunto uno stato fattura/pagamento sicuro per l'assistenza. Apri la pagina Ordini per la vista completa.",
    },
  },
  paymentStatus: {
    paid: "Questo pagamento è segnato come pagato.",
    pending: "Un pagamento è in sospeso per questo ordine o questa fattura. Puoi aprire la fattura dalla pagina Ordini.",
    notDueRequested: "Il pagamento non è ancora dovuto perché questa è ancora una richiesta di prenotazione in attesa della conferma del fornitore. Le richieste di prenotazione non diventano pagabili subito. Dopo la conferma e il successivo passaggio fattura/pagamento, lo stato può cambiare.",
    notDueScheduled: "Il pagamento non è ancora dovuto perché non è stata emessa una fattura per questa prenotazione programmata. In questo flusso il pagamento viene richiesto più avanti tramite il passaggio fattura/pagamento.",
    notDueCompleted: "Il pagamento non è ancora dovuto perché non è stata emessa una fattura per questo ordine. Controlla la pagina Ordini per aggiornamenti su fattura o pagamento.",
    notDueCanceled: "Il pagamento non è dovuto perché questo ordine è annullato e non c'è una fattura pagabile associata.",
    notDue: "Il pagamento non è ancora dovuto per questo ordine. Non c'è una fattura pagabile associata.",
    void: "Questa fattura non è attualmente pagabile.",
    unknown: "Ho trovato il record di pagamento, ma lo stato attuale non è disponibile in una categoria sicura per l'assistenza.",
  },
  cancellation: {
    eligible: "Questo ordine sembra attualmente idoneo all'annullamento in-app. Usa l'opzione di annullamento nella pagina Ordini.",
    notEligible: "Questo ordine non sembra attualmente idoneo all'annullamento in-app. Usa la pagina Ordini o contatta l'assistenza se hai bisogno di aiuto.",
    blockReasons: {
      already_canceled:
        "Questo ordine è già annullato, quindi non può essere annullato di nuovo nell'app.",
      order_paid:
        "Questo ordine è già contrassegnato come pagato, quindi l'annullamento in-app è attualmente bloccato.",
      not_slot_order:
        "Questo ordine non appartiene al flusso di prenotazione che supporta l'annullamento in-app.",
      wrong_service_status:
        "Questo ordine non è attualmente in uno stato di prenotazione che supporta l'annullamento in-app.",
      invoice_exists:
        "Esiste già una fattura per questo ordine, quindi l'annullamento in-app è attualmente bloccato.",
      missing_slots:
        "Non posso confermare gli slot di prenotazione di questo ordine dai dati sicuri per l'assistenza, quindi non posso indicarlo come annullabile.",
      invalid_slot_dates:
        "L'orario di prenotazione di questo ordine non è disponibile in forma sicura per l'assistenza, quindi non posso confermare l'idoneità all'annullamento.",
      cutoff_passed:
        "La finestra di annullamento per questa prenotazione è già scaduta, quindi l'annullamento in-app è attualmente bloccato.",
      slot_paid:
        "Almeno uno slot di prenotazione è già contrassegnato come pagato, quindi l'annullamento in-app è attualmente bloccato.",
      unknown:
        "Non posso identificare il motivo esatto del blocco dai dati sicuri per l'assistenza. Controlla la pagina Ordini per i prossimi passaggi disponibili.",
    },
  },
  overview: {
    none: "Non ho trovato ordini recenti sicuri da riassumere. Questa non è una verifica completa dell'account o della cronologia pagamenti.",
    summary: (parts) => `Tra gli ordini recenti che posso verificare in sicurezza, ho trovato ${parts}.`,
    inspected: (countText) => `Ho verificato ${countText}. Questa non è una cronologia completa dei pagamenti.`,
    counts: {
      paidOrders: (count) => `${count} ordin${count === 1 ? "e pagato" : "i pagati"}`,
      paymentPending: (count) => `${count} con pagamento in sospeso`,
      paymentNotDue: (count) => `${count} in cui il pagamento non è ancora dovuto`,
      paymentCanceled: (count) => `${count} con pagamento annullato`,
      refunded: (count) => `${count} rimborsat${count === 1 ? "o" : "i"}`,
      unknown: (count) => `${count} con stato di pagamento sconosciuto`,
      inspectedOrders: (count) => `${count} ordin${count === 1 ? "e recente sicuro" : "i recenti sicuri"} per l'assistenza`,
    },
  },
  genericAccountItem:
    "Ho trovato l'elemento dell'account, ma non posso ancora riassumerlo in modo sicuro.",
});

const ES = withRomanceCopy({
  actionTokenExpired:
    "Esta selección de pedido ha caducado. Selecciona de nuevo el pedido para que pueda revisarlo de forma segura.",
  candidate: {
    fallbackLabel: "Pedido posible",
    none: "Puedo ayudar, pero no encontré pedidos recientes que pueda mostrar de forma segura. Abre tu página de Pedidos o contacta con soporte con el ID exacto del pedido.",
    one: "Encontré un pedido reciente que puede coincidir. Selecciónalo abajo si es el pedido correcto.",
    many: "Encontré algunos pedidos recientes que pueden coincidir. ¿Qué pedido quieres decir?",
    filteredNone: (filter) =>
      `No encontré reservas recientes que coincidan con el estado ${filter}. Esto no es una revisión completa del historial. Abre tu página de Pedidos si necesitas la lista completa.`,
    filteredOne: (filter) =>
      `Encontré una reserva reciente con estado ${filter} que puede coincidir. Selecciónala abajo si es el pedido correcto.`,
    filteredMany: (filter) =>
      `Encontré reservas recientes con estado ${filter} que pueden coincidir. ¿Qué pedido quieres decir?`,
  },
  fieldLabels: {
    provider: "Proveedor",
    service: "Servicio",
    date: "Fecha",
    status: "Estado",
    payment: "Pago",
    reason: "Motivo",
    note: "Nota proveedor/cliente",
    nextStep: "Siguiente paso",
  },
  missingReference: {
    order: "Indica el ID exacto del pedido para que pueda revisarlo de forma segura.",
    invoice: "Indica el ID exacto de la factura para que pueda revisarla de forma segura.",
  },
  statusLabels: {
    requested: "solicitada",
    scheduled: "programada",
    completed: "completada",
    accepted: "aceptada",
    disputed: "disputada",
    canceled: "cancelada",
    paid: "pagado",
    pending: "pendiente",
    not_due: "no vencido",
    canceled_payment: "pago cancelado",
    none: "ninguna",
    unknown: "desconocido",
    issued: "emitida",
    overdue: "vencida",
    void: "anulada",
    refunded: "reembolsado",
  },
  statusFilterLabels: {
    canceled: "cancelada",
    requested: "solicitada",
    scheduled: "programada",
    completed_or_accepted: "completada o aceptada",
    payment_not_due: "pago no vencido",
    payment_pending: "pago pendiente",
    paid: "pagada",
  },
  paymentSummary: {
    payment: (status) => `pago ${status}`,
    invoice: (status) => `factura ${status}`,
  },
  orderHeadline: {
    tenant: {
      requested: "Esta solicitud de reserva del cliente espera tu confirmación.",
      scheduled: "Esta reserva del cliente está programada.",
      completed: "Este pedido del cliente está marcado como completado y espera el siguiente paso del ciclo del servicio.",
      accepted: "Este pedido del cliente ha sido aceptado.",
      disputed: "Este pedido del cliente está marcado como disputado.",
      canceled: "Este pedido del cliente está cancelado.",
      unknown: "Encontré el pedido, pero su estado de servicio actual no está disponible en una categoría segura para soporte.",
    },
    customer: {
      requested: "Este pedido espera la confirmación del proveedor. Es una solicitud de reserva, no una reserva programada todavía.",
      scheduled: "Este pedido está programado.",
      completed: "Este pedido está marcado como completado y espera el siguiente paso del ciclo del servicio.",
      accepted: "Este pedido ha sido aceptado.",
      disputed: "Este pedido está marcado como disputado.",
      canceled: "Este pedido está cancelado.",
      unknown: "Encontré el pedido, pero su estado de servicio actual no está disponible en una categoría segura para soporte.",
    },
  },
  statusReason: {
    tenant: {
      customer_canceled: "El cliente canceló este pedido.",
      provider_declined: "Rechazaste esta solicitud de reserva.",
      provider_canceled: "El lado del proveedor canceló este pedido.",
      awaiting_provider_confirmation: "Esta solicitud de reserva espera tu confirmación o rechazo.",
      provider_confirmed: "El lado del proveedor confirmó esta reserva.",
      completed: "El lado del proveedor marcó el servicio como completado.",
      accepted: "El cliente aceptó la finalización del servicio.",
      disputed: "El cliente disputó la finalización del servicio.",
    },
    customer: {
      customer_canceled: "El pedido fue cancelado por el cliente.",
      provider_declined: "El proveedor rechazó esta solicitud de reserva.",
      provider_canceled: "El proveedor canceló este pedido.",
      awaiting_provider_confirmation: "El proveedor aún no ha confirmado ni rechazado esta solicitud de reserva.",
      provider_confirmed: "El proveedor confirmó esta reserva.",
      completed: "El proveedor marcó el servicio como completado.",
      accepted: "La finalización del servicio fue aceptada.",
      disputed: "El pedido está actualmente marcado como disputado.",
    },
  },
  nextStep: {
    tenant: {
      await_provider_confirmation: "Confirma o rechaza la solicitud desde tu panel.",
      pay_invoice: "Revisa la factura emitida desde tu panel.",
      view_orders: "Abre la vista Pedidos de tu panel para ver el pedido completo.",
      no_action_needed: "No se necesita ninguna acción de pago ahora.",
    },
    customer: {
      await_provider_confirmation: "Espera a que el proveedor confirme o rechace la solicitud.",
      pay_invoice: "Abre la factura desde tu página de Pedidos para pagar.",
      view_orders: "Abre tu página de Pedidos para ver el pedido completo.",
      no_action_needed: "No se necesita ninguna acción de pago ahora.",
    },
  },
  invoiceLifecycle: {
    tenant: {
      issued: "Ya se emitió una factura para esta reserva del cliente. Desde el lado del proveedor, revisa el pedido o la factura en tu panel para ver el estado de pago actual.",
      paid: "Esta reserva del cliente ya está marcada como pagada en el estado seguro del pedido. Revisa el pedido en tu panel si necesitas la vista completa.",
      void: "La factura de esta reserva del cliente no se puede pagar actualmente. Revisa el pedido en tu panel o contacta con soporte si el cliente aún necesita ayuda.",
      requested: "Aún no se ha emitido una factura para esta reserva del cliente porque todavía espera tu confirmación. Las solicitudes de reserva no se vuelven pagables inmediatamente. Desde el lado del proveedor, confirma o rechaza la solicitud en tu panel; más adelante el estado de factura/pago puede cambiar.",
      scheduled: "Aún no se ha emitido una factura para esta reserva del cliente porque este pedido programado no ha llegado al paso de factura/pago. Desde el lado del proveedor, revisa el pedido en tu panel y comprueba si el servicio está listo para el siguiente paso.",
      completed: "Aún no se ha emitido una factura para esta reserva del cliente aunque el pedido ya pasó la fase de solicitud/programación. Revisa el pedido en tu panel y contacta con soporte si el paso de factura/pago parece bloqueado.",
      canceled: "No se ha emitido una factura porque esta reserva del cliente está cancelada. Un pedido cancelado no debería pasar al paso de factura/pago.",
      unknown: "Aún no se ha emitido una factura para esta reserva del cliente porque no ha alcanzado un estado de factura/pago seguro para soporte. Revisa el pedido completo en tu panel.",
    },
    customer: {
      issued: "Ya se emitió una factura para este pedido. Abre tu página de Pedidos para revisar la factura y el estado de pago actual.",
      paid: "Este pedido ya está marcado como pagado en el estado seguro del pedido. Abre tu página de Pedidos si necesitas la vista completa.",
      void: "La factura de este pedido no se puede pagar actualmente. Abre tu página de Pedidos o contacta con soporte si aún necesitas ayuda.",
      requested: "Aún no se ha emitido una factura porque esta solicitud de reserva todavía espera la confirmación del proveedor. Las solicitudes de reserva no se vuelven pagables inmediatamente. Cuando se confirme y llegue más adelante al paso de factura/pago, el estado puede cambiar.",
      scheduled: "Aún no se ha emitido una factura para esta reserva programada porque no ha llegado al paso de factura/pago. En este flujo, el pago puede solicitarse más adelante. Revisa tu página de Pedidos para actualizaciones.",
      completed: "Aún no se ha emitido una factura para este pedido aunque ya pasó la fase de solicitud/programación. Revisa tu página de Pedidos y contacta con soporte si el paso de factura/pago parece bloqueado.",
      canceled: "No se ha emitido una factura porque este pedido está cancelado. Un pedido cancelado no debería pasar al paso de factura/pago.",
      unknown: "Aún no se ha emitido una factura porque este pedido no ha alcanzado un estado de factura/pago seguro para soporte. Abre tu página de Pedidos para la vista completa.",
    },
  },
  paymentStatus: {
    paid: "Este pago está marcado como pagado.",
    pending: "Hay un pago pendiente para este pedido o factura. Puedes abrir la factura desde tu página de Pedidos.",
    notDueRequested: "El pago aún no vence porque esto sigue siendo una solicitud de reserva que espera la confirmación del proveedor. Las solicitudes de reserva no se vuelven pagables inmediatamente. Cuando se confirme y llegue más adelante al paso de factura/pago, el estado de pago puede cambiar.",
    notDueScheduled: "El pago aún no vence porque no se ha emitido una factura para esta reserva programada. En este flujo, el pago se solicita más adelante mediante el paso de factura/pago.",
    notDueCompleted: "El pago aún no vence porque no se ha emitido una factura para este pedido. Revisa tu página de Pedidos para actualizaciones de factura o pago.",
    notDueCanceled: "El pago no vence porque este pedido está cancelado y no tiene una factura pagable asociada actualmente.",
    notDue: "El pago aún no vence para este pedido. No hay una factura pagable asociada actualmente.",
    void: "Esta factura no se puede pagar actualmente.",
    unknown: "Encontré el registro de pago, pero su estado actual no está disponible en una categoría segura para soporte.",
  },
  cancellation: {
    eligible: "Este pedido parece estar disponible para cancelación dentro de la app. Usa la opción de cancelación en tu página de Pedidos.",
    notEligible: "Este pedido no parece estar disponible para cancelación dentro de la app. Usa tu página de Pedidos o contacta con soporte si necesitas ayuda.",
    blockReasons: {
      already_canceled:
        "Este pedido ya está cancelado, así que no se puede cancelar de nuevo dentro de la app.",
      order_paid:
        "Este pedido ya está marcado como pagado, así que la cancelación dentro de la app está bloqueada actualmente.",
      not_slot_order:
        "Este pedido no pertenece al flujo de reservas que admite cancelación dentro de la app.",
      wrong_service_status:
        "Este pedido no está actualmente en un estado de reserva que admita cancelación dentro de la app.",
      invoice_exists:
        "Ya existe una factura para este pedido, así que la cancelación dentro de la app está bloqueada actualmente.",
      missing_slots:
        "No puedo confirmar los horarios de reserva de este pedido con los datos seguros para soporte, así que no puedo marcarlo como cancelable.",
      invalid_slot_dates:
        "La hora de reserva de este pedido no está disponible en un formato seguro para soporte, así que no puedo confirmar si se puede cancelar.",
      cutoff_passed:
        "La ventana de cancelación de esta reserva ya ha pasado, así que la cancelación dentro de la app está bloqueada actualmente.",
      slot_paid:
        "Al menos un horario de reserva ya está marcado como pagado, así que la cancelación dentro de la app está bloqueada actualmente.",
      unknown:
        "No puedo identificar el motivo exacto del bloqueo con los datos seguros para soporte. Revisa tu página de Pedidos para ver los siguientes pasos disponibles.",
    },
  },
  overview: {
    none: "No encontré pedidos recientes seguros para resumir. Esto no es una revisión completa de la cuenta ni del historial de pagos.",
    summary: (parts) => `Entre los pedidos recientes que puedo revisar de forma segura, encontré ${parts}.`,
    inspected: (countText) => `Revisé ${countText}. Esto no es un historial completo de pagos.`,
    counts: {
      paidOrders: (count) => `${count} pedido${count === 1 ? "" : "s"} pagado${count === 1 ? "" : "s"}`,
      paymentPending: (count) => `${count} con pago pendiente`,
      paymentNotDue: (count) => `${count} donde el pago aún no vence`,
      paymentCanceled: (count) => `${count} con pago cancelado`,
      refunded: (count) => `${count} reembolsado${count === 1 ? "" : "s"}`,
      unknown: (count) => `${count} con estado de pago desconocido`,
      inspectedOrders: (count) => `${count} pedido${count === 1 ? "" : "s"} reciente${count === 1 ? "" : "s"} seguro${count === 1 ? "" : "s"} para soporte`,
    },
  },
  genericAccountItem:
    "Encontré el elemento de la cuenta, pero todavía no puedo resumirlo de forma segura.",
});

const PT = withRomanceCopy({
  actionTokenExpired:
    "Esta seleção de pedido expirou. Selecione novamente o pedido para que eu possa verificá-lo com segurança.",
  candidate: {
    fallbackLabel: "Pedido possível",
    none: "Posso ajudar, mas não encontrei pedidos recentes que possa mostrar com segurança. Abra a página Pedidos ou contacte o suporte com o ID exato do pedido.",
    one: "Encontrei um pedido recente que pode corresponder. Selecione-o abaixo se for o pedido correto.",
    many: "Encontrei alguns pedidos recentes que podem corresponder. Qual pedido quer dizer?",
    filteredNone: (filter) =>
      `Não encontrei reservas recentes que correspondam ao estado ${filter}. Isto não é uma verificação completa do histórico. Abra a página Pedidos se precisar da lista completa.`,
    filteredOne: (filter) =>
      `Encontrei uma reserva recente com estado ${filter} que pode corresponder. Selecione-a abaixo se for o pedido correto.`,
    filteredMany: (filter) =>
      `Encontrei reservas recentes com estado ${filter} que podem corresponder. Qual pedido quer dizer?`,
  },
  fieldLabels: {
    provider: "Prestador",
    service: "Serviço",
    date: "Data",
    status: "Estado",
    payment: "Pagamento",
    reason: "Motivo",
    note: "Nota prestador/cliente",
    nextStep: "Próximo passo",
  },
  missingReference: {
    order: "Indique o ID exato do pedido para que eu possa verificá-lo com segurança.",
    invoice: "Indique o ID exato da fatura para que eu possa verificá-la com segurança.",
  },
  statusLabels: {
    requested: "solicitada",
    scheduled: "agendada",
    completed: "concluída",
    accepted: "aceite",
    disputed: "contestada",
    canceled: "cancelada",
    paid: "pago",
    pending: "pendente",
    not_due: "ainda não devido",
    canceled_payment: "pagamento cancelado",
    none: "nenhuma",
    unknown: "desconhecido",
    issued: "emitida",
    overdue: "vencida",
    void: "anulada",
    refunded: "reembolsado",
  },
  statusFilterLabels: {
    canceled: "cancelada",
    requested: "solicitada",
    scheduled: "agendada",
    completed_or_accepted: "concluída ou aceite",
    payment_not_due: "pagamento ainda não devido",
    payment_pending: "pagamento pendente",
    paid: "paga",
  },
  paymentSummary: {
    payment: (status) => `pagamento ${status}`,
    invoice: (status) => `fatura ${status}`,
  },
  orderHeadline: {
    tenant: {
      requested: "Este pedido de reserva do cliente aguarda a sua confirmação.",
      scheduled: "Esta reserva do cliente está agendada.",
      completed: "Este pedido do cliente está marcado como concluído e aguarda o próximo passo do ciclo do serviço.",
      accepted: "Este pedido do cliente foi aceite.",
      disputed: "Este pedido do cliente está marcado como contestado.",
      canceled: "Este pedido do cliente está cancelado.",
      unknown: "Encontrei o pedido, mas o estado atual do serviço não está disponível numa categoria segura para suporte.",
    },
    customer: {
      requested: "Este pedido aguarda a confirmação do prestador. É um pedido de reserva, ainda não uma reserva agendada.",
      scheduled: "Este pedido está agendado.",
      completed: "Este pedido está marcado como concluído e aguarda o próximo passo do ciclo do serviço.",
      accepted: "Este pedido foi aceite.",
      disputed: "Este pedido está marcado como contestado.",
      canceled: "Este pedido está cancelado.",
      unknown: "Encontrei o pedido, mas o estado atual do serviço não está disponível numa categoria segura para suporte.",
    },
  },
  statusReason: {
    tenant: {
      customer_canceled: "O cliente cancelou este pedido.",
      provider_declined: "Recusou este pedido de reserva.",
      provider_canceled: "O lado do prestador cancelou este pedido.",
      awaiting_provider_confirmation: "Este pedido de reserva aguarda a sua confirmação ou recusa.",
      provider_confirmed: "O lado do prestador confirmou esta reserva.",
      completed: "O lado do prestador marcou o serviço como concluído.",
      accepted: "O cliente aceitou a conclusão do serviço.",
      disputed: "O cliente contestou a conclusão do serviço.",
    },
    customer: {
      customer_canceled: "O pedido foi cancelado pelo cliente.",
      provider_declined: "O prestador recusou este pedido de reserva.",
      provider_canceled: "O prestador cancelou este pedido.",
      awaiting_provider_confirmation: "O prestador ainda não confirmou nem recusou este pedido de reserva.",
      provider_confirmed: "O prestador confirmou esta reserva.",
      completed: "O prestador marcou o serviço como concluído.",
      accepted: "A conclusão do serviço foi aceite.",
      disputed: "O pedido está atualmente marcado como contestado.",
    },
  },
  nextStep: {
    tenant: {
      await_provider_confirmation: "Confirme ou recuse o pedido no seu painel.",
      pay_invoice: "Reveja a fatura emitida no seu painel.",
      view_orders: "Abra a vista Pedidos no seu painel para ver o pedido completo.",
      no_action_needed: "Não é necessária nenhuma ação de pagamento agora.",
    },
    customer: {
      await_provider_confirmation: "Aguarde até o prestador confirmar ou recusar o pedido.",
      pay_invoice: "Abra a fatura na sua página Pedidos para pagar.",
      view_orders: "Abra a sua página Pedidos para ver o pedido completo.",
      no_action_needed: "Não é necessária nenhuma ação de pagamento agora.",
    },
  },
  invoiceLifecycle: {
    tenant: {
      issued: "Já foi emitida uma fatura para esta reserva do cliente. Do lado do prestador, reveja o pedido ou a fatura no painel para ver o estado atual do pagamento.",
      paid: "Esta reserva do cliente já está marcada como paga no estado seguro do pedido. Reveja o pedido no painel se precisar da vista completa.",
      void: "A fatura desta reserva do cliente não está atualmente pagável. Reveja o pedido no painel ou contacte o suporte se o cliente ainda precisar de ajuda.",
      requested: "Ainda não foi emitida uma fatura para esta reserva do cliente porque ainda aguarda a sua confirmação. Os pedidos de reserva não ficam pagáveis imediatamente. Do lado do prestador, confirme ou recuse o pedido no painel; mais tarde o estado da fatura/pagamento pode mudar.",
      scheduled: "Ainda não foi emitida uma fatura para esta reserva do cliente porque este pedido agendado ainda não chegou ao passo de fatura/pagamento. Do lado do prestador, reveja o pedido no painel e verifique se o serviço está pronto para o próximo passo.",
      completed: "Ainda não foi emitida uma fatura para esta reserva do cliente, embora o pedido já tenha passado da fase de pedido/agendamento. Reveja o pedido no painel e contacte o suporte se o passo de fatura/pagamento parecer bloqueado.",
      canceled: "Não foi emitida uma fatura porque esta reserva do cliente está cancelada. Um pedido cancelado não deve passar para o passo de fatura/pagamento.",
      unknown: "Ainda não foi emitida uma fatura para esta reserva do cliente porque ela não atingiu um estado de fatura/pagamento seguro para suporte. Reveja o pedido completo no painel.",
    },
    customer: {
      issued: "Já foi emitida uma fatura para este pedido. Abra a sua página Pedidos para rever a fatura e o estado atual do pagamento.",
      paid: "Este pedido já está marcado como pago no estado seguro do pedido. Abra a página Pedidos se precisar da vista completa.",
      void: "A fatura deste pedido não está atualmente pagável. Abra a página Pedidos ou contacte o suporte se ainda precisar de ajuda.",
      requested: "Ainda não foi emitida uma fatura porque este pedido de reserva ainda aguarda a confirmação do prestador. Os pedidos de reserva não ficam pagáveis imediatamente. Depois da confirmação e do passo posterior de fatura/pagamento, o estado pode mudar.",
      scheduled: "Ainda não foi emitida uma fatura para esta reserva agendada porque ela ainda não chegou ao passo de fatura/pagamento. Neste fluxo, o pagamento pode ser pedido mais tarde. Consulte a página Pedidos para atualizações.",
      completed: "Ainda não foi emitida uma fatura para este pedido, embora ele já tenha passado da fase de pedido/agendamento. Consulte a página Pedidos e contacte o suporte se o passo de fatura/pagamento parecer bloqueado.",
      canceled: "Não foi emitida uma fatura porque este pedido está cancelado. Um pedido cancelado não deve passar para o passo de fatura/pagamento.",
      unknown: "Ainda não foi emitida uma fatura porque este pedido não atingiu um estado de fatura/pagamento seguro para suporte. Abra a página Pedidos para a vista completa.",
    },
  },
  paymentStatus: {
    paid: "Este pagamento está marcado como pago.",
    pending: "Há um pagamento pendente para este pedido ou fatura. Pode abrir a fatura na página Pedidos.",
    notDueRequested: "O pagamento ainda não é devido porque isto ainda é um pedido de reserva a aguardar confirmação do prestador. Os pedidos de reserva não ficam pagáveis imediatamente. Depois da confirmação e do passo posterior de fatura/pagamento, o estado do pagamento pode mudar.",
    notDueScheduled: "O pagamento ainda não é devido porque não foi emitida uma fatura para esta reserva agendada. Neste fluxo, o pagamento é pedido mais tarde através do passo de fatura/pagamento.",
    notDueCompleted: "O pagamento ainda não é devido porque não foi emitida uma fatura para este pedido. Consulte a página Pedidos para atualizações de fatura ou pagamento.",
    notDueCanceled: "O pagamento não é devido porque este pedido está cancelado e não há uma fatura pagável associada.",
    notDue: "O pagamento ainda não é devido para este pedido. Não há uma fatura pagável associada.",
    void: "Esta fatura não está atualmente pagável.",
    unknown: "Encontrei o registo de pagamento, mas o estado atual não está disponível numa categoria segura para suporte.",
  },
  cancellation: {
    eligible: "Este pedido parece atualmente elegível para cancelamento na aplicação. Use a opção de cancelamento na página Pedidos.",
    notEligible: "Este pedido não parece atualmente elegível para cancelamento na aplicação. Use a página Pedidos ou contacte o suporte se precisar de ajuda.",
    blockReasons: {
      already_canceled:
        "Este pedido já está cancelado, por isso não pode ser cancelado novamente na aplicação.",
      order_paid:
        "Este pedido já está marcado como pago, por isso o cancelamento na aplicação está atualmente bloqueado.",
      not_slot_order:
        "Este pedido não pertence ao fluxo de reservas que suporta cancelamento na aplicação.",
      wrong_service_status:
        "Este pedido não está atualmente num estado de reserva que suporte cancelamento na aplicação.",
      invoice_exists:
        "Já existe uma fatura para este pedido, por isso o cancelamento na aplicação está atualmente bloqueado.",
      missing_slots:
        "Não consigo confirmar os horários da reserva deste pedido a partir dos dados seguros para suporte, por isso não consigo marcá-lo como cancelável.",
      invalid_slot_dates:
        "O horário da reserva deste pedido não está disponível num formato seguro para suporte, por isso não consigo confirmar a elegibilidade para cancelamento.",
      cutoff_passed:
        "A janela de cancelamento desta reserva já passou, por isso o cancelamento na aplicação está atualmente bloqueado.",
      slot_paid:
        "Pelo menos um horário de reserva já está marcado como pago, por isso o cancelamento na aplicação está atualmente bloqueado.",
      unknown:
        "Não consigo identificar o motivo exato do bloqueio a partir dos dados seguros para suporte. Verifique a página Pedidos para os próximos passos disponíveis.",
    },
  },
  overview: {
    none: "Não encontrei pedidos recentes seguros para resumir. Isto não é uma verificação completa da conta ou do histórico de pagamentos.",
    summary: (parts) => `Nos pedidos recentes que posso verificar com segurança, encontrei ${parts}.`,
    inspected: (countText) => `Verifiquei ${countText}. Isto não é um histórico completo de pagamentos.`,
    counts: {
      paidOrders: (count) => `${count} pedido${count === 1 ? "" : "s"} pago${count === 1 ? "" : "s"}`,
      paymentPending: (count) => `${count} com pagamento pendente`,
      paymentNotDue: (count) => `${count} em que o pagamento ainda não é devido`,
      paymentCanceled: (count) => `${count} com pagamento cancelado`,
      refunded: (count) => `${count} reembolsado${count === 1 ? "" : "s"}`,
      unknown: (count) => `${count} com estado de pagamento desconhecido`,
      inspectedOrders: (count) => `${count} pedido${count === 1 ? "" : "s"} recente${count === 1 ? "" : "s"} seguro${count === 1 ? "" : "s"} para suporte`,
    },
  },
  genericAccountItem:
    "Encontrei o item da conta, mas ainda não consigo resumi-lo com segurança.",
});

const PL = withRomanceCopy({
  actionTokenExpired:
    "Ten wybór zamówienia wygasł. Wybierz zamówienie ponownie, abym mógł je bezpiecznie sprawdzić.",
  candidate: {
    fallbackLabel: "Kandydat zamówienia",
    none: "Mogę pomóc, ale nie znalazłem ostatnich zamówień, które można bezpiecznie pokazać. Otwórz stronę Zamówienia albo skontaktuj się z pomocą, podając dokładny identyfikator zamówienia.",
    one: "Znalazłem jedno ostatnie pasujące zamówienie. Wybierz je poniżej, jeśli to właściwe zamówienie.",
    many: "Znalazłem kilka ostatnich pasujących zamówień. O które zamówienie chodzi?",
    filteredNone: (filter) =>
      `Nie znalazłem ostatnich rezerwacji ze statusem ${filter}. To nie jest pełne sprawdzenie historii. Otwórz stronę Zamówienia, jeśli potrzebujesz pełnej listy.`,
    filteredOne: (filter) =>
      `Znalazłem jedną ostatnią rezerwację ze statusem ${filter}. Wybierz ją poniżej, jeśli to właściwe zamówienie.`,
    filteredMany: (filter) =>
      `Znalazłem ostatnie rezerwacje ze statusem ${filter}. O które zamówienie chodzi?`,
  },
  fieldLabels: {
    provider: "Dostawca",
    service: "Usługa",
    date: "Data",
    status: "Status",
    payment: "Płatność",
    reason: "Powód",
    note: "Notatka dostawcy/klienta",
    nextStep: "Następny krok",
  },
  missingReference: {
    order: "Podaj dokładny identyfikator zamówienia, abym mógł sprawdzić je bezpiecznie.",
    invoice: "Podaj dokładny identyfikator faktury, abym mógł sprawdzić ją bezpiecznie.",
  },
  statusLabels: {
    requested: "oczekuje",
    scheduled: "zaplanowane",
    completed: "ukończone",
    accepted: "zaakceptowane",
    disputed: "sporne",
    canceled: "anulowane",
    paid: "opłacone",
    pending: "oczekujące",
    not_due: "jeszcze niewymagalne",
    canceled_payment: "płatność anulowana",
    none: "brak",
    unknown: "nieznany",
    issued: "wystawiona",
    overdue: "po terminie",
    void: "unieważniona",
    refunded: "zwrócone",
  },
  statusFilterLabels: {
    canceled: "anulowane",
    requested: "oczekujące",
    scheduled: "zaplanowane",
    completed_or_accepted: "ukończone lub zaakceptowane",
    payment_not_due: "płatność jeszcze niewymagalna",
    payment_pending: "płatność oczekująca",
    paid: "opłacone",
  },
  paymentSummary: {
    payment: (status) => `płatność ${status}`,
    invoice: (status) => `faktura ${status}`,
  },
  orderHeadline: {
    tenant: {
      requested: "Ta prośba klienta o rezerwację czeka na Twoje potwierdzenie.",
      scheduled: "Ta rezerwacja klienta jest zaplanowana.",
      completed: "To zamówienie klienta jest oznaczone jako ukończone i czeka na kolejny krok cyklu usługi.",
      accepted: "To zamówienie klienta zostało zaakceptowane.",
      disputed: "To zamówienie klienta jest oznaczone jako sporne.",
      canceled: "To zamówienie klienta jest anulowane.",
      unknown: "Znalazłem zamówienie, ale jego aktualny status usługi nie jest dostępny w bezpiecznej kategorii wsparcia.",
    },
    customer: {
      requested: "To zamówienie czeka na potwierdzenie dostawcy. Jest to prośba o rezerwację, a nie jeszcze zaplanowana rezerwacja.",
      scheduled: "To zamówienie jest zaplanowane.",
      completed: "To zamówienie jest oznaczone jako ukończone i czeka na kolejny krok cyklu usługi.",
      accepted: "To zamówienie zostało zaakceptowane.",
      disputed: "To zamówienie jest oznaczone jako sporne.",
      canceled: "To zamówienie jest anulowane.",
      unknown: "Znalazłem zamówienie, ale jego aktualny status usługi nie jest dostępny w bezpiecznej kategorii wsparcia.",
    },
  },
  statusReason: {
    tenant: {
      customer_canceled: "Klient anulował to zamówienie.",
      provider_declined: "Odrzuciłeś tę prośbę o rezerwację.",
      provider_canceled: "Strona dostawcy anulowała to zamówienie.",
      awaiting_provider_confirmation: "Ta prośba o rezerwację czeka na Twoje potwierdzenie lub odrzucenie.",
      provider_confirmed: "Strona dostawcy potwierdziła tę rezerwację.",
      completed: "Strona dostawcy oznaczyła usługę jako ukończoną.",
      accepted: "Klient zaakceptował ukończenie usługi.",
      disputed: "Klient zakwestionował ukończenie usługi.",
    },
    customer: {
      customer_canceled: "Zamówienie zostało anulowane przez klienta.",
      provider_declined: "Dostawca odrzucił tę prośbę o rezerwację.",
      provider_canceled: "Dostawca anulował to zamówienie.",
      awaiting_provider_confirmation: "Dostawca nie potwierdził jeszcze ani nie odrzucił tej prośby o rezerwację.",
      provider_confirmed: "Dostawca potwierdził tę rezerwację.",
      completed: "Dostawca oznaczył usługę jako ukończoną.",
      accepted: "Ukończenie usługi zostało zaakceptowane.",
      disputed: "Zamówienie jest obecnie oznaczone jako sporne.",
    },
  },
  nextStep: {
    tenant: {
      await_provider_confirmation: "Potwierdź lub odrzuć prośbę w swoim panelu.",
      pay_invoice: "Sprawdź wystawioną fakturę w swoim panelu.",
      view_orders: "Otwórz widok Zamówienia w panelu, aby zobaczyć pełne zamówienie.",
      no_action_needed: "Teraz nie jest potrzebne żadne działanie płatnicze.",
    },
    customer: {
      await_provider_confirmation: "Poczekaj, aż dostawca potwierdzi lub odrzuci prośbę.",
      pay_invoice: "Otwórz fakturę na stronie Zamówienia, aby zapłacić.",
      view_orders: "Otwórz stronę Zamówienia, aby zobaczyć pełne zamówienie.",
      no_action_needed: "Teraz nie jest potrzebne żadne działanie płatnicze.",
    },
  },
  invoiceLifecycle: {
    tenant: {
      issued: "Faktura dla tej rezerwacji klienta została już wystawiona. Po stronie dostawcy sprawdź zamówienie lub fakturę w panelu, aby zobaczyć aktualny stan płatności.",
      paid: "Ta rezerwacja klienta jest już oznaczona jako opłacona w bezpiecznym statusie zamówienia. Sprawdź zamówienie w panelu, jeśli potrzebujesz pełnego widoku.",
      void: "Faktura dla tej rezerwacji klienta nie jest obecnie płatna. Sprawdź zamówienie w panelu lub skontaktuj się ze wsparciem, jeśli klient nadal potrzebuje pomocy.",
      requested: "Faktura dla tej rezerwacji klienta nie została jeszcze wystawiona, ponieważ nadal czeka na Twoje potwierdzenie. Prośby o rezerwację nie stają się od razu płatne. Po stronie dostawcy potwierdź lub odrzuć prośbę w panelu; później status faktury/płatności może się zmienić.",
      scheduled: "Faktura dla tej rezerwacji klienta nie została jeszcze wystawiona, ponieważ to zaplanowane zamówienie nie osiągnęło jeszcze kroku faktury/płatności. Po stronie dostawcy sprawdź zamówienie w panelu i czy usługa jest gotowa na kolejny krok.",
      completed: "Faktura dla tej rezerwacji klienta nie została jeszcze wystawiona, mimo że zamówienie przeszło etap prośby/planowania. Sprawdź zamówienie w panelu i skontaktuj się ze wsparciem, jeśli krok faktury/płatności wygląda na zablokowany.",
      canceled: "Faktura nie została wystawiona, ponieważ ta rezerwacja klienta jest anulowana. Anulowane zamówienie nie powinno obecnie przechodzić do kroku faktury/płatności.",
      unknown: "Faktura dla tej rezerwacji klienta nie została jeszcze wystawiona, ponieważ nie osiągnęła bezpiecznego statusu faktury/płatności. Sprawdź pełne zamówienie w panelu.",
    },
    customer: {
      issued: "Faktura dla tego zamówienia została już wystawiona. Otwórz stronę Zamówienia, aby sprawdzić fakturę i aktualny stan płatności.",
      paid: "To zamówienie jest już oznaczone jako opłacone w bezpiecznym statusie zamówienia. Otwórz stronę Zamówienia, jeśli potrzebujesz pełnego widoku.",
      void: "Faktura dla tego zamówienia nie jest obecnie płatna. Otwórz stronę Zamówienia lub skontaktuj się ze wsparciem, jeśli nadal potrzebujesz pomocy.",
      requested: "Faktura nie została jeszcze wystawiona, ponieważ ta prośba o rezerwację nadal czeka na potwierdzenie dostawcy. Prośby o rezerwację nie stają się od razu płatne. Po potwierdzeniu i późniejszym kroku faktury/płatności status może się zmienić.",
      scheduled: "Faktura dla tej zaplanowanej rezerwacji nie została jeszcze wystawiona, ponieważ nie osiągnęła kroku faktury/płatności. W tym procesie płatność może zostać poproszona później. Sprawdzaj stronę Zamówienia.",
      completed: "Faktura dla tego zamówienia nie została jeszcze wystawiona, mimo że przeszło etap prośby/planowania. Sprawdź stronę Zamówienia i skontaktuj się ze wsparciem, jeśli krok faktury/płatności wygląda na zablokowany.",
      canceled: "Faktura nie została wystawiona, ponieważ to zamówienie jest anulowane. Anulowane zamówienie nie powinno obecnie przechodzić do kroku faktury/płatności.",
      unknown: "Faktura nie została jeszcze wystawiona, ponieważ to zamówienie nie osiągnęło bezpiecznego statusu faktury/płatności. Otwórz stronę Zamówienia, aby zobaczyć pełny widok.",
    },
  },
  paymentStatus: {
    paid: "Ta płatność jest oznaczona jako opłacona.",
    pending: "Dla tego zamówienia lub faktury oczekuje płatność. Możesz otworzyć fakturę na stronie Zamówienia.",
    notDueRequested: "Płatność nie jest jeszcze wymagalna, ponieważ to nadal prośba o rezerwację oczekująca na potwierdzenie dostawcy. Prośby o rezerwację nie stają się od razu płatne. Po potwierdzeniu i późniejszym kroku faktury/płatności status może się zmienić.",
    notDueScheduled: "Płatność nie jest jeszcze wymagalna, ponieważ dla tej zaplanowanej rezerwacji nie wystawiono faktury. W tym procesie płatność jest proszona później przez krok faktury/płatności.",
    notDueCompleted: "Płatność nie jest jeszcze wymagalna, ponieważ dla tego zamówienia nie wystawiono faktury. Sprawdź stronę Zamówienia, aby zobaczyć aktualizacje faktury lub płatności.",
    notDueCanceled: "Płatność nie jest wymagalna, ponieważ to zamówienie jest anulowane i nie ma obecnie powiązanej płatnej faktury.",
    notDue: "Płatność dla tego zamówienia nie jest jeszcze wymagalna. Nie ma obecnie powiązanej płatnej faktury.",
    void: "Ta faktura nie jest obecnie płatna.",
    unknown: "Znalazłem rekord płatności, ale jego aktualny status nie jest dostępny w bezpiecznej kategorii wsparcia.",
  },
  cancellation: {
    eligible: "To zamówienie wygląda obecnie na kwalifikujące się do anulowania w aplikacji. Użyj opcji anulowania na stronie Zamówienia.",
    notEligible: "To zamówienie nie wygląda obecnie na kwalifikujące się do anulowania w aplikacji. Użyj strony Zamówienia lub skontaktuj się ze wsparciem, jeśli potrzebujesz pomocy.",
    blockReasons: {
      already_canceled:
        "To zamówienie jest już anulowane, więc nie można go anulować ponownie w aplikacji.",
      order_paid:
        "To zamówienie jest już oznaczone jako opłacone, więc anulowanie w aplikacji jest obecnie zablokowane.",
      not_slot_order:
        "To zamówienie nie należy do przepływu rezerwacji, który obsługuje anulowanie w aplikacji.",
      wrong_service_status:
        "To zamówienie nie jest obecnie w statusie rezerwacji, który obsługuje anulowanie w aplikacji.",
      invoice_exists:
        "Dla tego zamówienia istnieje już faktura, więc anulowanie w aplikacji jest obecnie zablokowane.",
      missing_slots:
        "Nie mogę potwierdzić terminów rezerwacji tego zamówienia na podstawie danych bezpiecznych dla wsparcia, więc nie mogę oznaczyć go jako możliwe do anulowania.",
      invalid_slot_dates:
        "Termin rezerwacji tego zamówienia nie jest dostępny w formie bezpiecznej dla wsparcia, więc nie mogę potwierdzić możliwości anulowania.",
      cutoff_passed:
        "Okno anulowania tej rezerwacji już minęło, więc anulowanie w aplikacji jest obecnie zablokowane.",
      slot_paid:
        "Co najmniej jeden termin rezerwacji jest już oznaczony jako opłacony, więc anulowanie w aplikacji jest obecnie zablokowane.",
      unknown:
        "Nie mogę określić dokładnego powodu blokady na podstawie danych bezpiecznych dla wsparcia. Sprawdź stronę Zamówienia, aby zobaczyć dostępne następne kroki.",
    },
  },
  overview: {
    none: "Nie znalazłem ostatnich bezpiecznych zamówień do podsumowania. To nie jest pełna historia konta ani płatności.",
    summary: (parts) => `W ostatnich zamówieniach, które mogę bezpiecznie sprawdzić, znalazłem ${parts}.`,
    inspected: (countText) => `Sprawdziłem ${countText}. To nie jest pełna historia płatności.`,
    counts: {
      paidOrders: (count) => `${count} opłacone zamówienie${count === 1 ? "" : "a"}`,
      paymentPending: (count) => `${count} z oczekującą płatnością`,
      paymentNotDue: (count) => `${count}, gdzie płatność nie jest jeszcze wymagalna`,
      paymentCanceled: (count) => `${count} z anulowaną płatnością`,
      refunded: (count) => `${count} zwrócone`,
      unknown: (count) => `${count} z nieznanym statusem płatności`,
      inspectedOrders: (count) => `${count} ostatnie bezpieczne zamówienie${count === 1 ? "" : "a"} wsparcia`,
    },
  },
  genericAccountItem:
    "Znalazłem element konta, ale nie mogę jeszcze bezpiecznie go podsumować.",
});

const RO = withRomanceCopy({
  actionTokenExpired:
    "Această selecție a comenzii a expirat. Selectează din nou comanda ca să o pot verifica în siguranță.",
  candidate: {
    fallbackLabel: "Comandă posibilă",
    none: "Pot ajuta, dar nu am găsit comenzi recente care pot fi afișate în siguranță. Deschide pagina Comenzi sau contactează suportul cu ID-ul exact al comenzii.",
    one: "Am găsit o comandă recentă care se poate potrivi. Selecteaz-o mai jos dacă aceasta este comanda dorită.",
    many: "Am găsit câteva comenzi recente care se pot potrivi. La care comandă te referi?",
    filteredNone: (filter) =>
      `Nu am găsit rezervări recente care se potrivesc cu statusul ${filter}. Aceasta nu este o verificare completă a istoricului. Deschide pagina Comenzi dacă ai nevoie de lista completă.`,
    filteredOne: (filter) =>
      `Am găsit o rezervare recentă cu statusul ${filter} care se poate potrivi. Selecteaz-o mai jos dacă aceasta este comanda dorită.`,
    filteredMany: (filter) =>
      `Am găsit rezervări recente cu statusul ${filter} care se pot potrivi. La care comandă te referi?`,
  },
  fieldLabels: {
    provider: "Furnizor",
    service: "Serviciu",
    date: "Dată",
    status: "Status",
    payment: "Plată",
    reason: "Motiv",
    note: "Notă furnizor/client",
    nextStep: "Pasul următor",
  },
  missingReference: {
    order: "Te rog să furnizezi ID-ul exact al comenzii ca să o pot verifica în siguranță.",
    invoice: "Te rog să furnizezi ID-ul exact al facturii ca să o pot verifica în siguranță.",
  },
  statusLabels: {
    requested: "solicitată",
    scheduled: "programată",
    completed: "finalizată",
    accepted: "acceptată",
    disputed: "contestată",
    canceled: "anulată",
    paid: "plătit",
    pending: "în așteptare",
    not_due: "nu este încă scadentă",
    canceled_payment: "plată anulată",
    none: "niciuna",
    unknown: "necunoscut",
    issued: "emisă",
    overdue: "restantă",
    void: "anulată",
    refunded: "rambursat",
  },
  statusFilterLabels: {
    canceled: "anulată",
    requested: "solicitată",
    scheduled: "programată",
    completed_or_accepted: "finalizată sau acceptată",
    payment_not_due: "plată încă nescadentă",
    payment_pending: "plată în așteptare",
    paid: "plătită",
  },
  paymentSummary: {
    payment: (status) => `plată ${status}`,
    invoice: (status) => `factură ${status}`,
  },
  orderHeadline: {
    tenant: {
      requested: "Această cerere de rezervare a clientului așteaptă confirmarea ta.",
      scheduled: "Această rezervare a clientului este programată.",
      completed: "Această comandă a clientului este marcată ca finalizată și așteaptă următorul pas al ciclului serviciului.",
      accepted: "Această comandă a clientului a fost acceptată.",
      disputed: "Această comandă a clientului este marcată ca disputată.",
      canceled: "Această comandă a clientului este anulată.",
      unknown: "Am găsit comanda, dar statusul actual al serviciului nu este disponibil într-o categorie sigură pentru suport.",
    },
    customer: {
      requested: "Această comandă așteaptă confirmarea furnizorului. Este o cerere de rezervare, nu încă o rezervare programată.",
      scheduled: "Această comandă este programată.",
      completed: "Această comandă este marcată ca finalizată și așteaptă următorul pas al ciclului serviciului.",
      accepted: "Această comandă a fost acceptată.",
      disputed: "Această comandă este marcată ca disputată.",
      canceled: "Această comandă este anulată.",
      unknown: "Am găsit comanda, dar statusul actual al serviciului nu este disponibil într-o categorie sigură pentru suport.",
    },
  },
  statusReason: {
    tenant: {
      customer_canceled: "Clientul a anulat această comandă.",
      provider_declined: "Ai refuzat această cerere de rezervare.",
      provider_canceled: "Partea furnizorului a anulat această comandă.",
      awaiting_provider_confirmation: "Această cerere de rezervare așteaptă confirmarea sau refuzul tău.",
      provider_confirmed: "Partea furnizorului a confirmat această rezervare.",
      completed: "Partea furnizorului a marcat serviciul ca finalizat.",
      accepted: "Clientul a acceptat finalizarea serviciului.",
      disputed: "Clientul a contestat finalizarea serviciului.",
    },
    customer: {
      customer_canceled: "Comanda a fost anulată de client.",
      provider_declined: "Furnizorul a refuzat această cerere de rezervare.",
      provider_canceled: "Furnizorul a anulat această comandă.",
      awaiting_provider_confirmation: "Furnizorul nu a confirmat sau refuzat încă această cerere de rezervare.",
      provider_confirmed: "Furnizorul a confirmat această rezervare.",
      completed: "Furnizorul a marcat serviciul ca finalizat.",
      accepted: "Finalizarea serviciului a fost acceptată.",
      disputed: "Comanda este marcată în prezent ca disputată.",
    },
  },
  nextStep: {
    tenant: {
      await_provider_confirmation: "Confirmă sau refuză cererea din dashboard.",
      pay_invoice: "Verifică factura emisă din dashboard.",
      view_orders: "Deschide vizualizarea Comenzi din dashboard pentru comanda completă.",
      no_action_needed: "Nu este necesară nicio acțiune de plată acum.",
    },
    customer: {
      await_provider_confirmation: "Așteaptă ca furnizorul să confirme sau să refuze cererea.",
      pay_invoice: "Deschide factura din pagina Comenzi pentru a plăti.",
      view_orders: "Deschide pagina Comenzi pentru comanda completă.",
      no_action_needed: "Nu este necesară nicio acțiune de plată acum.",
    },
  },
  invoiceLifecycle: {
    tenant: {
      issued: "O factură a fost deja emisă pentru această rezervare a clientului. Din partea furnizorului, verifică ordinul sau factura în dashboard pentru starea curentă a plății.",
      paid: "Această rezervare a clientului este deja marcată ca plătită în statusul sigur al comenzii. Verifică ordinul în dashboard dacă ai nevoie de vizualizarea completă.",
      void: "Factura pentru această rezervare a clientului nu este plătibilă în prezent. Verifică ordinul în dashboard sau contactează suportul dacă clientul mai are nevoie de ajutor.",
      requested: "Nu a fost emisă încă o factură pentru această rezervare a clientului deoarece încă așteaptă confirmarea ta. Cererile de rezervare nu devin plătibile imediat. Din partea furnizorului, confirmă sau refuză cererea în dashboard; ulterior statusul facturii/plății se poate schimba.",
      scheduled: "Nu a fost emisă încă o factură pentru această rezervare a clientului deoarece această comandă programată nu a ajuns încă la pasul factură/plată. Din partea furnizorului, verifică ordinul în dashboard și dacă serviciul este pregătit pentru următorul pas.",
      completed: "Nu a fost emisă încă o factură pentru această rezervare a clientului, deși comanda a trecut de etapa cerere/programare. Verifică ordinul în dashboard și contactează suportul dacă pasul factură/plată pare blocat.",
      canceled: "Nu a fost emisă o factură deoarece această rezervare a clientului este anulată. O comandă anulată nu ar trebui să treacă la pasul factură/plată.",
      unknown: "Nu a fost emisă încă o factură pentru această rezervare a clientului deoarece nu a ajuns la o stare factură/plată sigură pentru suport. Verifică ordinul complet în dashboard.",
    },
    customer: {
      issued: "O factură a fost deja emisă pentru această comandă. Deschide pagina Comenzi pentru a verifica factura și starea curentă a plății.",
      paid: "Această comandă este deja marcată ca plătită în statusul sigur al comenzii. Deschide pagina Comenzi dacă ai nevoie de vizualizarea completă.",
      void: "Factura pentru această comandă nu este plătibilă în prezent. Deschide pagina Comenzi sau contactează suportul dacă mai ai nevoie de ajutor.",
      requested: "Nu a fost emisă încă o factură deoarece această cerere de rezervare încă așteaptă confirmarea furnizorului. Cererile de rezervare nu devin plătibile imediat. După confirmare și pasul ulterior factură/plată, statusul se poate schimba.",
      scheduled: "Nu a fost emisă încă o factură pentru această rezervare programată deoarece nu a ajuns încă la pasul factură/plată. În acest flux, plata poate fi cerută mai târziu. Verifică pagina Comenzi pentru actualizări.",
      completed: "Nu a fost emisă încă o factură pentru această comandă, deși a trecut de etapa cerere/programare. Verifică pagina Comenzi și contactează suportul dacă pasul factură/plată pare blocat.",
      canceled: "Nu a fost emisă o factură deoarece această comandă este anulată. O comandă anulată nu ar trebui să treacă la pasul factură/plată.",
      unknown: "Nu a fost emisă încă o factură deoarece această comandă nu a ajuns la o stare factură/plată sigură pentru suport. Deschide pagina Comenzi pentru vizualizarea completă.",
    },
  },
  paymentStatus: {
    paid: "Această plată este marcată ca plătită.",
    pending: "Există o plată în așteptare pentru această comandă sau factură. Poți deschide factura din pagina Comenzi.",
    notDueRequested: "Plata nu este încă scadentă deoarece aceasta este încă o cerere de rezervare care așteaptă confirmarea furnizorului. Cererile de rezervare nu devin plătibile imediat. După confirmare și pasul ulterior factură/plată, statusul plății se poate schimba.",
    notDueScheduled: "Plata nu este încă scadentă deoarece nu a fost emisă o factură pentru această rezervare programată. În acest flux, plata este cerută mai târziu prin pasul factură/plată.",
    notDueCompleted: "Plata nu este încă scadentă deoarece nu a fost emisă o factură pentru această comandă. Verifică pagina Comenzi pentru actualizări de factură sau plată.",
    notDueCanceled: "Plata nu este scadentă deoarece această comandă este anulată și nu există o factură plătibilă asociată.",
    notDue: "Plata nu este încă scadentă pentru această comandă. Nu există o factură plătibilă asociată.",
    void: "Această factură nu este plătibilă în prezent.",
    unknown: "Am găsit înregistrarea de plată, dar statusul curent nu este disponibil într-o categorie sigură pentru suport.",
  },
  cancellation: {
    eligible: "Această comandă pare eligibilă pentru anulare în aplicație. Folosește opțiunea de anulare din pagina Comenzi.",
    notEligible: "Această comandă nu pare eligibilă pentru anulare în aplicație. Folosește pagina Comenzi sau contactează suportul dacă ai nevoie de ajutor.",
    blockReasons: {
      already_canceled:
        "Această comandă este deja anulată, deci nu poate fi anulată din nou în aplicație.",
      order_paid:
        "Această comandă este deja marcată ca plătită, deci anularea în aplicație este blocată în prezent.",
      not_slot_order:
        "Această comandă nu face parte din fluxul de rezervări care permite anularea în aplicație.",
      wrong_service_status:
        "Această comandă nu este momentan într-un status de rezervare care permite anularea în aplicație.",
      invoice_exists:
        "Există deja o factură pentru această comandă, deci anularea în aplicație este blocată în prezent.",
      missing_slots:
        "Nu pot confirma intervalele rezervării pentru această comandă din datele sigure pentru suport, deci nu o pot marca drept anulabilă.",
      invalid_slot_dates:
        "Ora rezervării pentru această comandă nu este disponibilă într-o formă sigură pentru suport, deci nu pot confirma eligibilitatea pentru anulare.",
      cutoff_passed:
        "Fereastra de anulare pentru această rezervare a trecut deja, deci anularea în aplicație este blocată în prezent.",
      slot_paid:
        "Cel puțin un interval de rezervare este deja marcat ca plătit, deci anularea în aplicație este blocată în prezent.",
      unknown:
        "Nu pot identifica motivul exact al blocării din datele sigure pentru suport. Verifică pagina Comenzi pentru pașii următori disponibili.",
    },
  },
  overview: {
    none: "Nu am găsit comenzi recente sigure pentru rezumat. Aceasta nu este o verificare completă a contului sau a istoricului plăților.",
    summary: (parts) => `Din comenzile recente pe care le pot verifica în siguranță, am găsit ${parts}.`,
    inspected: (countText) => `Am verificat ${countText}. Acesta nu este un istoric complet al plăților.`,
    counts: {
      paidOrders: (count) => `${count} comand${count === 1 ? "ă plătită" : "e plătite"}`,
      paymentPending: (count) => `${count} cu plată în așteptare`,
      paymentNotDue: (count) => `${count} unde plata nu este încă scadentă`,
      paymentCanceled: (count) => `${count} cu plată anulată`,
      refunded: (count) => `${count} rambursat${count === 1 ? "" : "e"}`,
      unknown: (count) => `${count} cu status de plată necunoscut`,
      inspectedOrders: (count) => `${count} comand${count === 1 ? "ă recentă sigură" : "e recente sigure"} pentru suport`,
    },
  },
  genericAccountItem:
    "Am găsit elementul de cont, dar încă nu îl pot rezuma în siguranță.",
});

const UK = withRomanceCopy({
  actionTokenExpired:
    "Цей вибір замовлення застарів. Виберіть замовлення ще раз, щоб я міг безпечно його перевірити.",
  candidate: {
    fallbackLabel: "Можливе замовлення",
    none: "Я можу допомогти, але не знайшов останніх замовлень, які можна безпечно показати. Відкрийте сторінку замовлень або зверніться до підтримки з точним ID замовлення.",
    one: "Я знайшов одне нещодавнє можливе замовлення. Виберіть його нижче, якщо це потрібне замовлення.",
    many: "Я знайшов кілька нещодавніх можливих замовлень. Яке замовлення ви маєте на увазі?",
    filteredNone: (filter) =>
      `Я не знайшов нещодавніх бронювань зі статусом ${filter}. Це не повна перевірка історії. Відкрийте сторінку замовлень, якщо потрібен повний список.`,
    filteredOne: (filter) =>
      `Я знайшов одне нещодавнє бронювання зі статусом ${filter}. Виберіть його нижче, якщо це потрібне замовлення.`,
    filteredMany: (filter) =>
      `Я знайшов нещодавні бронювання зі статусом ${filter}. Яке замовлення ви маєте на увазі?`,
  },
  fieldLabels: {
    provider: "Постачальник",
    service: "Послуга",
    date: "Дата",
    status: "Статус",
    payment: "Оплата",
    reason: "Причина",
    note: "Нотатка постачальника/клієнта",
    nextStep: "Наступний крок",
  },
  missingReference: {
    order: "Надайте точний ID замовлення, щоб я міг безпечно його перевірити.",
    invoice: "Надайте точний ID рахунка, щоб я міг безпечно його перевірити.",
  },
  statusLabels: {
    requested: "запитано",
    scheduled: "заплановано",
    completed: "завершено",
    accepted: "прийнято",
    disputed: "оспорюється",
    canceled: "скасовано",
    paid: "оплачено",
    pending: "очікує",
    not_due: "ще не належить до сплати",
    canceled_payment: "оплату скасовано",
    none: "немає",
    unknown: "невідомо",
    issued: "виставлено",
    overdue: "прострочено",
    void: "анульовано",
    refunded: "повернено",
  },
  statusFilterLabels: {
    canceled: "скасовано",
    requested: "запитано",
    scheduled: "заплановано",
    completed_or_accepted: "завершено або прийнято",
    payment_not_due: "оплата ще не належить до сплати",
    payment_pending: "оплата очікує",
    paid: "оплачено",
  },
  paymentSummary: {
    payment: (status) => `оплата ${status}`,
    invoice: (status) => `рахунок ${status}`,
  },
  orderHeadline: {
    tenant: {
      requested: "Цей запит клієнта на бронювання очікує вашого підтвердження.",
      scheduled: "Це бронювання клієнта заплановано.",
      completed: "Це замовлення клієнта позначено як завершене і воно очікує наступного кроку циклу послуги.",
      accepted: "Це замовлення клієнта прийнято.",
      disputed: "Це замовлення клієнта позначено як спірне.",
      canceled: "Це замовлення клієнта скасовано.",
      unknown: "Я знайшов замовлення, але його поточний статус послуги недоступний у безпечній для підтримки категорії.",
    },
    customer: {
      requested: "Це замовлення очікує підтвердження постачальника. Це запит на бронювання, а не заплановане бронювання.",
      scheduled: "Це замовлення заплановано.",
      completed: "Це замовлення позначено як завершене і очікує наступного кроку циклу послуги.",
      accepted: "Це замовлення прийнято.",
      disputed: "Це замовлення позначено як спірне.",
      canceled: "Це замовлення скасовано.",
      unknown: "Я знайшов замовлення, але його поточний статус послуги недоступний у безпечній для підтримки категорії.",
    },
  },
  statusReason: {
    tenant: {
      customer_canceled: "Клієнт скасував це замовлення.",
      provider_declined: "Ви відхилили цей запит на бронювання.",
      provider_canceled: "Сторона постачальника скасувала це замовлення.",
      awaiting_provider_confirmation: "Цей запит на бронювання очікує вашого підтвердження або відхилення.",
      provider_confirmed: "Сторона постачальника підтвердила це бронювання.",
      completed: "Сторона постачальника позначила послугу як завершену.",
      accepted: "Клієнт прийняв завершення послуги.",
      disputed: "Клієнт оскаржив завершення послуги.",
    },
    customer: {
      customer_canceled: "Замовлення було скасовано клієнтом.",
      provider_declined: "Постачальник відхилив цей запит на бронювання.",
      provider_canceled: "Постачальник скасував це замовлення.",
      awaiting_provider_confirmation: "Постачальник ще не підтвердив і не відхилив цей запит на бронювання.",
      provider_confirmed: "Постачальник підтвердив це бронювання.",
      completed: "Постачальник позначив послугу як завершену.",
      accepted: "Завершення послуги прийнято.",
      disputed: "Замовлення зараз позначено як спірне.",
    },
  },
  nextStep: {
    tenant: {
      await_provider_confirmation: "Підтвердьте або відхиліть запит у своїй панелі.",
      pay_invoice: "Перегляньте виставлений рахунок у своїй панелі.",
      view_orders: "Відкрийте розділ замовлень у панелі, щоб побачити повне замовлення.",
      no_action_needed: "Зараз дія з оплатою не потрібна.",
    },
    customer: {
      await_provider_confirmation: "Зачекайте, поки постачальник підтвердить або відхилить запит.",
      pay_invoice: "Відкрийте рахунок на сторінці замовлень, щоб оплатити.",
      view_orders: "Відкрийте сторінку замовлень, щоб побачити повне замовлення.",
      no_action_needed: "Зараз дія з оплатою не потрібна.",
    },
  },
  invoiceLifecycle: {
    tenant: {
      issued: "Рахунок для цього бронювання клієнта вже виставлено. З боку постачальника перегляньте замовлення або рахунок у панелі, щоб побачити поточний стан оплати.",
      paid: "Це бронювання клієнта вже позначено як оплачене в безпечному статусі замовлення. Перегляньте замовлення в панелі, якщо потрібен повний вигляд.",
      void: "Рахунок для цього бронювання клієнта зараз не підлягає оплаті. Перегляньте замовлення в панелі або зверніться до підтримки, якщо клієнту все ще потрібна допомога.",
      requested: "Рахунок для цього бронювання клієнта ще не виставлено, тому що воно все ще очікує вашого підтвердження. Запити на бронювання не стають оплачуваними одразу. З боку постачальника підтвердьте або відхиліть запит у панелі; пізніше статус рахунка/оплати може змінитися.",
      scheduled: "Рахунок для цього бронювання клієнта ще не виставлено, тому що це заплановане замовлення ще не досягло кроку рахунка/оплати. З боку постачальника перегляньте замовлення в панелі та перевірте, чи послуга готова до наступного кроку.",
      completed: "Рахунок для цього бронювання клієнта ще не виставлено, хоча замовлення вже пройшло етап запиту/планування. Перегляньте замовлення в панелі та зверніться до підтримки, якщо крок рахунка/оплати здається заблокованим.",
      canceled: "Рахунок не виставлено, тому що це бронювання клієнта скасовано. Скасоване замовлення не повинно переходити до кроку рахунка/оплати.",
      unknown: "Рахунок для цього бронювання клієнта ще не виставлено, тому що воно не досягло безпечного для підтримки стану рахунка/оплати. Перегляньте повне замовлення в панелі.",
    },
    customer: {
      issued: "Рахунок для цього замовлення вже виставлено. Відкрийте сторінку замовлень, щоб переглянути рахунок і поточний стан оплати.",
      paid: "Це замовлення вже позначено як оплачене в безпечному статусі замовлення. Відкрийте сторінку замовлень, якщо потрібен повний вигляд.",
      void: "Рахунок для цього замовлення зараз не підлягає оплаті. Відкрийте сторінку замовлень або зверніться до підтримки, якщо вам ще потрібна допомога.",
      requested: "Рахунок ще не виставлено, тому що цей запит на бронювання все ще очікує підтвердження постачальника. Запити на бронювання не стають оплачуваними одразу. Після підтвердження та подальшого кроку рахунка/оплати статус може змінитися.",
      scheduled: "Рахунок для цього запланованого бронювання ще не виставлено, тому що воно ще не досягло кроку рахунка/оплати. У цьому процесі оплату можуть запросити пізніше. Перевіряйте сторінку замовлень для оновлень.",
      completed: "Рахунок для цього замовлення ще не виставлено, хоча воно вже пройшло етап запиту/планування. Перевірте сторінку замовлень і зверніться до підтримки, якщо крок рахунка/оплати здається заблокованим.",
      canceled: "Рахунок не виставлено, тому що це замовлення скасовано. Скасоване замовлення не повинно переходити до кроку рахунка/оплати.",
      unknown: "Рахунок ще не виставлено, тому що це замовлення не досягло безпечного для підтримки стану рахунка/оплати. Відкрийте сторінку замовлень для повного вигляду.",
    },
  },
  paymentStatus: {
    paid: "Цю оплату позначено як оплачену.",
    pending: "Для цього замовлення або рахунка очікує оплата. Ви можете відкрити рахунок на сторінці замовлень.",
    notDueRequested: "Оплата ще не належить до сплати, тому що це все ще запит на бронювання, який очікує підтвердження постачальника. Запити на бронювання не стають оплачуваними одразу. Після підтвердження та подальшого кроку рахунка/оплати статус може змінитися.",
    notDueScheduled: "Оплата ще не належить до сплати, тому що для цього запланованого бронювання ще не виставлено рахунок. У цьому процесі оплату запитують пізніше через крок рахунка/оплати.",
    notDueCompleted: "Оплата ще не належить до сплати, тому що для цього замовлення ще не виставлено рахунок. Перевіряйте сторінку замовлень для оновлень рахунка або оплати.",
    notDueCanceled: "Оплата не належить до сплати, тому що це замовлення скасовано і наразі немає пов'язаного рахунка до оплати.",
    notDue: "Оплата для цього замовлення ще не належить до сплати. Наразі немає пов'язаного рахунка до оплати.",
    void: "Цей рахунок зараз не підлягає оплаті.",
    unknown: "Я знайшов запис оплати, але його поточний статус недоступний у безпечній для підтримки категорії.",
  },
  cancellation: {
    eligible: "Це замовлення зараз виглядає придатним для скасування в застосунку. Скористайтеся опцією скасування на сторінці замовлень.",
    notEligible: "Це замовлення зараз не виглядає придатним для скасування в застосунку. Скористайтеся сторінкою замовлень або зверніться до підтримки, якщо потрібна допомога.",
    blockReasons: {
      already_canceled:
        "Це замовлення вже скасовано, тому його не можна скасувати повторно в застосунку.",
      order_paid:
        "Це замовлення вже позначено як оплачене, тому скасування в застосунку наразі заблоковане.",
      not_slot_order:
        "Це замовлення не належить до потоку бронювань, який підтримує скасування в застосунку.",
      wrong_service_status:
        "Це замовлення зараз не має статусу бронювання, який підтримує скасування в застосунку.",
      invoice_exists:
        "Для цього замовлення вже існує рахунок, тому скасування в застосунку наразі заблоковане.",
      missing_slots:
        "Я не можу підтвердити часові слоти цього замовлення з безпечних для підтримки даних, тому не можу позначити його як доступне для скасування.",
      invalid_slot_dates:
        "Час бронювання цього замовлення недоступний у безпечній для підтримки формі, тому я не можу підтвердити можливість скасування.",
      cutoff_passed:
        "Вікно скасування для цього бронювання вже минуло, тому скасування в застосунку наразі заблоковане.",
      slot_paid:
        "Принаймні один часовий слот бронювання вже позначено як оплачений, тому скасування в застосунку наразі заблоковане.",
      unknown:
        "Я не можу визначити точну причину блокування з безпечних для підтримки даних. Перевірте сторінку замовлень, щоб побачити доступні наступні кроки.",
    },
  },
  overview: {
    none: "Я не знайшов нещодавніх безпечних замовлень для підсумку. Це не повна перевірка облікового запису або історії оплат.",
    summary: (parts) => `Серед нещодавніх замовлень, які я можу безпечно перевірити, я знайшов ${parts}.`,
    inspected: (countText) => `Я перевірив ${countText}. Це не повна історія оплат.`,
    counts: {
      paidOrders: (count) => `${count} оплачен${count === 1 ? "е замовлення" : "их замовлень"}`,
      paymentPending: (count) => `${count} з оплатою в очікуванні`,
      paymentNotDue: (count) => `${count}, де оплата ще не належить до сплати`,
      paymentCanceled: (count) => `${count} зі скасованою оплатою`,
      refunded: (count) => `${count} повернено`,
      unknown: (count) => `${count} з невідомим статусом оплати`,
      inspectedOrders: (count) => `${count} нещодавн${count === 1 ? "є безпечне замовлення" : "іх безпечних замовлень"} для підтримки`,
    },
  },
  genericAccountItem:
    "Я знайшов елемент облікового запису, але поки не можу безпечно його підсумувати.",
});

const ACCOUNT_AWARE_COPY: Record<AppLang, AccountAwareLocalizedCopy> = {
  en: EN,
  de: DE,
  fr: FR,
  it: IT,
  es: ES,
  pt: PT,
  pl: PL,
  ro: RO,
  uk: UK,
};

export function getAccountAwareCopy(locale: AppLang) {
  return ACCOUNT_AWARE_COPY[locale] ?? EN;
}
