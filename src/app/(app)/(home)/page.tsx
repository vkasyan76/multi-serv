"use client";

// import { RoleSelection } from "@/modules/auth/ui/views/onboarding/RoleSelection";
import { RoleSelectionDialog } from "@/modules/auth/ui/views/onboarding/RoleSelectionDialog";
import { useTRPC } from "@/trpc/client";
// import { useSuspenseQuery } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const trpc = useTRPC();

  const { data: session, isLoading } = useQuery(
    trpc.auth.session.queryOptions()
  );

  // function handleRoleSelection(role: string) {
  //   alert("Selected role: " + role);
  //   // In the real flow, you will call a mutation here!
  // }

  function handleRoleSelection(roles: string[]) {
    alert("Selected roles: " + roles.join(", "));
  }

  // Loading state
  if (isLoading) return <div>Loading...</div>;

  // If user is logged in but hasn't selected a role, show onboarding
  if (session?.user) {
    return <RoleSelectionDialog onSelectAction={handleRoleSelection} />;
  }

  return <div>{JSON.stringify(session?.user, null, 2)}</div>;
}
