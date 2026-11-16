import Image from "next/image";
import { cn } from "@/lib/utils";

/** PANIPAK TAEKWONDO wordmark (public/brand, 640 × 258). */
export function BrandLogo({ alt, className, priority }: { alt: string; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/panipak-wordmark.png"
      alt={alt}
      width={640}
      height={258}
      priority={priority}
      className={cn("h-9 w-auto", className)}
    />
  );
}

/** Kicking mascot in the gold ring (public/brand, 547 × 720). Decorative unless `alt` is given. */
export function Mascot({ alt = "", className }: { alt?: string; className?: string }) {
  return (
    <Image
      src="/brand/panipak-mascot.png"
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      width={547}
      height={720}
      className={cn("h-20 w-auto", className)}
    />
  );
}
