import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Monorepo root (pnpm workspace), so file tracing does not guess from other lockfiles.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@registerweb/domain"],
  images: {
    // รูปนักเรียนและสลิปเก็บใน Supabase Storage (bucket private, ใช้ signed URL)
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default withNextIntl(nextConfig);
