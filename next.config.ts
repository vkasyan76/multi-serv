import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: [
      "img.clerk.com", // <-- add this
      "images.unsplash.com", // <-- for your fallback placeholder
      // add any other domains you need
    ],
  },
};

export default withPayload(nextConfig);
