"use client";
import { OPEN_COOKIE_PREFS_EVENT } from "@/constants";

type Props = {
  className?: string;
  children: React.ReactNode;
};

export function OpenCookiePreferencesButton({ className, children }: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.dispatchEvent(new Event(OPEN_COOKIE_PREFS_EVENT));
      }}
    >
      {children}
    </button>
  );
}
