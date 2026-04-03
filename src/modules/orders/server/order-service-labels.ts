import "server-only";

import { DEFAULT_APP_LANG, type AppLang } from "@/lib/i18n/app-lang";
import type { Category } from "@/payload-types";
import type { Payload } from "payload";

type SlotServiceLabelInput = {
  id: string;
  serviceSnapshot?: {
    serviceSlug?: string | null;
    serviceName?: string | null;
  } | null;
};

type CategoryDoc = Category & { id: string };

export async function resolveOrderServiceLabels(params: {
  payload: Payload;
  slots: SlotServiceLabelInput[];
  appLang: AppLang;
}): Promise<Map<string, string>> {
  const { payload, slots, appLang } = params;

  const serviceSlugs = Array.from(
    new Set(
      slots
        .map((slot) => slot.serviceSnapshot?.serviceSlug?.trim())
        .filter((slug): slug is string => !!slug),
    ),
  );

  const localizedNameBySlug = new Map<string, string>();

  if (serviceSlugs.length) {
    const categoriesRes = await payload.find({
      collection: "categories",
      where: { slug: { in: serviceSlugs } },
      pagination: false,
      depth: 0,
      overrideAccess: true,
      locale: appLang,
      fallbackLocale: DEFAULT_APP_LANG,
    });

    const categories = (categoriesRes.docs ?? []) as CategoryDoc[];
    for (const category of categories) {
      const slug = category.slug?.trim();
      const name = category.name?.trim();
      if (slug && name) {
        localizedNameBySlug.set(slug, name);
      }
    }
  }

  const labelBySlotId = new Map<string, string>();

  for (const slot of slots) {
    const slotId = slot.id?.trim();
    if (!slotId) continue;

    const slug = slot.serviceSnapshot?.serviceSlug?.trim();
    const snapshotName = slot.serviceSnapshot?.serviceName?.trim();
    const localized = slug ? localizedNameBySlug.get(slug)?.trim() : "";

    if (localized || snapshotName) {
      labelBySlotId.set(slotId, localized || snapshotName || "");
    }
  }

  return labelBySlotId;
}
