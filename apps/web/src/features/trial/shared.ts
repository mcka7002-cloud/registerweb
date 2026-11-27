import { formatThaiDate } from "@/lib/utils";

/** Assessment skills, in display order (keys of `trial_notes.scores`). */
export const SKILLS = ["flexibility", "strength", "focus", "listening"] as const;
export type Skill = (typeof SKILLS)[number];

/** `registrations.trial_notes` as saved by `record_trial` (contract: `{scores, note, recommended_template_id}`). */
export interface TrialNotes {
  scores: Partial<Record<Skill, number>> | null;
  note: string;
  recommended_template_id: string | null;
}

export function parseTrialNotes(value: unknown): TrialNotes | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  let scores: TrialNotes["scores"] = null;
  if (v.scores && typeof v.scores === "object") {
    const raw = v.scores as Record<string, unknown>;
    scores = {};
    for (const k of SKILLS) if (typeof raw[k] === "number") scores[k] = raw[k] as number;
  }
  return {
    scores,
    note: typeof v.note === "string" ? v.note : "",
    recommended_template_id: typeof v.recommended_template_id === "string" ? v.recommended_template_id : null,
  };
}

/** "17:00:00" → "17:00" */
export const hhmm = (time: string) => time.slice(0, 5);

/** Thai weekday + date of a class, e.g. "จ. 17 พ.ย. 69". */
export const sessionDate = (date: string) =>
  formatThaiDate(date, { weekday: "short", day: "numeric", month: "short", year: "2-digit" });

export const sessionTime = (s: { starts_at: string; ends_at: string }) => `${hhmm(s.starts_at)}–${hhmm(s.ends_at)}`;
