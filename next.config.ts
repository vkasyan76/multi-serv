import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Phase 3 (Commit 1): enable next-intl runtime request config.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["pdfkit"],
  images: {
    domains: [
      "img.clerk.com",
      "images.unsplash.com",
      "localhost",
      "127.0.0.1",
    ],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/api/media/**',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        pathname: '/**',
      },
    ],
  },
};

export default withPayload(withNextIntl(nextConfig));
