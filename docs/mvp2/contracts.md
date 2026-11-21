# MVP2 contracts (go-live)

Every sub-agent builds against this file. Change it only through the lead, never inside a workstream.
Architecture rules come from [ADR 0001](../adr/0001-stack-and-architecture.md); conventions from
[MVP1 contracts](../mvp1/contracts.md) still apply (actions → zod → `requireRole` → `callRpc`; Thai text through
next-intl; no business rule re-implemented in TypeScript; Friendly Dojang tokens only, no raw colours).

Integration branch: `task/mvp2`. Each sub-agent first runs `git merge --no-edit task/mvp2`.

## Demo script (definition of done)

Full Thai version: [demo-th.md](demo-th.md).

1. **Trial (#9):** a parent registers → a teacher books a trial class → the parent sees the trial date → on the
   day the teacher opens "ทดลองเรียนวันนี้", marks attended, fills the assessment and approves → the student is
   created with `trial_used_at`; the recommended package is pre-selected in "ขายแพ็กเกจ".
2. **Teachers of a class (#16):** a manager assigns teachers to a class (one session or the whole weekly slot).
3. **Manual check-in (#18):** an assigned teacher opens the class roster and checks in a student who forgot the
   card, with a reason → sessions left goes down, the roster shows "ครูเช็คชื่อแทน" and the reason.
4. **Cancel a check-in (#20):** the admin cancels a wrong check-in with a reason → sessions left and the exam
   counter come back, the booking returns to "จองแล้ว" (or "ขาด" for a past class).
5. **Void a receipt (#28, #55):** a manager asks to void a receipt with a reason → the admin sees it in "คิวตรวจ" →
   approves → the receipt shows "ยกเลิกแล้ว", the unused package is voided. Rejecting keeps the receipt.
6. **Audit log (#5):** the admin filters the log by date/branch/action and sees steps 1–5 with who and why.
7. **Student card (#11):** the parent opens "บัตรนักเรียน" in the portal and prints it; the kiosk scanner reads
   its Code 128 barcode (and the QR) and checks the student in.
8. **Import (#37):** the admin downloads the Excel/CSV template, fills old students, uploads → sees a preview
   with row errors → fixes → imports; then links a parent account to an imported student.
9. **Nightly job (#19):** `cron.job` has `nightly_job` at 00:30 Bangkok (17:30 UTC).
10. **Guides (#36, #38, #35):** iPad + scanner setup, teacher training, real-data go-live checklist (Thai).

**Out of MVP2:** offline kiosk, payroll, exams/belt promotion, stock, promotions, reports/Excel export,
public site, LINE, English UI, PDF documents, refunds of money (void only marks documents).

## Workstreams and file ownership

A workstream edits **only** the paths it owns. Anything else goes in its final report as a request.
The lead has already created: the migration + types, empty namespace files (`attendance`, `trial`, `control`,
`card`, `import`) registered in `src/i18n/request.ts`, every RPC error code in `messages/th/common.json` +
`ERROR_CODES` in `lib/utils.ts`, and nav items (`/staff/sessions`, `/staff/trials`, `/admin/queue`, `/admin/audit`,
`/admin/import`). Each page calls `requireRole(...)` itself.

| WS | Owns |
|---|---|
| **Lead** | `packages/db/**`, `apps/web/src/lib/**`, `apps/web/src/components/**`, `src/i18n/**`, `messages/th/common.json`, `(app)/layout.tsx`, `(app)/staff/page.tsx`, `(app)/admin/page.tsx`, `(app)/staff/students/[id]/page.tsx` (wiring only), `(app)/portal/page.tsx` + `features/portal/**` (card link only), `docs/**` |
| **WS1 attendance** (#16 #18 #20) | `features/attendance/**` (new), `(app)/staff/sessions/**` (new), `messages/th/attendance.json` |
| **WS2 trial** (#9) | `features/trial/**` (new), `features/register/**`, `(app)/staff/registrations/**`, `(app)/staff/trials/**` (new), `features/students/components/approve-form.tsx`, `messages/th/{trial,register}.json` |
| **WS3 control** (#5 #28 #55) | `features/control/**` (new), `(app)/admin/audit/**` (new), `(app)/admin/queue/**` (new), `(app)/receipts/**`, `features/sales/components/print-button.tsx`, `messages/th/control.json` |
| **WS4 card** (#11) | `features/card/**` (new), `(app)/portal/card/**` (new), `(app)/staff/students/[id]/card/**` (new), `messages/th/card.json`, `apps/web/package.json` + `pnpm-lock.yaml` (adds `bwip-js` only) |
| **WS5 import** (#37) | `features/import/**` (new), `(app)/admin/import/**` (new), `apps/web/public/templates/**` (new), `messages/th/import.json` |

Docs (#19 #35 #36 #38, demo-th) and seed/cloud demo data are the lead's.

## Database contract (lead, done in `20261117000001_mvp2.sql`, tests `mvp2_test.sql`)

### Schema changes
- `registrations`: `trial_session_id uuid → class_sessions`, `trial_attended_at timestamptz`, `trial_notes jsonb`.
  Customer insert policy also requires all trial fields null.
- `documents.void_requested_at timestamptz`.
- `memberships.voided_at timestamptz` (membership bought on a voided receipt).
- `package_status` gains `'void'`.
- `class_session_teachers`: direct writes removed; use `set_session_teachers`.
- pg_cron: `nightly_job` scheduled as `registerweb-nightly`, `30 17 * * *` (UTC) = 00:30 Bangkok. Skipped on
  plain Postgres (tests), where `pg_cron` is not installed.

### RPC functions (security definer, role check first, granted to `authenticated` only)

| Function | Who | Does | Returns | Error codes |
|---|---|---|---|---|
| `set_session_teachers(p_session uuid, p_teachers uuid[], p_whole_schedule boolean)` | admin, branch_manager of branch | Replaces the session's teachers. `p_whole_schedule` = also every future session (date ≥ today) of the same weekly slot. Each teacher must be staff linked to the branch | `{sessions}` | `FORBIDDEN`, `SESSION_UNAVAILABLE`, `TEACHER_NOT_IN_BRANCH` |
| `staff_checkin(p_client_uuid uuid, p_session uuid, p_student uuid, p_reason text)` | admin / branch_manager of branch; a teacher assigned to the session (any teacher of the branch when the session has no teachers) | `record_checkin(..., 'online', 'manual', reason)` with the student's code and `now()` | same as `record_checkin` (`status ok / rejected / duplicate`, `problem`) | `FORBIDDEN`, `REASON_REQUIRED`, `SESSION_UNAVAILABLE` |
| `void_attendance(p_attendance uuid, p_reason text)` | admin | Sets `voided_*`; package `sessions_used − 1` (and clears `starts_on`/`expires_on` when no other check-in uses the package); booking back to `booked` (`absent` if the class date is past); `exam_counter − 1` (not below 0, not for trials) | `{}` | `FORBIDDEN`, `ALREADY_VOID`, `REASON_REQUIRED` |
| `book_trial(p_registration uuid, p_session uuid)` | staff of branch | Registration `pending` or `trial_booked` → `trial_booked`, `trial_session_id`, `trial_at` (= session date + start, Bangkok). Session in the branch, not cancelled, date ≥ today | `{trial_at}` | `FORBIDDEN`, `NOT_PENDING`, `SESSION_UNAVAILABLE`, `IN_PAST` |
| `record_trial(p_registration uuid, p_attended boolean, p_notes jsonb)` | staff of branch | Status must be `trial_booked`. Saves `trial_notes = p_notes` and `trial_attended_at = now()` (null if not attended) | `{}` | `FORBIDDEN`, `NOT_TRIAL_BOOKED` |
| `approve_registration(...)` | (existing) | Also sets `students.trial_used_at = registrations.trial_attended_at` | existing | existing |
| `request_void_document(p_document uuid, p_reason text)` | staff of branch (admin too) | Sets `void_reason`, `void_requested_by`, `void_requested_at` | `{}` | `FORBIDDEN`, `ALREADY_VOID`, `VOID_PENDING`, `REASON_REQUIRED` |
| `review_void_document(p_document uuid, p_approve boolean, p_reason text)` | admin | Approve: document `void` (`voided_by`, `voided_at`); packages from the order → `void` and their `booked` bookings → `cancelled`; memberships from the order → `voided_at`, student's `membership_expires_on` = latest non-void membership (or null). Reject: clears the request (reason required); the old request stays in the audit log | `{}` | `FORBIDDEN`, `NOT_REQUESTED`, `ALREADY_VOID`, `PACKAGE_IN_USE` (a package from it has check-ins: cancel those first), `REASON_REQUIRED` |
| `import_students(p_branch uuid, p_rows jsonb, p_commit boolean)` | admin, branch_manager of branch | Validates every row; with `p_commit` and no errors, inserts all rows in one transaction (all or nothing). Max 500 rows | `{total, errors: [{row, field, code}], created}` (`created` = 0 unless committed) | `FORBIDDEN`, `TOO_MANY`, `BAD_INPUT` (not an array) |
| `link_parent(p_student uuid, p_email text)` | staff of branch | Links an existing account (any role `customer`, found by email, case-insensitive) to the student | `{account_id, full_name}` | `FORBIDDEN`, `ACCOUNT_NOT_FOUND`, `ALREADY_LINKED`, `ACCOUNT_LIMIT` (max 2 accounts) |

**`p_notes` (trial assessment):** `{ "scores": { "flexibility": 1-5, "strength": 1-5, "focus": 1-5,
"listening": 1-5 }, "note": text, "recommended_template_id": uuid | null }`. Stored as given.

**`import_students` row** (keys = template column headers, all text; empty = not given):
`code` (optional old card code; else a new `S00000` code), `first_name`*, `last_name`*, `first_name_en`*,
`last_name_en`*, `nickname`, `birth_date`* (`YYYY-MM-DD` or Thai `DD/MM/YYYY` in Buddhist year), `gender`
(`ชาย`/`หญิง`/empty), `belt` (Thai belt name as in `belt_ranks.name_th`, or its id; empty = ขาว),
`membership_expires_on` (same date formats), `guardian_name`, `guardian_relation`, `guardian_phone`
(if any guardian field is given, name and phone are required; phone = 9–10 digits).
Row error codes (Thai text lives in `import.json`, not `common.json`): `REQUIRED`, `BAD_DATE`, `BAD_BELT`,
`BAD_GENDER`, `BAD_PHONE`, `BAD_CODE` (code must be `A–Z 0–9 -`, ≤ 20, stored upper case), `CODE_TAKEN`,
`DUPLICATE_IN_FILE`.
`row` is 1-based in data rows (header excluded). Imported memberships are recorded as waived
("นำเข้าข้อมูลเดิม") by the caller.

### Reads (RLS, no new policies needed)
- Roster: `class_sessions`, `bookings`, `attendances` (incl. `method`, `reason`, `recorded_by`, `voided_*`),
  `students`, `class_session_teachers`, `profiles`.
- Trials: `registrations` (staff of branch; the customer sees own rows incl. `trial_at`).
- Audit: `audit_logs` (admin only) + `profiles(full_name)` for `actor_id`.
- Queue: `documents` where `void_requested_at is not null and status = 'issued'`.

## Feature notes per workstream

### WS1 attendance
- `/staff/sessions`: today's and the next 7 days' sessions in my branches (teachers see the ones they are
  assigned to first, then the rest), with teachers' names.
- `/staff/sessions/[id]`: roster = bookings of the session + check-ins (scan / manual + reason + who); button
  "เช็คชื่อแทน" (dialog: reason required, quick picks "ลืมบัตร", "บัตรชำรุด", "สแกนไม่ติด") → `staff_checkin`;
  shows `problem` text when rejected. Admin only: "ยกเลิกการเช็คชื่อ" with reason → `void_attendance`.
  Managers/admin: "ครูประจำคลาส" dialog (staff of the branch, checkbox per teacher, "ทุกสัปดาห์" switch).
- To fix a wrong student: cancel, then manual check-in for the right one (no separate "edit").

### WS2 trial
- `/staff/registrations/[id]`: "นัดทดลองเรียน" (pick an upcoming session of the branch) → `book_trial`; shows
  the trial date and the assessment when saved.
- `/staff/trials`: trial sessions today and upcoming, grouped by class; open one → assessment form (attended
  yes/no, 4 scores 1–5 as large tap targets, note, recommended package) → `record_trial`; then "อนุมัติเป็นนักเรียน"
  (existing approve form) or "ไม่รับ" (existing reject).
- Customer `my-registrations`: show trial date/time and class for `trial_booked`.
- `trial_booked` badge colour: use `bg-accent text-accent-foreground` (replace the raw sky colours).

### WS3 control
- `/admin/audit`: table (time, branch, who, action in Thai, entity, details from `data` incl. reason), filters
  date from/to (default last 7 days), branch, action; 50 per page with "ก่อนหน้า/ถัดไป".
- `/receipts/[id]`: "ขอยกเลิกใบเสร็จ" (manager/teacher/admin, reason) → `request_void_document`; shows
  "รอแอดมินอนุมัติยกเลิก" when requested; a void receipt shows a clear "ยกเลิกแล้ว" stamp + reason (also in print).
- `/admin/queue` "คิวตรวจ": void requests (doc no, total, branch, who asked, when, reason) with approve /
  reject (reason) → `review_void_document`.

### WS4 card
- `features/card/barcode.ts` (server only): `code128Svg(code)` with `bwip-js` (`toSVG`, bcid `code128`,
  includetext) and `qrSvg(code)` with the existing `qrcode`. Both encode `students.code` exactly.
- `features/card/components/student-card-print.tsx`: credit-card size (85.6 × 54 mm) print layout: logo, photo
  (signed URL) or mascot, Thai name + nickname, English name, belt (`BeltChip`), branch, code text, Code 128
  and QR. Print CSS: one card per page, exact size, no app chrome.
- Routes: `/portal/card/[studentId]` (linked customer) and `/staff/students/[id]/card` (staff of branch).

### WS5 import
- `/admin/import` (admin, branch_manager): pick branch; download `public/templates/students-import.csv`
  (UTF-8 with BOM, Thai example row, headers = row keys above) and a short "how to save from Excel as CSV UTF-8"
  note; upload `.csv` → parse in the browser (small parser in `features/import/csv.ts`, handles quotes, BOM,
  CRLF; no new dependency) → `import_students(p_commit=false)` → preview table with errors per row/field in Thai
  → "นำเข้า N คน" → `p_commit=true` → result.
- `features/import/components/link-parent-dialog.tsx` + `linkParent` action in `features/import/actions.ts`:
  email field → `link_parent`. The lead places it on the staff student page.

## Verification each workstream runs before reporting
- `pnpm --filter @registerweb/web typecheck`, `lint`, `build` (env `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
  NEXT_PUBLIC_SUPABASE_ANON_KEY=x`). Do not run `build` while a dev server uses the same `.next`.
- Smoke test its pages per role against local Supabase (skill `smoke-test-supabase-ssr-pages`), using its own
  test rows, never consuming seed rows other workstreams need.
- No English left on screen; no raw colour classes.
- Report: files changed, commands + results, anything not done, requests for other parts.
