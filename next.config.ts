import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  async redirects() {
    return [
      // old post links (/post?id=…) → /posts/…
      { source: "/post", has: [{ type: "query", key: "id", value: "(?<id>[0-9a-fA-F-]{36})" }], destination: "/posts/:id", permanent: true },
      { source: "/post", destination: "/queue", permanent: false },
      { source: "/test-results", destination: "/tests", permanent: true },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
