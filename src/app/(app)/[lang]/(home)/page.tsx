import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";
import { normalizeToSupported } from "@/lib/i18n/app-lang";

import HomeView from "@/modules/home/ui/HomeView";

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const appLang = normalizeToSupported(lang);
  const qc = getQueryClient();
  // Optional: prefetch initial tenants for instant first paint
  const base = trpc.tenants.getMany.queryOptions({ limit: 24 });
  // Mirror the client locale-scoped key so hydration does not seed the wrong-language cache entry.
  const queryKey = [
    base.queryKey[0],
    { ...(base.queryKey[1] ?? {}), locale: appLang },
  ] as unknown as typeof base.queryKey;
  await qc.prefetchQuery({
    ...base,
    queryKey,
  });

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <HomeView />
    </HydrationBoundary>
  );
}
