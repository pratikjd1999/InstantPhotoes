import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@instantphotos/core", "@instantphotos/db"],
};

export default nextConfig;
