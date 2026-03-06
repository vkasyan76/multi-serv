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
  // Phase 3 (Commit 1): start with launched locales; EN remains canonical fallback.
  en: async () => (await import("./messages/en/common.json")).default,
  de: async () => (await import("./messages/de/common.json")).default,
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

async function loadCommon(appLang: AppLang): Promise<MessageTree> {
  // EN is the fallback baseline and must always exist.
  const enCommon = await COMMON_LOADERS.en!();
  const loader = COMMON_LOADERS[appLang];

  if (!loader || appLang === "en") return enCommon;

  const localizedCommon = await loader();
  return mergeDeep(enCommon, localizedCommon);
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
      common: await loadCommon(appLang),
    },
  };
});
