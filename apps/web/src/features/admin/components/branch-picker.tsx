"use client";

import { usePathname, useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Branch select that writes `?branch=<id>` to the current URL. */
export function BranchPicker({
  branches,
  value,
  label,
}: {
  branches: { id: string; code: string; name: string }[];
  value: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Select value={value} onValueChange={(id) => router.push(`${pathname}?branch=${id}`)}>
      <SelectTrigger aria-label={label} className="min-w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.code} · {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
