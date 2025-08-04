"use client";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GeneralProfileForm } from "./GeneralProfileForm";
import { VendorProfileForm } from "./VendorProfileForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

// Main Tabs Component
export function ProfileTabs() {
  const router = useRouter();
  const trpc = useTRPC();
  
  // Get roles from localStorage
  const [roles, setRoles] = useState<string[]>([]);
  const [showProviderForm, setShowProviderForm] = useState(false);
  // Track Selected Tab
  const [tab, setTab] = useState<"client" | "provider">("client");

  const [showDialog, setShowDialog] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  // Check if user has already completed onboarding
  const { data: userProfile } = useQuery(trpc.auth.getUserProfile.queryOptions());
  
  // load roles from localStorage on mount
  useEffect(() => {
    const storedRoles = localStorage.getItem("infinisimo_roles");
    let parsedRoles: string[] = [];
    if (storedRoles) {
      parsedRoles = JSON.parse(storedRoles);
    } else {
      parsedRoles = []; // <-- no auto-assignment
    }
    setRoles(parsedRoles);
    setShowProviderForm(
      storedRoles && JSON.parse(storedRoles).includes("provider")
    );
  }, []);

  useEffect(() => {
    // When user switches to the "provider" tab, and is NOT a provider yet, show dialog
    if (
      tab === "provider" &&
      !roles.includes("provider") &&
      !showProviderForm
    ) {
      setShowDialog(true);
    }
  }, [tab, roles, showProviderForm]);

  const handleBecomeProvider = () => {
    const newRoles = Array.from(new Set([...roles, "provider"]));
    setRoles(newRoles);
    localStorage.setItem("infinisimo_roles", JSON.stringify(newRoles));
    setShowProviderForm(true);
    setShowDialog(false);
  };

  // Called when user says maybe later
  const handleMaybeLater = () => {
    setShowProviderForm(false);
    setShowDialog(false);
    setTab("client"); // <-- Switch back to General tab
  };

  // Handle profile completion success
  const handleProfileCompletion = (isProvider: boolean) => {
    // Only show success message if user hasn't completed onboarding before
    if (!userProfile?.onboardingCompleted) {
      if (isProvider) {
        setSuccessMessage("Great! Your user profile is complete. Now let's set up your Service Provider profile to start offering your services.");
        setTab("provider");
      } else {
        setSuccessMessage("Perfect! Your profile is now complete. You can become a Service Provider anytime by visiting your Profile settings.");
        // Redirect to home page after 4 seconds to ensure query cache is updated
        setTimeout(() => {
          router.push("/");
        }, 5000);
      }
      setShowSuccessMessage(true);
    }
  };

  // Auto-hide success message after 5 seconds
  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  return (
    <div className="w-full max-w-4xl mx-auto mt-12">
      {/* Success Message */}
      {showSuccessMessage && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "client" | "provider")}
        className="w-full"
      >
        <TabsList className="mb-6 flex justify-center gap-2 bg-[#F4F4F0] rounded-xl w-full ">
          <TabsTrigger
            value="client"
            className="px-6 py-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg"
          >
            General Settings
          </TabsTrigger>

          <TabsTrigger
            value="provider"
            className="px-6 py-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg"
          >
            Service Provider
          </TabsTrigger>
        </TabsList>
        <TabsContent value="client">
          {/* Client (user) profile form */}
          <GeneralProfileForm onSuccess={() => handleProfileCompletion(roles.includes("provider"))} />
        </TabsContent>{" "}
        <TabsContent value="provider">
          {/* Show dialog if user is NOT a provider */}

          {!showProviderForm && showDialog && (
            <div className="flex items-center justify-center w-full min-h-[400px]">
              <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-6 shadow-xl w-full max-w-md border">
                <h2 className="text-xl font-bold mb-2">
                  Ready to a become a service provider?
                </h2>
                <p className="text-gray-600 mb-4 text-center">
                  To offer services, complete your provider profile.
                </p>
                <div className="flex gap-4 justify-center w-full">
                  <button
                    className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-pink-400"
                    onClick={handleBecomeProvider}
                  >
                    Complete now
                  </button>
                  <button
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    onClick={handleMaybeLater}
                  >
                    Maybe later
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Only show form if user confirmed */}
          {showProviderForm && <VendorProfileForm />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
