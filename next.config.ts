import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root: an unrelated lockfile in a parent directory would
  // otherwise make Next infer the wrong root for file-tracing.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
