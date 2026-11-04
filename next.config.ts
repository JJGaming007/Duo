import type { NextConfig } from "next";

// The service worker is hand-written in public/sw.js (push notifications + caching)
// and registered from lib/notifications.ts. Don't add next-pwa back: it generates its
// own public/sw.js at build time and overwrites ours.
const nextConfig: NextConfig = {
  turbopack: {},
  async redirects() {
    // Server-side redirect: no JS round-trip / spinner when opening "/"
    return [{ source: "/", destination: "/dashboard", permanent: false }];
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
