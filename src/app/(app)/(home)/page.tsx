"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import LoadingPage from "@/components/shared/loading";
import Link from "next/link";

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

  // Loading state - only show loading if we're fetching session or profile (when logged in)
  if (sessionLoading || (session?.user && profileLoading)) return <LoadingPage />;

  if (sessionError) return <div>Error loading session: {sessionError.message}</div>;
  if (session?.user && profileError) return <div>Error loading profile: {profileError.message}</div>;

  // If user is logged in, show the main home page content immediately
  if (session?.user) {
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
          
          {/* NEW: Gentle profile completion prompt - guides without blocking */}
          {!userProfile?.onboardingCompleted && (
            <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Complete Your Profile
              </h3>
              <p className="text-blue-700 mb-4">
                Set up your profile to get the most out of Infinisimo.
              </p>
              <Link 
                href="/profile" 
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Profile
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Public home page for non-authenticated users
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
