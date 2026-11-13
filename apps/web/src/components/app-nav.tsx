"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
}

function isActive(pathname: string, href: string, all: NavItem[]): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  // Prefer the most specific link (e.g. /admin/branches over /admin).
  return !all.some((item) => item.href.length > href.length && (pathname === item.href || pathname.startsWith(item.href + "/")));
}

/** Role navigation: a horizontally scrollable row on mobile, a wrapping row on larger screens. */
export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1 whitespace-nowrap sm:flex-wrap">
        {items.map((item) => {
          const active = isActive(pathname, item.href, items);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-md px-3 text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
