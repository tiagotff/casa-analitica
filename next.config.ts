import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "50mb" } }, // upload de materiais pelo professor
};

export default nextConfig;
