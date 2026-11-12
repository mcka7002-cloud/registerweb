import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@registerweb/domain"],
  images: {
    // รูปนักเรียนและสลิปเก็บใน Supabase Storage (bucket private, ใช้ signed URL)
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
