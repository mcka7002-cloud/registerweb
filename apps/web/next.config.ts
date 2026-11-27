import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Monorepo root (pnpm workspace), so file tracing does not guess from other lockfiles.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@registerweb/domain"],
  // รูปผู้เรียนและสลิปส่งผ่าน server action (ไฟล์ละไม่เกิน 5 MB) ค่าเริ่มต้นของ Next คือ 1 MB
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  images: {
    // รูปนักเรียนและสลิปเป็น signed URL ไฟล์เล็ก · บน Cloudflare Workers ไม่มี image optimizer ในตัว (ADR 0002)
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default withNextIntl(nextConfig);

// `next dev` only: exposes Cloudflare bindings (getCloudflareContext) through a local wrangler emulation.
if (process.env.NODE_ENV === "development") {
  void import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
