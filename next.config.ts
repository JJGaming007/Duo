import type { NextConfig } from "next";

// The service worker is hand-written in public/sw.js (push notifications + caching)
// and registered from lib/notifications.ts. Don't add next-pwa back: it generates its
// own public/sw.js at build time and overwrites ours.
const nextConfig: NextConfig = {
  turbopack: {},
  env: {
    // Shown in More → version, so you can tell which build a phone is running
    NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || "dev",
  },
  async redirects() {
    // Old routes (installed apps may still open these)
    return [
      { source: "/dashboard", destination: "/", permanent: false },
      { source: "/bond", destination: "/chat", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        // Always revalidate the SW so updates reach installed apps promptly
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
