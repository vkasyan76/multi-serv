"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type CookieBannerProps = {
  onAcceptAllAction: () => void;
  onDeclineAllAction: () => void;
  onManageAction: () => void;
};

export function CookieBanner({
  onAcceptAllAction,
  onDeclineAllAction,
  onManageAction,
}: CookieBannerProps) {
  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 px-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="text-sm leading-relaxed text-muted-foreground">
          {/* TODO(i18n): translate */}
          We use cookies to improve your experience. Read our{" "}
          <Link
            href="/legal/cookies"
            className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
          >
            cookie policy
          </Link>
          . You can{" "}
          <button
            type="button"
            onClick={onManageAction}
            className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
          >
            change your preferences
          </button>{" "}
          at any time.
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onDeclineAllAction}
          >
            {/* TODO(i18n): translate */}
            Decline
          </Button>

          <Button
            type="button"
            className="w-full sm:w-auto bg-black text-white hover:bg-pink-400 hover:text-primary"
            onClick={onAcceptAllAction}
          >
            {/* TODO(i18n): translate */}
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
