"use client";

import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, UserRound } from "lucide-react";

type Customer = {
  firstName?: string | null;
  lastName?: string | null;
  location?: string | null; // your “address line”
  country?: string | null;
};

type Props = {
  hasUser: boolean;
  customerReady: boolean;
  customerOk: boolean;
  profileHref: string;
  customer: Customer | null;
};

function lineOrDash(v: string) {
  const s = v.trim();
  return s.length ? s : "—";
}

export function CartDrawerCustomerInfo({
  hasUser,
  customerReady,
  customerOk,
  profileHref,
  customer,
}: Props) {
  if (!hasUser) return null;

  // Loading / not yet available: keep it neutral (no Alert)
  if (!customerReady) {
    return (
      <div className="mb-3 rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <UserRound className="h-4 w-4" />
          <span>Invoice address</span>
        </div>
        <div className="mt-1 text-muted-foreground">Loading profile…</div>
      </div>
    );
  }

  // Incomplete onboarding: THIS is when Alert is appropriate
  if (!customerOk) {
    return (
      <Alert className="mb-3">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Invoice address required</AlertTitle>
        <AlertDescription>
          Please complete onboarding (name and address) in your{" "}
          <Link
            className="underline font-medium"
            href={profileHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            profile
          </Link>{" "}
          before checkout.
        </AlertDescription>
      </Alert>
    );
  }

  // Onboarding completed: show clean invoice block (not Alert)
  if (!customer) return null;

  const fullName = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const addressLine = customer.location ?? "";
  const countryLine =
    !customer.location && customer.country ? customer.country : "";

  return (
    <div className="mb-3 rounded-lg border bg-white/70 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <UserRound className="h-4 w-4" />
          <span>Invoice address</span>
        </div>

        <Link
          href={profileHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline text-muted-foreground hover:text-foreground"
        >
          Edit
        </Link>
      </div>

      <div className="mt-2 space-y-0.5">
        <div className="font-medium">{lineOrDash(fullName || "")}</div>
        <div className="text-muted-foreground">{lineOrDash(addressLine)}</div>
        {countryLine ? (
          <div className="text-muted-foreground">{countryLine}</div>
        ) : null}
      </div>
    </div>
  );
}
