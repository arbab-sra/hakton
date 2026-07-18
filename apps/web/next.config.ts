import { config as loadDotenv } from "dotenv";
import type { NextConfig } from "next";
import { resolve } from "node:path";

// Next runs from apps/web, while this monorepo keeps shared runtime configuration at the workspace root.
loadDotenv({ path: resolve(import.meta.dirname, "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@codemri/auth",
    "@codemri/ai",
    "@codemri/db",
    "@codemri/queue",
    "@codemri/repository",
    "@codemri/types",
    "@codemri/ui"
  ]
};

export default nextConfig;
