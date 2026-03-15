"use client";

import { useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";

type TenantMismatchNoticeProps = {
  expectedSlug: string;
  actualSlug: string;
  signInUrl: string;
};

export default function TenantMismatchNotice({
  expectedSlug,
  actualSlug,
  signInUrl,
}: TenantMismatchNoticeProps) {
  const { signOut } = useClerk();
  const tDashboard = useTranslations("dashboard");

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold">
        {tDashboard("mismatch.title")}
      </h1>
      <p className="text-base text-muted-foreground">
        {tDashboard("mismatch.body", { expectedSlug, actualSlug })}
      </p>
      <p className="text-sm text-muted-foreground">
        {tDashboard("mismatch.hint")}
      </p>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-white hover:bg-black/90"
        onClick={async () => {
          try {
            await signOut();
          } catch {
            // Best-effort sign-out; still redirect so the user can continue.
          }
          // After sign-out, send user to the intended tenant link for a clean session.
          window.location.href = signInUrl;
        }}
      >
        {tDashboard("mismatch.action")}
      </button>
    </div>
  );
}
