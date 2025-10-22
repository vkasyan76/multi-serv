"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { GeneralProfileForm } from "./GeneralProfileForm";
import { VendorProfileForm } from "./VendorProfileForm";
import ProviderConfirmation from "./ProviderConfirmation";

import PayoutsPanel from "./PayoutsPanel";

type TabKey = "general" | "vendor" | "payouts";

// Main Tabs Component
export function ProfileTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const trpc = useTRPC();

  const [tab, setTab] = useState<TabKey>("general");
  const [showProviderConfirmation, setShowProviderConfirmation] =
    useState(false);
  const [wasProviderBefore, setWasProviderBefore] = useState<boolean | null>(
    null
  );

  // Fetch both user profile and vendor profile from database
  const { data: userProfile } = useQuery(
    trpc.auth.getUserProfile.queryOptions()
  );

  const { data: vendorProfile } = useQuery(
    trpc.auth.getVendorProfile.queryOptions()
  );

  // Determine provider status from database state
  const isProvider = !!vendorProfile;
  const hasCompletedOnboarding = userProfile?.onboardingCompleted || false;

  // Robust location check that accepts 0 as valid coordinates
  const { lat, lng } = userProfile?.coordinates ?? {};
  const hasLocation =
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng);

  // Track provider state changes
  useEffect(() => {
    if (wasProviderBefore === null) {
      // Initial load - set the current state
      setWasProviderBefore(isProvider);
    } else if (!wasProviderBefore && isProvider) {
      // User just became a provider
      setWasProviderBefore(true);
    }
  }, [isProvider, wasProviderBefore]);

  // Read tab from query params on mount safely without useSearchParams
  useEffect(() => {
    const t = (searchParams.get("tab") as TabKey) ?? "general";

    if (t === "vendor" && !isProvider) {
      setShowProviderConfirmation(true);
    }

    // Block payouts if not a provider; otherwise respect URL
    const nextTab: TabKey = !isProvider && t === "payouts" ? "general" : t;

    setTab(nextTab);
  }, [searchParams, isProvider]);

  // ✅ Auto-hide confirmation when user becomes a provider
  useEffect(() => {
    if (isProvider && showProviderConfirmation) {
      setShowProviderConfirmation(false);
    }
  }, [isProvider, showProviderConfirmation]);

  // Auto-redirect to payouts if "autopayout=1" is in URL and user is a provider
  // Only auto-redirect after vendor exists (isProvider) and we are on vendor tab
  useEffect(() => {
    const auto = searchParams.get("autopayout");

    if (tab === "vendor" && auto === "1" && isProvider) {
      const t = setTimeout(() => {
        router.replace("/profile?tab=payouts");
      }, 600);
      return () => clearTimeout(t);
    }
  }, [tab, isProvider, router, searchParams]);

  // Handle profile completion - only redirect when user becomes a provider for the first time
  const handleProfileCompletion = (isProvider: boolean) => {
    // Only redirect to vendor tab if user just became a provider (wasn't one before)
    if (isProvider && wasProviderBefore === false) {
      setTab("vendor");
      router.push("/profile?tab=vendor");
    }
    // If user is already a provider, stay on current tab
    // Success message is handled by the individual forms
  };

  // Handle provider confirmation
  const handleProviderConfirm = () => {
    setShowProviderConfirmation(false);
    // User can now see the vendor form
  };

  // Handle tab change to vendor - show confirmation for non-providers - vendors see payouts tab
  const handleTabChange = (value: string) => {
    if (value === "payouts" && !isProvider) return;

    if (value === "vendor" && !isProvider) {
      setShowProviderConfirmation(true);
    }

    setTab(value as TabKey);

    // push URL so other links (and reloads) reflect current tab
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    url.searchParams.delete("autopayout"); // don’t carry autopayout around
    router.push(url.pathname + "?" + url.searchParams.toString());
  };

  // Handle navigation to general settings
  const handleGoToGeneral = () => {
    setTab("general");
    router.push("/profile?tab=general");
  };

  // Handle secondary actions - go back to general settings tab
  const handleSecondaryAction = () => {
    setTab("general");
    router.push("/profile?tab=general");
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="mb-6 flex w-full max-w-full items-center justify-start sm:justify-center gap-1 overflow-x-auto whitespace-nowrap rounded-xl bg-[#F4F4F0] p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger
            value="general"
            className="px-3 py-1.5 text-xs sm:px-6 sm:py-2 sm:text-sm rounded-xl min-w-[6.5rem] data-[state=active]:bg-white data-[state=active]:shadow-lg"
          >
            General Settings
          </TabsTrigger>

          <TabsTrigger
            value="vendor"
            className="px-3 py-1.5 text-xs sm:px-6 sm:py-2 sm:text-sm rounded-xl min-w-[6.5rem] data-[state=active]:bg-white data-[state=active]:shadow-lg"
          >
            Service Provider
          </TabsTrigger>

          {isProvider && (
            <TabsTrigger
              value="payouts"
              className="px-3 py-1.5 text-xs sm:px-6 sm:py-2 sm:text-sm rounded-xl min-w-[6.5rem] data-[state=active]:bg-white data-[state=active]:shadow-lg"
            >
              Payments
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general">
          {/* Client (user) profile form */}
          <GeneralProfileForm
            onSuccess={() => handleProfileCompletion(isProvider)}
          />
        </TabsContent>

        <TabsContent value="vendor">
          {/* Show confirmation for ALL non-providers, form only for existing providers */}
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
