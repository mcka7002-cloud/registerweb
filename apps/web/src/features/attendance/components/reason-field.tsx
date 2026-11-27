"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Required reason textarea with optional quick-pick chips (large tap targets for the iPad). */
export function ReasonField({
  id,
  label,
  value,
  onChange,
  placeholder,
  quickPicks = [],
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  quickPicks?: string[];
}) {
  return (
    <div className="grid gap-3">
      {quickPicks.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {quickPicks.map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={value === q}
              onClick={() => onChange(q)}
              className={cn(
                "h-11 rounded-full px-5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                value === q ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor={id}>{label}</Label>
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={500}
          rows={3}
          required
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
    </div>
  );
}
