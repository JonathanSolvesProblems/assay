import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skin-analysis frames are posted as base64 from the capture UI; the default
  // 1 MB server-action body limit is well under a three-frame session.
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
