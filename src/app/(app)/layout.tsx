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

import { headers } from "next/headers";
import {
  getAppLangFromHeaders,
  type AppLang,
} from "@/modules/profile/location-utils";
import { CookieConsentRoot } from "@/modules/legal/cookies/ui/cookie-consent-root";
import { VercelAnalyticsConsent } from "@/modules/legal/cookies/ui/concents/vercel-analytics-consent";

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
  // derive AppLang from Accept-Language header on the SERVER
  // Next 15: headers() is async
  const h = await headers();
  const appLang: AppLang = getAppLangFromHeaders(h);

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
              <CookieConsentRoot />
              <VercelAnalyticsConsent />
              <Toaster />
            </TRPCReactProvider>
          </NuqsAdapter>
        </ClerkProvider>
      </body>
    </html>
  );
}
