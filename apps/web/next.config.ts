import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Secrets live in one place, the repo-root .env.local (DATABASE_URL, BETTER_AUTH_SECRET, ...). Next only reads apps/web by default.
// forceReload: Next has already loaded (and cached) the env of this folder by the time this file runs.
loadEnvConfig(path.resolve(__dirname, "../.."), process.env.NODE_ENV !== "production", console, true);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@instantphotos/core", "@instantphotos/db"],
};

export default nextConfig;
