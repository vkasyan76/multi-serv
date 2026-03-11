import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_APP_LANG,
  normalizeToSupported,
  type AppLang,
} from "@/lib/i18n/app-lang";
import { LOCALE_COOKIE_NAME } from "@/i18n/routing";

type MessageTree = Record<string, unknown>;
type Loader = () => Promise<MessageTree>;

const COMMON_LOADERS: Partial<Record<AppLang, Loader>> = {
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
};

const BOOKINGS_LOADERS: Partial<Record<AppLang, Loader>> = {
  en: async () => (await import("./messages/en/bookings.json")).default,
  de: async () => (await import("./messages/de/bookings.json")).default,
  fr: async () => (await import("./messages/fr/bookings.json")).default,
  it: async () => (await import("./messages/it/bookings.json")).default,
  es: async () => (await import("./messages/es/bookings.json")).default,
  pt: async () => (await import("./messages/pt/bookings.json")).default,
  pl: async () => (await import("./messages/pl/bookings.json")).default,
  ro: async () => (await import("./messages/ro/bookings.json")).default,
  uk: async () => (await import("./messages/uk/bookings.json")).default,
};

const CHECKOUT_LOADERS: Partial<Record<AppLang, Loader>> = {
  en: async () => (await import("./messages/en/checkout.json")).default,
  de: async () => (await import("./messages/de/checkout.json")).default,
  fr: async () => (await import("./messages/fr/checkout.json")).default,
  it: async () => (await import("./messages/it/checkout.json")).default,
  es: async () => (await import("./messages/es/checkout.json")).default,
  pt: async () => (await import("./messages/pt/checkout.json")).default,
  pl: async () => (await import("./messages/pl/checkout.json")).default,
  ro: async () => (await import("./messages/ro/checkout.json")).default,
  uk: async () => (await import("./messages/uk/checkout.json")).default,
};

const TENANT_PAGE_LOADERS: Partial<Record<AppLang, Loader>> = {
  en: async () => (await import("./messages/en/tenantPage.json")).default,
  de: async () => (await import("./messages/de/tenantPage.json")).default,
  fr: async () => (await import("./messages/fr/tenantPage.json")).default,
  it: async () => (await import("./messages/it/tenantPage.json")).default,
  es: async () => (await import("./messages/es/tenantPage.json")).default,
  pt: async () => (await import("./messages/pt/tenantPage.json")).default,
  pl: async () => (await import("./messages/pl/tenantPage.json")).default,
  ro: async () => (await import("./messages/ro/tenantPage.json")).default,
  uk: async () => (await import("./messages/uk/tenantPage.json")).default,
};

const PROFILE_LOADERS: Partial<Record<AppLang, Loader>> = {
  en: async () => (await import("./messages/en/profile.json")).default,
  de: async () => (await import("./messages/de/profile.json")).default,
  fr: async () => (await import("./messages/fr/profile.json")).default,
  it: async () => (await import("./messages/it/profile.json")).default,
  es: async () => (await import("./messages/es/profile.json")).default,
  pt: async () => (await import("./messages/pt/profile.json")).default,
  pl: async () => (await import("./messages/pl/profile.json")).default,
  ro: async () => (await import("./messages/ro/profile.json")).default,
  uk: async () => (await import("./messages/uk/profile.json")).default,
};

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
  appLang: AppLang,
  loaders: Partial<Record<AppLang, Loader>>,
): Promise<MessageTree> {
  // EN is the fallback baseline and must always exist.
  const enNamespace = await loaders.en!();
  const loader = loaders[appLang];

  if (!loader || appLang === "en") return enNamespace;

  const localizedNamespace = await loader();
  return mergeDeep(enNamespace, localizedNamespace);
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Keep locale precedence aligned with existing middleware/layout behavior.
  const h = await headers();
  const headerLang = h.get("x-app-lang")?.trim();

  const cookieStore = await cookies();
  const cookieLang = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  const routeLocale = await requestLocale;

  const appLang = normalizeToSupported(
    headerLang || cookieLang || routeLocale || DEFAULT_APP_LANG,
  );

  return {
    locale: appLang,
    messages: {
      common: await loadNamespace(appLang, COMMON_LOADERS),
      bookings: await loadNamespace(appLang, BOOKINGS_LOADERS),
      checkout: await loadNamespace(appLang, CHECKOUT_LOADERS),
      tenantPage: await loadNamespace(appLang, TENANT_PAGE_LOADERS),
      profile: await loadNamespace(appLang, PROFILE_LOADERS),
    },
  };
});
