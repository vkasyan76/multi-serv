import "server-only";
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_APP_LANG,
  LAUNCHED_APP_LANGS,
  normalizeToSupported,
  type AppLang,
} from "@/lib/i18n/app-lang";
import { LOCALE_COOKIE_NAME } from "@/i18n/routing";

type MessageTree = Record<string, unknown>;
type Loader = () => Promise<MessageTree>;

function normalizeIfLaunched(code?: string | null): AppLang | undefined {
  if (!code) return undefined;

  const short = (code.split(",")[0]?.split(/[-_]/)[0] ?? code)
    .trim()
    .toLowerCase();

  if (!(LAUNCHED_APP_LANGS as readonly string[]).includes(short)) {
    return undefined;
  }

  return normalizeToSupported(code);
}

function withLaunchedLangCoverage(
  namespace: string,
  loaders: Partial<Record<AppLang, Loader>>,
): Record<AppLang, Loader> {
  // Keep imports explicit for predictable bundling, but validate coverage
  // against the launched-language registry so loader maps cannot drift.
  const missing = LAUNCHED_APP_LANGS.filter((lang) => !loaders[lang]);

  if (missing.length > 0) {
    throw new Error(
      `[i18n] Missing loaders for ${namespace}: ${missing.join(", ")}`,
    );
  }

  return loaders as Record<AppLang, Loader>;
}

const COMMON_LOADERS = withLaunchedLangCoverage("common", {
  // Keep launched locales explicit so i18n-check and runtime loading stay in lockstep.
  en: async () => (await import("./messages/en/common.json")).default,
  de: async () => (await import("./messages/de/common.json")).default,
  fr: async () => (await import("./messages/fr/common.json")).default,
  it: async () => (await import("./messages/it/common.json")).default,
  es: async () => (await import("./messages/es/common.json")).default,
  pt: async () => (await import("./messages/pt/common.json")).default,
  pl: async () => (await import("./messages/pl/common.json")).default,
  ro: async () => (await import("./messages/ro/common.json")).default,
  uk: async () => (await import("./messages/uk/common.json")).default,
});

const MARKETPLACE_LOADERS = withLaunchedLangCoverage("marketplace", {
  // Shared listing chrome renders on home + category/subcategory routes, so
  // keep this namespace available anywhere the marketplace surface can appear.
  en: async () => (await import("./messages/en/marketplace.json")).default,
  de: async () => (await import("./messages/de/marketplace.json")).default,
  fr: async () => (await import("./messages/fr/marketplace.json")).default,
  it: async () => (await import("./messages/it/marketplace.json")).default,
  es: async () => (await import("./messages/es/marketplace.json")).default,
  pt: async () => (await import("./messages/pt/marketplace.json")).default,
  pl: async () => (await import("./messages/pl/marketplace.json")).default,
  ro: async () => (await import("./messages/ro/marketplace.json")).default,
  uk: async () => (await import("./messages/uk/marketplace.json")).default,
});

const BOOKINGS_LOADERS = withLaunchedLangCoverage("bookings", {
  en: async () => (await import("./messages/en/bookings.json")).default,
  de: async () => (await import("./messages/de/bookings.json")).default,
  fr: async () => (await import("./messages/fr/bookings.json")).default,
  it: async () => (await import("./messages/it/bookings.json")).default,
  es: async () => (await import("./messages/es/bookings.json")).default,
  pt: async () => (await import("./messages/pt/bookings.json")).default,
  pl: async () => (await import("./messages/pl/bookings.json")).default,
  ro: async () => (await import("./messages/ro/bookings.json")).default,
  uk: async () => (await import("./messages/uk/bookings.json")).default,
});

const CHECKOUT_LOADERS = withLaunchedLangCoverage("checkout", {
  en: async () => (await import("./messages/en/checkout.json")).default,
  de: async () => (await import("./messages/de/checkout.json")).default,
  fr: async () => (await import("./messages/fr/checkout.json")).default,
  it: async () => (await import("./messages/it/checkout.json")).default,
  es: async () => (await import("./messages/es/checkout.json")).default,
  pt: async () => (await import("./messages/pt/checkout.json")).default,
  pl: async () => (await import("./messages/pl/checkout.json")).default,
  ro: async () => (await import("./messages/ro/checkout.json")).default,
  uk: async () => (await import("./messages/uk/checkout.json")).default,
});

const TENANT_PAGE_LOADERS = withLaunchedLangCoverage("tenantPage", {
  en: async () => (await import("./messages/en/tenantPage.json")).default,
  de: async () => (await import("./messages/de/tenantPage.json")).default,
  fr: async () => (await import("./messages/fr/tenantPage.json")).default,
  it: async () => (await import("./messages/it/tenantPage.json")).default,
  es: async () => (await import("./messages/es/tenantPage.json")).default,
  pt: async () => (await import("./messages/pt/tenantPage.json")).default,
  pl: async () => (await import("./messages/pl/tenantPage.json")).default,
  ro: async () => (await import("./messages/ro/tenantPage.json")).default,
  uk: async () => (await import("./messages/uk/tenantPage.json")).default,
});

const PROFILE_LOADERS = withLaunchedLangCoverage("profile", {
  en: async () => (await import("./messages/en/profile.json")).default,
  de: async () => (await import("./messages/de/profile.json")).default,
  fr: async () => (await import("./messages/fr/profile.json")).default,
  it: async () => (await import("./messages/it/profile.json")).default,
  es: async () => (await import("./messages/es/profile.json")).default,
  pt: async () => (await import("./messages/pt/profile.json")).default,
  pl: async () => (await import("./messages/pl/profile.json")).default,
  ro: async () => (await import("./messages/ro/profile.json")).default,
  uk: async () => (await import("./messages/uk/profile.json")).default,
});

const FINANCE_LOADERS = withLaunchedLangCoverage("finance", {
  en: async () => (await import("./messages/en/finance.json")).default,
  de: async () => (await import("./messages/de/finance.json")).default,
  fr: async () => (await import("./messages/fr/finance.json")).default,
  it: async () => (await import("./messages/it/finance.json")).default,
  es: async () => (await import("./messages/es/finance.json")).default,
  pt: async () => (await import("./messages/pt/finance.json")).default,
  pl: async () => (await import("./messages/pl/finance.json")).default,
  ro: async () => (await import("./messages/ro/finance.json")).default,
  uk: async () => (await import("./messages/uk/finance.json")).default,
});

const DASHBOARD_LOADERS = withLaunchedLangCoverage("dashboard", {
  en: async () => (await import("./messages/en/dashboard.json")).default,
  de: async () => (await import("./messages/de/dashboard.json")).default,
  fr: async () => (await import("./messages/fr/dashboard.json")).default,
  it: async () => (await import("./messages/it/dashboard.json")).default,
  es: async () => (await import("./messages/es/dashboard.json")).default,
  pt: async () => (await import("./messages/pt/dashboard.json")).default,
  pl: async () => (await import("./messages/pl/dashboard.json")).default,
  ro: async () => (await import("./messages/ro/dashboard.json")).default,
  uk: async () => (await import("./messages/uk/dashboard.json")).default,
});

const ORDERS_LOADERS = withLaunchedLangCoverage("orders", {
  en: async () => (await import("./messages/en/orders.json")).default,
  de: async () => (await import("./messages/de/orders.json")).default,
  fr: async () => (await import("./messages/fr/orders.json")).default,
  it: async () => (await import("./messages/it/orders.json")).default,
  es: async () => (await import("./messages/es/orders.json")).default,
  pt: async () => (await import("./messages/pt/orders.json")).default,
  pl: async () => (await import("./messages/pl/orders.json")).default,
  ro: async () => (await import("./messages/ro/orders.json")).default,
  uk: async () => (await import("./messages/uk/orders.json")).default,
});

const REVIEWS_LOADERS = withLaunchedLangCoverage("reviews", {
  en: async () => (await import("./messages/en/reviews.json")).default,
  de: async () => (await import("./messages/de/reviews.json")).default,
  fr: async () => (await import("./messages/fr/reviews.json")).default,
  it: async () => (await import("./messages/it/reviews.json")).default,
  es: async () => (await import("./messages/es/reviews.json")).default,
  pt: async () => (await import("./messages/pt/reviews.json")).default,
  pl: async () => (await import("./messages/pl/reviews.json")).default,
  ro: async () => (await import("./messages/ro/reviews.json")).default,
  uk: async () => (await import("./messages/uk/reviews.json")).default,
});

const LEGAL_TERMS_LOADERS = withLaunchedLangCoverage("legalTerms", {
  en: async () => (await import("./messages/en/legalTerms.json")).default,
  de: async () => (await import("./messages/de/legalTerms.json")).default,
  fr: async () => (await import("./messages/fr/legalTerms.json")).default,
  it: async () => (await import("./messages/it/legalTerms.json")).default,
  es: async () => (await import("./messages/es/legalTerms.json")).default,
  pt: async () => (await import("./messages/pt/legalTerms.json")).default,
  pl: async () => (await import("./messages/pl/legalTerms.json")).default,
  ro: async () => (await import("./messages/ro/legalTerms.json")).default,
  uk: async () => (await import("./messages/uk/legalTerms.json")).default,
});

const SUPPORT_CHAT_LOADERS = withLaunchedLangCoverage("supportChat", {
  en: async () => (await import("./messages/en/supportChat.json")).default,
  de: async () => (await import("./messages/de/supportChat.json")).default,
  fr: async () => (await import("./messages/fr/supportChat.json")).default,
  it: async () => (await import("./messages/it/supportChat.json")).default,
  es: async () => (await import("./messages/es/supportChat.json")).default,
  pt: async () => (await import("./messages/pt/supportChat.json")).default,
  pl: async () => (await import("./messages/pl/supportChat.json")).default,
  ro: async () => (await import("./messages/ro/supportChat.json")).default,
  uk: async () => (await import("./messages/uk/supportChat.json")).default,
});

const SUPPORT_CHAT_ADMIN_LOADERS = withLaunchedLangCoverage("supportChatAdmin", {
  en: async () => (await import("./messages/en/supportChatAdmin.json")).default,
  de: async () => (await import("./messages/de/supportChatAdmin.json")).default,
  fr: async () => (await import("./messages/fr/supportChatAdmin.json")).default,
  it: async () => (await import("./messages/it/supportChatAdmin.json")).default,
  es: async () => (await import("./messages/es/supportChatAdmin.json")).default,
  pt: async () => (await import("./messages/pt/supportChatAdmin.json")).default,
  pl: async () => (await import("./messages/pl/supportChatAdmin.json")).default,
  ro: async () => (await import("./messages/ro/supportChatAdmin.json")).default,
  uk: async () => (await import("./messages/uk/supportChatAdmin.json")).default,
});

function isPlainObject(value: unknown): value is MessageTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDeep(base: MessageTree, override: MessageTree): MessageTree {
  const out: MessageTree = { ...base };

  for (const key of Object.keys(override)) {
    const baseVal = out[key];
    const overrideVal = override[key];

    if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
      out[key] = mergeDeep(baseVal, overrideVal);
    } else {
      out[key] = overrideVal;
    }
  }

  return out;
}

async function loadNamespace(
  namespace: string,
  appLang: AppLang,
  loaders: Partial<Record<AppLang, Loader>>,
): Promise<MessageTree> {
  // EN is the fallback baseline and must always exist.
  const enNamespace = await loaders.en!();
  const loader = loaders[appLang];

  if (!loader || appLang === "en") return enNamespace;

  try {
    const localizedNamespace = await loader();
    return mergeDeep(enNamespace, localizedNamespace);
  } catch (error) {
    // Keep the EN fallback behavior, but log enough context to make broken or
    // missing localized bundles observable in runtime logs.
    console.error("[i18n] Falling back to en namespace", {
      namespace,
      appLang,
      error: error instanceof Error ? error.message : String(error),
    });
    return enNamespace;
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Keep locale precedence aligned with existing middleware/layout behavior.
  const h = await headers();
  const headerLang = h.get("x-app-lang")?.trim();

  const cookieStore = await cookies();
  const cookieLang = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  const routeLocale = await requestLocale;

  // Apply precedence across valid launched locales only so invalid
  // header/cookie values cannot collapse early to the default and mask a valid
  // lower-priority source such as the route locale.
  const appLang =
    normalizeIfLaunched(headerLang) ??
    normalizeIfLaunched(cookieLang) ??
    normalizeIfLaunched(routeLocale) ??
    DEFAULT_APP_LANG;

  const [
    common,
    marketplace,
    bookings,
    checkout,
    tenantPage,
    profile,
    finance,
    dashboard,
    orders,
    reviews,
    legalTerms,
    supportChat,
    supportChatAdmin,
  ] = await Promise.all([
    loadNamespace("common", appLang, COMMON_LOADERS),
    loadNamespace("marketplace", appLang, MARKETPLACE_LOADERS),
    loadNamespace("bookings", appLang, BOOKINGS_LOADERS),
    loadNamespace("checkout", appLang, CHECKOUT_LOADERS),
    loadNamespace("tenantPage", appLang, TENANT_PAGE_LOADERS),
    loadNamespace("profile", appLang, PROFILE_LOADERS),
    loadNamespace("finance", appLang, FINANCE_LOADERS),
    loadNamespace("dashboard", appLang, DASHBOARD_LOADERS),
    loadNamespace("orders", appLang, ORDERS_LOADERS),
    loadNamespace("reviews", appLang, REVIEWS_LOADERS),
    loadNamespace("legalTerms", appLang, LEGAL_TERMS_LOADERS),
    loadNamespace("supportChat", appLang, SUPPORT_CHAT_LOADERS),
    loadNamespace("supportChatAdmin", appLang, SUPPORT_CHAT_ADMIN_LOADERS),
  ]);

  return {
    locale: appLang,
    timeZone: "Europe/Berlin",
    messages: {
      common,
      marketplace,
      bookings,
      checkout,
      tenantPage,
      profile,
      finance,
      dashboard,
      orders,
      reviews,
      legalTerms,
      supportChat,
      supportChatAdmin,
    },
  };
});
