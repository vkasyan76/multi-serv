"use client";

type Props = {
  className?: string;
  children: React.ReactNode;
};

export function OpenCookiePreferencesLink({ className, children }: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.dispatchEvent(new Event("open-cookie-preferences"));
      }}
    >
      {children}
    </button>
  );
}
