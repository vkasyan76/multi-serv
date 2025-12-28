"use client";

import { useMemo } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TERMS_VERSION } from "@/constants";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

export function TermsConsent() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();

  const profileQuery = trpc.auth.getUserProfile.queryOptions();
  const profile = useQuery(profileQuery);

  const acceptedAt = profile.data?.policyAcceptedAt ?? null;

  const serverPolicyOk =
    profile.data?.policyAcceptedVersion === TERMS_VERSION && !!acceptedAt;

  const needsAcceptance =
    profile.isSuccess && !!profile.data && !serverPolicyOk;

  const acceptedAtLabel = useMemo(() => {
    if (!acceptedAt) return null;
    const d = new Date(acceptedAt);
    if (!isFinite(d.getTime())) return acceptedAt;
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }, [acceptedAt]);

  const acceptPolicy = useMutation({
    ...trpc.legal.acceptPolicy.mutationOptions(),
    onSuccess: async () => {
      toast.success("Terms accepted.");
      await qc.invalidateQueries({ queryKey: profileQuery.queryKey });
    },
    onError: () => {
      toast.error("Could not record acceptance. Please try again.");
    },
  });

  // If user is signed in and already accepted -> show confirmation (no buttons)
  if (profile.isSuccess && profile.data && serverPolicyOk) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="p-4 sm:p-5">
          <p className="text-sm text-center text-muted-foreground">
            You accepted these Terms on{" "}
            <span className="font-medium text-foreground">
              {acceptedAtLabel ?? "—"}
            </span>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  // Not signed in or session not ready -> no CTA
  if (!needsAcceptance) return null;

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-2 sm:p-4 space-y-3">
        <p className="text-sm text-center leading-relaxed max-w-[52ch] mx-auto">
          Platform bookings and checkout functions require your acceptance. All
          Service Providers are required to accept these Terms to offer services
          through the platform.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-8">
          <Button
            className="w-full sm:w-auto sm:min-w-32 bg-black text-white hover:bg-pink-400 hover:text-primary"
            onClick={() => acceptPolicy.mutate()}
            disabled={acceptPolicy.isPending}
          >
            Accept
          </Button>

          <Button
            className="w-full sm:w-auto sm:min-w-32"
            variant="outline"
            onClick={() => router.push("/")}
            disabled={acceptPolicy.isPending}
          >
            Decline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
