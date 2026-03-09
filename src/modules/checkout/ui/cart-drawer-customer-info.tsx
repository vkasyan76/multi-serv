"use client";

import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

type Customer = {
  firstName?: string | null;
  lastName?: string | null;
  location?: string | null;
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
  return s.length ? s : "-";
}

export function CartDrawerCustomerInfo({
  hasUser,
  customerReady,
  customerOk,
  profileHref,
  customer,
}: Props) {
  const tCheckout = useTranslations("checkout");

  if (!hasUser) return null;

  if (!customerReady) {
    return (
      <div className="mb-3 rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <UserRound className="h-4 w-4" />
          <span>{tCheckout("customer.invoice_address")}</span>
        </div>
        <div className="mt-1 text-muted-foreground">
          {tCheckout("customer.loading_profile")}
        </div>
      </div>
    );
  }

  if (!customerOk) {
    return (
      <Alert className="mb-3">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{tCheckout("customer.invoice_address_required")}</AlertTitle>
        <AlertDescription>
          {tCheckout.rich("customer.complete_profile_before_checkout_link", {
            profile: (chunks) => (
              <Link
                className="underline font-medium"
                href={profileHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {chunks}
              </Link>
            ),
          })}
        </AlertDescription>
      </Alert>
    );
  }

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
          <span>{tCheckout("customer.invoice_address")}</span>
        </div>

        <Link
          href={profileHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline text-muted-foreground hover:text-foreground"
        >
          {tCheckout("customer.edit")}
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
