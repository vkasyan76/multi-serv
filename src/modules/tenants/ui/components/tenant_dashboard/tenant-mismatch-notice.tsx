"use client";

import { useClerk } from "@clerk/nextjs";

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

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold">Account mismatch</h1>
      <p className="text-base text-muted-foreground">
        This link is for <strong>{expectedSlug}</strong>, but you are signed in
        as <strong>{actualSlug}</strong>.
      </p>
      <p className="text-sm text-muted-foreground">
        Sign out to continue with the correct account.
      </p>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-white hover:bg-black/90"
        onClick={async () => {
          await signOut();
          // After sign-out, send user to the intended tenant link for a clean session.
          window.location.href = signInUrl;
        }}
      >
        Sign out and continue
      </button>
    </div>
  );
}
