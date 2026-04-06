import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";
import { normalizeToSupported } from "@/lib/i18n/app-lang";

import HomeView from "@/modules/home/ui/HomeView";
import { ReferralNoticeBanner } from "@/modules/home/ui/components/referral-notice-banner";
import {
  DEFAULT_HOME_MARKETPLACE_FILTERS,
  buildHomeMarketplaceQueryInput,
} from "@/modules/home/ui/home-marketplace-filters";

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const appLang = normalizeToSupported(lang);
  const qc = getQueryClient();
  const base = trpc.tenants.getMany.queryOptions(
    buildHomeMarketplaceQueryInput({
      filters: DEFAULT_HOME_MARKETPLACE_FILTERS,
      viewer: undefined,
      isSignedIn: false,
      limit: 24,
    })
  );
  // Mirror the client locale-scoped key so hydration does not seed the wrong-language cache entry.
  const queryKey = [
    base.queryKey[0],
    { ...(base.queryKey[1] ?? {}), locale: appLang },
  ] as unknown as typeof base.queryKey;
  await Promise.all([
    qc.prefetchQuery({
      ...base,
      queryKey,
    }),
    qc.prefetchQuery(trpc.categories.getAvailableForHomepage.queryOptions()),
  ]);

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <ReferralNoticeBanner />
      <HomeView />
    </HydrationBoundary>
  );
}
