import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Conventional dynamic rendering: every page in this app reads the
  // session and the database, so the Cache Components model adds friction
  // without a benefit for a CRM.
  cacheComponents: false,
  typedRoutes: false,
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
