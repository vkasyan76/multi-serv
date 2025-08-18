"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { GeneralProfileForm } from "./GeneralProfileForm";
import { VendorProfileForm } from "./VendorProfileForm";
import ProviderConfirmation from "./ProviderConfirmation";

// Main Tabs Component
export function ProfileTabs() {
  const router = useRouter();
  const trpc = useTRPC();

  const [tab, setTab] = useState<"general" | "vendor">("general");
  const [showProviderConfirmation, setShowProviderConfirmation] = useState(false);

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
    typeof lat === "number" && Number.isFinite(lat) &&
    typeof lng === "number" && Number.isFinite(lng);

  // Read tab from query params on mount safely without useSearchParams
  useEffect(() => {
    // Only run on client side to avoid SSR issues
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const t = urlParams.get("tab");
      if (t === "vendor" || t === "general") {
        setTab(t);
        // If vendor tab is requested and user is not a provider, show confirmation
        if (t === "vendor" && !isProvider) {
          setShowProviderConfirmation(true);
        }
      }
    }
  }, [isProvider, hasCompletedOnboarding]);

  // ✅ Auto-hide confirmation when user becomes a provider
  useEffect(() => {
    if (isProvider && showProviderConfirmation) {
      setShowProviderConfirmation(false);
    }
  }, [isProvider, showProviderConfirmation]);

  // Handle profile completion - just switch tabs
  const handleProfileCompletion = (isProvider: boolean) => {
    if (isProvider) {
      setTab("vendor");
      router.push("/profile?tab=vendor");
    }
    // Success message is handled by the individual forms
  };

  // Handle provider confirmation
  const handleProviderConfirm = () => {
    setShowProviderConfirmation(false);
    // User can now see the vendor form
  };

  // Handle tab change to vendor - show confirmation for non-providers
  const handleTabChange = (value: string) => {
    if (value === "vendor" && !isProvider) {
      setShowProviderConfirmation(true);
    }
    setTab(value as "general" | "vendor");
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
      <Tabs
        value={tab}
        onValueChange={handleTabChange}
      >
        <TabsList className="mb-6 flex justify-center gap-2 bg-[#F4F4F0] rounded-xl w-full">
          <TabsTrigger
            value="general"
            className="px-6 py-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg"
          >
            General Settings
          </TabsTrigger>

          <TabsTrigger
            value="vendor"
            className="px-6 py-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg"
          >
            Service Provider
          </TabsTrigger>
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
              mode={(!hasCompletedOnboarding || !hasLocation) ? "prereq" : "confirm"}
              onPrimaryAction={(!hasCompletedOnboarding || !hasLocation) ? handleGoToGeneral : handleProviderConfirm}
              onSecondaryAction={handleSecondaryAction}
            />
          ) : (
            <VendorProfileForm />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
