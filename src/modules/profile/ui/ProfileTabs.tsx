"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { GeneralProfileForm } from "./GeneralProfileForm";
import { VendorProfileForm } from "./VendorProfileForm";
import ProviderConfirmation from "./ProviderConfirmation";
import PayoutsPanel from "./PayoutsPanel";

type TabKey = "general" | "vendor" | "payouts";

export function ProfileTabs() {
  const tProfile = useTranslations("profile");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const trpc = useTRPC();

  const [tab, setTab] = useState<TabKey>("general");
  const [showProviderConfirmation, setShowProviderConfirmation] =
    useState(false);
  const [wasProviderBefore, setWasProviderBefore] = useState<boolean | null>(
    null
  );

  const { data: userProfile } = useQuery(
    trpc.auth.getUserProfile.queryOptions()
  );

  const { data: vendorProfile } = useQuery(
    trpc.auth.getVendorProfile.queryOptions()
  );

  const isProvider = !!vendorProfile;
  const hasCompletedOnboarding = userProfile?.onboardingCompleted || false;

  const { lat, lng } = userProfile?.coordinates ?? {};
  const hasLocation =
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng);

  const profileTabHref = useCallback(
    (nextTab: TabKey, extra?: Record<string, string | null>) => {
      const query = new URLSearchParams(searchParams.toString());
      query.set("tab", nextTab);

      for (const [key, value] of Object.entries(extra ?? {})) {
        if (value === null) {
          query.delete(key);
        } else {
          query.set(key, value);
        }
      }

      const nextSearch = query.toString();
      return nextSearch ? `${pathname}?${nextSearch}` : pathname;
    },
    [pathname, searchParams]
  );

  useEffect(() => {
    if (wasProviderBefore === null) {
      setWasProviderBefore(isProvider);
    } else if (!wasProviderBefore && isProvider) {
      setWasProviderBefore(true);
    }
  }, [isProvider, wasProviderBefore]);

  useEffect(() => {
    const nextParam = (searchParams.get("tab") as TabKey) ?? "general";

    if (nextParam === "vendor" && !isProvider) {
      setShowProviderConfirmation(true);
    }

    const nextTab: TabKey =
      !isProvider && nextParam === "payouts" ? "general" : nextParam;

    setTab(nextTab);
  }, [searchParams, isProvider]);

  useEffect(() => {
    if (isProvider && showProviderConfirmation) {
      setShowProviderConfirmation(false);
    }
  }, [isProvider, showProviderConfirmation]);

  useEffect(() => {
    const auto = searchParams.get("autopayout");

    if (tab === "vendor" && auto === "1" && isProvider) {
      const timeoutId = setTimeout(() => {
        router.replace(profileTabHref("payouts", { autopayout: null }));
      }, 600);
      return () => clearTimeout(timeoutId);
    }
  }, [tab, isProvider, profileTabHref, router, searchParams]);

  const handleProfileCompletion = (nextIsProvider: boolean) => {
    if (nextIsProvider && wasProviderBefore === false) {
      setTab("vendor");
      router.push(profileTabHref("vendor", { autopayout: null }));
    }
  };

  const handleProviderConfirm = () => {
    setShowProviderConfirmation(false);
  };

  const handleTabChange = (value: string) => {
    if (value === "payouts" && !isProvider) return;

    if (value === "vendor" && !isProvider) {
      setShowProviderConfirmation(true);
    }

    setTab(value as TabKey);
    router.push(profileTabHref(value as TabKey, { autopayout: null }));
  };

  const handleGoToGeneral = () => {
    setTab("general");
    router.push(profileTabHref("general", { autopayout: null }));
  };

  const handleSecondaryAction = () => {
    setTab("general");
    router.push(profileTabHref("general", { autopayout: null }));
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="mb-6 flex w-full max-w-full items-center justify-start gap-1 overflow-x-auto whitespace-nowrap rounded-xl bg-[#F4F4F0] p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:justify-center">
          <TabsTrigger
            value="general"
            className="min-w-[6.5rem] rounded-xl px-3 py-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-lg sm:px-6 sm:py-2 sm:text-sm"
          >
            {tProfile("tabs.general")}
          </TabsTrigger>

          <TabsTrigger
            value="vendor"
            className="min-w-[6.5rem] rounded-xl px-3 py-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-lg sm:px-6 sm:py-2 sm:text-sm"
          >
            {tProfile("tabs.provider")}
          </TabsTrigger>

          {isProvider && (
            <TabsTrigger
              value="payouts"
              className="min-w-[6.5rem] rounded-xl px-3 py-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-lg sm:px-6 sm:py-2 sm:text-sm"
            >
              {tProfile("tabs.payments")}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general">
          <GeneralProfileForm
            onSuccess={() => handleProfileCompletion(isProvider)}
          />
        </TabsContent>

        <TabsContent value="vendor">
          {showProviderConfirmation ? (
            <ProviderConfirmation
              mode={
                !hasCompletedOnboarding || !hasLocation ? "prereq" : "confirm"
              }
              onPrimaryAction={
                !hasCompletedOnboarding || !hasLocation
                  ? handleGoToGeneral
                  : handleProviderConfirm
              }
              onSecondaryAction={handleSecondaryAction}
            />
          ) : (
            <VendorProfileForm />
          )}
        </TabsContent>

        {isProvider && (
          <TabsContent value="payouts">
            <PayoutsPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
