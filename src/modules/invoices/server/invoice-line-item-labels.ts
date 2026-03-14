import "server-only";

import { DEFAULT_APP_LANG, type AppLang } from "@/lib/i18n/app-lang";
import type { Booking, Category } from "@/payload-types";
import type { Payload } from "payload";

type InvoiceLineItemLabelInput = {
  slotId?: string | null;
  title?: string | null;
};

type BookingDoc = Booking & { id: string };
type CategoryDoc = Category & { id: string };

export async function resolveInvoiceLineItemLabels(params: {
  payload: Payload;
  lineItems: InvoiceLineItemLabelInput[];
  appLang: AppLang;
}): Promise<string[]> {
  const { payload, lineItems, appLang } = params;

  const slotIds = Array.from(
    new Set(
      lineItems
        .map((li) => li.slotId?.trim())
        .filter((slotId): slotId is string => !!slotId),
    ),
  );

  if (!slotIds.length) {
    return lineItems.map((li) => li.title?.trim() ?? "");
  }

  const bookingsRes = await payload.find({
    collection: "bookings",
    where: { id: { in: slotIds } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });

  const bookings = (bookingsRes.docs ?? []) as BookingDoc[];
  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  const serviceSlugs = Array.from(
    new Set(
      bookings
        .map((b) => b.serviceSnapshot?.serviceSlug?.trim())
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

  return lineItems.map((li) => {
    const slotId = li.slotId?.trim();
    const booking = slotId ? bookingById.get(slotId) : undefined;
    const serviceSlug = booking?.serviceSnapshot?.serviceSlug?.trim();
    const snapshotName = booking?.serviceSnapshot?.serviceName?.trim();
    const localized = serviceSlug
      ? localizedNameBySlug.get(serviceSlug)?.trim()
      : "";

    return localized || snapshotName || li.title?.trim() || "";
  });
}
