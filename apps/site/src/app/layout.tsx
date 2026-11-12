import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "โรงเรียนเทควันโด",
  description: "ข่าวสาร ผลงาน สาขา และราคาแพ็กเกจ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
