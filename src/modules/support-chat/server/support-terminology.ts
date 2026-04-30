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
  },
  de: {
    providerRole: "Dienstleister",
    providerProfile: "Dienstleisterprofil",
    providerSettings: "Dienstleister-Einstellungen",
    paymentsArea: "Zahlungen",
    payouts: "Auszahlungen",
    stripeOnboarding: "Stripe-Einrichtung",
    avoidTerms: ["Provider-Profil", "Provider", "Anbieterprofil"],
  },
  fr: {
    providerRole: "prestataire",
    providerProfile: "profil prestataire",
    providerSettings: "Paramètres du prestataire",
    paymentsArea: "Paiements",
    payouts: "versements",
    stripeOnboarding: "Configuration Stripe",
  },
  it: {
    providerRole: "fornitore di servizi",
    providerProfile: "profilo fornitore",
    providerSettings: "Impostazioni del fornitore di servizi",
    paymentsArea: "Pagamenti",
    payouts: "accrediti",
    stripeOnboarding: "Configurazione Stripe",
  },
  es: {
    providerRole: "proveedor de servicios",
    providerProfile: "perfil de proveedor",
    providerSettings: "Configuración del proveedor de servicios",
    paymentsArea: "Pagos",
    payouts: "retiros",
    stripeOnboarding: "Configuración de Stripe",
  },
  pt: {
    providerRole: "prestador de serviços",
    providerProfile: "perfil de prestador",
    providerSettings: "Configurações do prestador de serviços",
    paymentsArea: "Pagamentos",
    payouts: "levantamentos",
    stripeOnboarding: "Configuração da Stripe",
    avoidTerms: ["fornecedor"],
  },
  pl: {
    providerRole: "usługodawca",
    providerProfile: "profil usługodawcy",
    providerSettings: "Ustawienia usługodawcy",
    paymentsArea: "Płatności",
    payouts: "wypłaty",
    stripeOnboarding: "Konfiguracja Stripe",
    avoidTerms: ["dostawca"],
  },
  ro: {
    providerRole: "prestator de servicii",
    providerProfile: "profil de prestator",
    providerSettings: "Setări prestator de servicii",
    paymentsArea: "Plăți",
    payouts: "retrageri",
    stripeOnboarding: "Configurare Stripe",
    avoidTerms: ["furnizor"],
  },
  uk: {
    providerRole: "постачальник послуг",
    providerProfile: "профіль постачальника послуг",
    providerSettings: "Налаштування постачальника послуг",
    paymentsArea: "Платежі",
    payouts: "виплати",
    stripeOnboarding: "Налаштування Stripe",
    avoidTerms: ["надавач"],
  },
};

export function getSupportTerminology(locale: string): SupportTerminology {
  return TERMINOLOGY[normalizeToSupported(locale)];
}

export function formatSupportTerminologyForPrompt(locale: string) {
  const terms = getSupportTerminology(locale);
  const avoid = terms.avoidTerms?.length
    ? `\n- Avoid these locale terms when referring to app UI concepts: ${terms.avoidTerms.join(
        ", "
      )}.`
    : "";

  return `Locale terminology:
- Use "${terms.providerRole}" for the service-provider role.
- Use "${terms.providerProfile}" or "${terms.providerSettings}" for provider profile/settings UI.
- Use "${terms.paymentsArea}" for the payments section.
- Use "${terms.payouts}" for payouts.
- Use "${terms.stripeOnboarding}" for Stripe onboarding.${avoid}`;
}
