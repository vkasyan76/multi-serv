"use client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GeneralProfileForm } from "./GeneralProfileForm";
import { VendorProfileForm } from "./VendorProfileForm";

// Main Tabs Component
export function ProfileTabs({
  showProviderTab = false, // set based on session/user data
}: {
  showProviderTab?: boolean;
}) {
  return (
    <Tabs defaultValue="client" className="w-full max-w-4xl mx-auto mt-12">
      <TabsList className="mb-6 flex justify-center gap-2 bg-[#F4F4F0] rounded-xl w-full ">
        <TabsTrigger
          value="client"
          className="px-6 py-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg"
        >
          General Settings
        </TabsTrigger>
        {showProviderTab && (
          <TabsTrigger
            value="provider"
            className="px-6 py-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg"
          >
            Service Provider
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="client">
        {/* Client (user) profile form */}
        <GeneralProfileForm />
      </TabsContent>
      {showProviderTab && (
        <TabsContent value="provider">
          {/* Service provider (tenant) form */}
          <VendorProfileForm />
        </TabsContent>
      )}
    </Tabs>
  );
}
