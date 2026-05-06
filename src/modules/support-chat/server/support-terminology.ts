import "server-only";

import {
  type AppLang,
  normalizeToSupported,
} from "@/lib/i18n/app-lang";

export type SupportTerminology = {
  providerRole: string;
  providerProfile: string;
  providerSettings: string;
  paymentsArea: string;
  payouts: string;
  stripeOnboarding: string;
  requestedStatus: string;
  scheduledStatus: string;
  canceledStatus: string;
  paidStatus: string;
  paymentPendingStatus: string;
  awaitingProviderConfirmation: string;
  cancellationCutoff: string;
  avoidTerms?: string[];
};

const TERMINOLOGY: Record<AppLang, SupportTerminology> = {
  en: {
    providerRole: "Service Provider",
    providerProfile: "Service Provider profile",
    providerSettings: "Service Provider Settings",
    paymentsArea: "Payments",
    payouts: "Payouts",
    stripeOnboarding: "Stripe Onboarding",
    requestedStatus: "requested",
    scheduledStatus: "scheduled",
    canceledStatus: "canceled",
    paidStatus: "paid",
    paymentPendingStatus: "payment pending",
    awaitingProviderConfirmation: "awaiting provider confirmation",
    cancellationCutoff: "cancellation cutoff",
  },
  de: {
    providerRole: "Anbieter",
    providerProfile: "Anbieterprofil",
    providerSettings: "Anbieter-Einstellungen",
    paymentsArea: "Zahlungen",
    payouts: "Auszahlungen",
    stripeOnboarding: "Stripe-Einrichtung",
    requestedStatus: "angefragt",
    scheduledStatus: "geplant",
    canceledStatus: "storniert",
    paidStatus: "bezahlt",
    paymentPendingStatus: "Zahlung ausstehend",
    awaitingProviderConfirmation: "wartet auf Bestätigung des Anbieters",
    cancellationCutoff: "Stornofrist",
    avoidTerms: [
      "Provider-Profil",
      "Provider",
      "Dienstleisterprofil",
      "Dienstleister-Einstellungen",
      "Awaiting provider confirmation",
      "Requested",
      "Scheduled",
    ],
  },
  fr: {
    providerRole: "prestataire",
    providerProfile: "profil prestataire",
    providerSettings: "Paramètres du prestataire",
    paymentsArea: "Paiements",
    payouts: "versements",
    stripeOnboarding: "Configuration Stripe",
    requestedStatus: "demandée",
    scheduledStatus: "planifiée",
    canceledStatus: "annulée",
    paidStatus: "payée",
    paymentPendingStatus: "paiement en attente",
    awaitingProviderConfirmation: "en attente de confirmation par le prestataire",
    cancellationCutoff: "délai d'annulation",
  },
  it: {
    providerRole: "fornitore di servizi",
    providerProfile: "profilo fornitore",
    providerSettings: "Impostazioni del fornitore di servizi",
    paymentsArea: "Pagamenti",
    payouts: "accrediti",
    stripeOnboarding: "Configurazione Stripe",
    requestedStatus: "richiesta",
    scheduledStatus: "programmata",
    canceledStatus: "annullata",
    paidStatus: "pagata",
    paymentPendingStatus: "pagamento in sospeso",
    awaitingProviderConfirmation: "in attesa di conferma dal fornitore di servizi",
    cancellationCutoff: "termine di cancellazione",
  },
  es: {
    providerRole: "proveedor de servicios",
    providerProfile: "perfil de proveedor",
    providerSettings: "Configuración del proveedor de servicios",
    paymentsArea: "Pagos",
    payouts: "retiros",
    stripeOnboarding: "Configuración de Stripe",
    requestedStatus: "solicitada",
    scheduledStatus: "programada",
    canceledStatus: "cancelada",
    paidStatus: "pagada",
    paymentPendingStatus: "pago pendiente",
    awaitingProviderConfirmation: "en espera de confirmación del proveedor de servicios",
    cancellationCutoff: "plazo de cancelación",
  },
  pt: {
    providerRole: "prestador de serviços",
    providerProfile: "perfil de prestador",
    providerSettings: "Configurações do prestador de serviços",
    paymentsArea: "Pagamentos",
    payouts: "levantamentos",
    stripeOnboarding: "Configuração da Stripe",
    requestedStatus: "solicitada",
    scheduledStatus: "agendada",
    canceledStatus: "cancelada",
    paidStatus: "paga",
    paymentPendingStatus: "pagamento pendente",
    awaitingProviderConfirmation: "a aguardar confirmação do prestador de serviços",
    cancellationCutoff: "prazo de cancelamento",
    avoidTerms: ["fornecedor"],
  },
  pl: {
    providerRole: "usługodawca",
    providerProfile: "profil usługodawcy",
    providerSettings: "Ustawienia usługodawcy",
    paymentsArea: "Płatności",
    payouts: "wypłaty",
    stripeOnboarding: "Konfiguracja Stripe",
    requestedStatus: "oczekująca",
    scheduledStatus: "zaplanowana",
    canceledStatus: "anulowana",
    paidStatus: "opłacona",
    paymentPendingStatus: "płatność oczekująca",
    awaitingProviderConfirmation: "oczekuje na potwierdzenie usługodawcy",
    cancellationCutoff: "termin anulowania",
    avoidTerms: ["dostawca"],
  },
  ro: {
    providerRole: "prestator de servicii",
    providerProfile: "profil de prestator",
    providerSettings: "Setări prestator de servicii",
    paymentsArea: "Plăți",
    payouts: "retrageri",
    stripeOnboarding: "Configurare Stripe",
    requestedStatus: "solicitată",
    scheduledStatus: "programată",
    canceledStatus: "anulată",
    paidStatus: "plătită",
    paymentPendingStatus: "plată în așteptare",
    awaitingProviderConfirmation: "așteaptă confirmarea prestatorului de servicii",
    cancellationCutoff: "termen de anulare",
    avoidTerms: ["furnizor"],
  },
  uk: {
    providerRole: "постачальник послуг",
    providerProfile: "профіль постачальника послуг",
    providerSettings: "Налаштування постачальника послуг",
    paymentsArea: "Платежі",
    payouts: "виплати",
    stripeOnboarding: "Налаштування Stripe",
    requestedStatus: "запитано",
    scheduledStatus: "заплановано",
    canceledStatus: "скасовано",
    paidStatus: "оплачено",
    paymentPendingStatus: "очікує оплати",
    awaitingProviderConfirmation: "очікує підтвердження постачальника послуг",
    cancellationCutoff: "строк скасування",
    avoidTerms: ["надавач"],
  },
};

export function getSupportTerminology(locale: string): SupportTerminology {
  return TERMINOLOGY[normalizeToSupported(locale)];
}

export function formatSupportTerminologyForPrompt(locale: string) {
  const terms = getSupportTerminology(locale);
  const avoid = terms.avoidTerms?.length
    ? `\n- Avoid these locale terms when referring to app UI concepts or statuses: ${terms.avoidTerms.join(
        ", "
      )}.`
    : "";

  return `Locale terminology:
- Use "${terms.providerRole}" for the service-provider role.
- Use "${terms.providerProfile}" or "${terms.providerSettings}" for provider profile/settings UI.
- Use "${terms.paymentsArea}" for the payments section.
- Use "${terms.payouts}" for payouts.
- Use "${terms.stripeOnboarding}" for Stripe onboarding.
- Use localized booking status terms: requested="${terms.requestedStatus}", scheduled="${terms.scheduledStatus}", canceled="${terms.canceledStatus}".
- Use localized payment status terms: paid="${terms.paidStatus}", payment pending="${terms.paymentPendingStatus}".
- Use "${terms.awaitingProviderConfirmation}" for "awaiting provider confirmation".
- Use "${terms.cancellationCutoff}" for the cancellation cutoff/window.
- Do not quote raw English lifecycle labels such as "Requested", "Scheduled", or "Awaiting provider confirmation" in non-English answers.${avoid}`;
}
