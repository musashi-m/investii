import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:sqlite", "@netlify/database"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
