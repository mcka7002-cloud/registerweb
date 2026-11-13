"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Label + input pair for the student forms. */
export function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className ?? "grid gap-2"}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        required={required}
        value={value}
        step={type === "number" ? "0.1" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
