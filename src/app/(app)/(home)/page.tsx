"use client";

import { RoleSelectionDialog } from "@/modules/auth/ui/views/onboarding/RoleSelectionDialog";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import LoadingPage from "@/components/shared/loading";

export default function Home() {
  const trpc = useTRPC();

  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
  } = useQuery(trpc.auth.session.queryOptions());

  // Only fetch user profile if user is logged in
  const {
    data: userProfile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery({
    ...trpc.auth.getUserProfile.queryOptions(),
    enabled: !!session?.user, // Only run query if user is logged in
  });

  async function handleRoleSelection(roles: string[]) {
    // Save roles to localStorage for ProfileTabs
    localStorage.setItem("infinisimo_roles", JSON.stringify(roles));
    
    // The onboarding will be marked as completed when the user submits their profile
    // in the ProfileTabs component via updateUserProfile
  }

  // Loading state - only show loading if we're fetching session or profile (when logged in)
  if (sessionLoading || (session?.user && profileLoading)) return <LoadingPage />;

  if (sessionError) return <div>Error loading session: {sessionError.message}</div>;
  if (session?.user && profileError) return <div>Error loading profile: {profileError.message}</div>;

  // If user is logged in but hasn't completed onboarding, show role selection dialog
  if (session?.user && !userProfile?.onboardingCompleted) {
    return <RoleSelectionDialog onSelectAction={handleRoleSelection} />;
  }

  // If user is logged in and has completed onboarding, show the main home page content
  if (session?.user && userProfile?.onboardingCompleted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Infinisimo!
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Discover amazing services and connect with talented professionals.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-2">Find Services</h3>
              <p className="text-gray-600">
                Browse through our curated selection of professional services.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-2">Connect</h3>
              <p className="text-gray-600">
                Connect with service providers and start your projects.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-2">Grow</h3>
              <p className="text-gray-600">
                Build your business and expand your professional network.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If no user is logged in - show public home page
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Infinisimo
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Discover amazing services and connect with talented professionals.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2">Find Services</h3>
            <p className="text-gray-600">
              Browse through our curated selection of professional services.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2">Connect</h3>
            <p className="text-gray-600">
              Connect with service providers and start your projects.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2">Grow</h3>
            <p className="text-gray-600">
              Build your business and expand your professional network.
            </p>
          </div>
        </div>
        <div className="mt-12">
          <p className="text-lg text-gray-600 mb-4">
            Ready to get started? Sign up to access all features.
          </p>
          <button className="bg-black text-white px-8 py-3 rounded-lg hover:bg-pink-400 transition-colors">
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
