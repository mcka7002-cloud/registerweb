import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No image optimizer on Cloudflare Workers (ADR 0002).
  images: { unoptimized: true, remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
};

export default nextConfig;

// `next dev` only: exposes Cloudflare bindings through a local wrangler emulation.
if (process.env.NODE_ENV === "development") {
  void import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
