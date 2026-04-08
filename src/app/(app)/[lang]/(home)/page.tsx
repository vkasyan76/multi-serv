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
  const session = await qc.fetchQuery(trpc.auth.session.queryOptions());
  const profile = session.user
    ? await qc.fetchQuery(trpc.auth.getUserProfile.queryOptions())
    : null;

  // Prefetch the same auth/profile-aware homepage query the client will build
  // on first render, so locale switches hydrate the orbit with the right data.
  const viewer =
    typeof profile?.coordinates?.lat === "number" &&
    typeof profile?.coordinates?.lng === "number"
      ? {
          lat: profile.coordinates.lat,
          lng: profile.coordinates.lng,
          city: profile.coordinates.city ?? null,
        }
      : undefined;
  const base = trpc.tenants.getMany.queryOptions(
    buildHomeMarketplaceQueryInput({
      filters: DEFAULT_HOME_MARKETPLACE_FILTERS,
      viewer,
      isSignedIn: !!session.user,
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
      {/* The homepage server prefetch now mirrors the client auth/profile-aware
      query input, so locale switches no longer rely on forced remount hacks. */}
      <HomeView />
    </HydrationBoundary>
  );
}
