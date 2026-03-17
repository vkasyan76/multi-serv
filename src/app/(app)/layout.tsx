import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/trpc/client";
import { Toaster } from "sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ClerkProvider } from "@clerk/nextjs";
import { ClerkUserSync } from "@/modules/auth/ui/views/clerk-user-sync";
import GeoBootstrap from "@/components/geo-bootstrap";

// Import styles for react-big-calendar
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

import { cookies, headers } from "next/headers";
import {
  getAppLangFromHeaders,
} from "@/modules/profile/location-utils";
import { normalizeToSupported, type AppLang } from "@/lib/i18n/app-lang";
import { LOCALE_COOKIE_NAME } from "@/i18n/routing";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // helps absolute URLs (fallback keeps dev happy)
  metadataBase: new URL(
    (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000").includes(
      "localhost"
    )
      ? `http://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"}`
      : `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`
  ),

  title: {
    default: "Infinisimo: professional services",
    template: "%s | Infinisimo",
  },
  description:
    "Infinisimo connects clients with professionals. Book services fast and securely.",

  // If you keep step 2a below, these lines can be removed.
  icons: { icon: "/images/infinisimo_logo_illustrator.png" },
  twitter: { card: "summary_large_image", images: ["/opengraph-image.png"] }, // Consistent rich previews when someone shares a page Facebook, LinkedIn, Slack, WhatsApp,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Phase 2: prefer middleware-resolved locale, then cookie, then Accept-Language.
  const h = await headers();
  const requestLang = h.get("x-app-lang")?.trim();
  let appLang: AppLang;

  if (requestLang) {
    appLang = normalizeToSupported(requestLang);
  } else {
    const cookieStore = await cookies();
    const cookieLang = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
    appLang = cookieLang
      ? normalizeToSupported(cookieLang)
      : getAppLangFromHeaders(h);
  }

  return (
    <html lang={appLang}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClerkProvider>
          <NuqsAdapter>
            <TRPCReactProvider>
              <ClerkUserSync />
              <GeoBootstrap />
              {children}
              <Toaster />
            </TRPCReactProvider>
          </NuqsAdapter>
        </ClerkProvider>
      </body>
    </html>
  );
}
