# MVP1 contracts (demo on Vercel)

Every sub-agent builds against this file. Change it only through the lead (overall reviewer), never inside a
workstream. Architecture rules come from [ADR 0001](../adr/0001-stack-and-architecture.md).

## Demo script (definition of done)

1. Sign in with Google (local dev: email + password) → each role lands on its own home page.
2. Admin sets up a branch, its weekly class schedule, and package prices; generates class sessions.
3. A parent fills the registration form → a teacher approves → a student is created and linked to the parent.
4. A teacher sells a package + membership, paid in cash → an on-screen receipt with VAT is shown.
5. The teacher books the student into classes.
6. Kiosk: online check-in by scanner or typed code → sessions left goes down by one.
7. The parent's portal shows the student's package, sessions left and attendance.

**Out of MVP1:** offline kiosk, payroll, exams, stock, slip upload, promotions, reports/Excel, public site
(`apps/site` is not deployed), LINE, English UI, PDF documents.

## Workstreams and file ownership

A workstream edits **only** the paths it owns. Anything else it needs goes in its final report as a request.

| WS | Owns |
|---|---|
| **A: database** | `packages/db/**`, `apps/web/src/lib/database.types.ts` |
| **B: app shell** | `apps/web/src/middleware.ts`, `apps/web/src/lib/{supabase,auth}/**`, `apps/web/src/lib/utils.ts`, `apps/web/src/components/**`, `apps/web/src/i18n/**`, `apps/web/messages/**` (except feature files below), `apps/web/src/app/{layout.tsx,page.tsx,globals.css,login/**,auth/**,(app)/layout.tsx}`, `apps/web/package.json`, `apps/web/next.config.ts`, `pnpm-lock.yaml` |
| **C: back office** | `apps/web/src/features/{admin,students,sales,booking}/**`, `apps/web/src/app/(app)/{admin,staff,receipts}/**`, `apps/web/messages/th/{admin,students,sales,booking}.json` |
| **D: kiosk + portal** | `apps/web/src/features/{checkin,portal,register}/**`, `apps/web/src/app/{kiosk/**,(app)/portal/**,(app)/register/**}`, `apps/web/messages/th/{checkin,portal,register}.json` |

C and D need new npm packages → ask in the report; B (or the lead) adds them.

## Database contract (WS A)

### Fixes from the review (new migration `20261113000001_mvp1_fixes.sql`)
- `alter default privileges in schema public revoke execute on functions from public;` and revoke execute on all
  existing functions from `public, anon`; grant back only what is listed below.
- `nightly_job`: no grant to `anon` / `authenticated`.
- Drop `students_staff_update`; student edits go through `update_student`.
- `record_checkin`: check "already checked in" **before** the booking lookup, so a second scan returns
  `เช็คชื่อคลาสนี้แล้ว`. Also reject packages past `must_start_by` that never started, and packages of another branch.
- Trigger on `auth.users` insert → `profiles` row (`role = 'customer'`, `full_name` from
  `raw_user_meta_data->>'full_name'` or the email, `email`).
- `profiles_self`: staff see profiles in their own branches only (admin sees all).
- `post_media_public`: only media of `published` + `public` posts.
- `unique nulls not distinct` on `price_settings (branch_id, key)` and `holidays (branch_id, holiday_date)`.
- Seed missing `exam_black` price.

### Direct table writes allowed (admin only, existing RLS)
`branches`, `branch_settings`, `package_templates`, `price_settings`, `class_schedules`, `profiles.role`,
`profile_branches`. Customers insert `registrations` directly (existing policy).

### RPC functions (all `security definer`, role check first, granted to `authenticated`)
Every function returns `jsonb`. On a rule violation it raises an exception whose message is a stable
**error code** (upper snake case, listed below); the UI maps codes to Thai text.

| Function | Who | Does | Returns | Error codes |
|---|---|---|---|---|
| `generate_class_sessions(p_branch uuid, p_from date, p_to date)` | admin, branch_manager of branch | Creates `class_sessions` from active `class_schedules`; skips existing and holidays | `{created}` | `FORBIDDEN` |
| `approve_registration(p_registration uuid, p_student jsonb)` | staff of branch | Creates `students` (code `S` + 5-digit per-branch running number), links `registrations.account_id` in `student_accounts`, creates `guardians` from `p_student.guardians`, sets registration `approved` | `{student_id, code}` | `FORBIDDEN`, `NOT_PENDING` |
| `reject_registration(p_registration uuid, p_reason text)` | staff of branch | Sets `rejected` | `{}` | `FORBIDDEN`, `NOT_PENDING`, `REASON_REQUIRED` |
| `update_student(p_student uuid, p_fields jsonb)` | staff of branch | Updates only: nickname, names, height, weight, uniform_size, medical_notes, emergency_* | `{}` | `FORBIDDEN` |
| `sell_package(p_student uuid, p_template uuid, p_with_membership boolean, p_method payment_method)` | staff of branch | One transaction: order (`approved`) + items + payment + `student_packages` snapshot (`paid_on` = today Bangkok, `must_start_by` = +1 year) + optional membership (`membership_next_expiry`) + receipt `documents` row with per-branch yearly number `RC-<branch code>-<yyyy>-<00001>` + audit. VAT from `branch_settings` via new `public.compute_vat` (same results as `packages/domain/src/vat.ts`) | `{order_id, document_id, doc_no, total}` | `FORBIDDEN`, `MEMBERSHIP_REQUIRED` (membership expired and not included), `TEMPLATE_INACTIVE` |
| `book_sessions(p_package uuid, p_sessions uuid[])` | staff of branch | Creates `bookings`. Rules: sessions in the package's branch, not cancelled, date ≥ today; count ≤ remaining (total + bonus − used − already booked) unless unlimited; if `expires_on` known, date ≤ it; if not started, all dates within `duration_days` of the earliest booked date | `{booked}` | `FORBIDDEN`, `IN_PAST`, `OUT_OF_WINDOW`, `TOO_MANY`, `DUPLICATE`, `PACKAGE_EXPIRED` |
| `cancel_booking(p_booking uuid)` | staff of branch | `booked` → `cancelled` | `{}` | `FORBIDDEN`, `NOT_BOOKED` |
| `record_checkin(...)` | existing signature | (fixed as above) | existing | existing `problem` texts |
| `my_home()` | any signed-in | `{role, branches: [{id, name}]}` for routing | | |

Reads use RLS: students, student_packages, bookings, attendances, class_sessions, orders, order_items,
documents, registrations, profiles.

### Seed (`packages/db/supabase/seed.sql`, local + demo only)
- Branch `BKK` "สาขาหลัก" with VAT enabled (7%, inclusive), weekly schedule Mon/Wed/Fri 17:00–18:00 and
  Sat 10:00–11:00.
- Local-only test users (email + password, created in `auth.users` + `auth.identities`): one each of admin,
  branch_manager, teacher, customer, kiosk, linked to `BKK`. Passwords live only in this seed file.
- One approved student linked to the customer, with a package and bookings for this week.

### Local dev auth
`packages/db/supabase/config.toml`: enable `[auth.email]` sign-in for local dev; keep Google enabled.

### Types
`apps/web/src/lib/database.types.ts` generated by the Supabase CLI and committed.

## App shell contract (WS B)

```ts
// apps/web/src/lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient<Database>>;      // server components + actions
// apps/web/src/lib/supabase/client.ts
export function createBrowserClient(): SupabaseClient<Database>;             // client components (kiosk)
// apps/web/src/lib/auth/index.ts
export type Role = Database["public"]["Enums"]["app_role"];
export interface Me { id: string; email: string; fullName: string; role: Role; branchIds: string[] }
export async function getMe(): Promise<Me | null>;
export async function requireRole(...roles: Role[]): Promise<Me>;           // redirects to /login or / if not allowed
// apps/web/src/lib/rpc.ts
export type RpcResult<T> = { ok: true; data: T } | { ok: false; code: string };
export async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>>; // maps exception message → code
```

- Until WS A's generated types land, `database.types.ts` may be a placeholder exporting `type Database = any`.
- Routes: `/login` (Google button; email/password form only when `NEXT_PUBLIC_DEV_LOGIN=1`),
  `/auth/callback`, `/` redirects by role: admin → `/admin`, branch_manager/teacher → `/staff`,
  customer → `/portal`, kiosk → `/kiosk`.
- `middleware.ts` refreshes the Supabase session (official `@supabase/ssr` pattern) and sends signed-out users
  to `/login`, except `/login`, `/auth/*`, and static files.
- `(app)/layout.tsx`: top bar with the user's name, role and sign-out; nav links per role.
- shadcn/ui components in `src/components/ui`: button, input, label, select, card, table, badge, dialog,
  form-free inputs (no react-hook-form), sonner toast.
- next-intl, Thai only, no locale in the URL. `src/i18n/request.ts` loads and merges
  `messages/th/common.json` and each feature file `messages/th/<feature>.json`
  (admin, students, sales, booking, checkin, portal, register). B creates all of them; feature files start as `{}`.
- Error codes: `messages/th/common.json` → `errors.<CODE>` holds the Thai text for every code above.

## Feature conventions (WS C, D)

- `features/<f>/actions.ts`: `"use server"`, validate with zod, `requireRole(...)`, then `callRpc` or a direct
  write allowed above. Return `RpcResult`.
- `features/<f>/queries.ts`: reads with `createClient()`.
- `features/<f>/components/*`: UI. Use `src/components/ui` only.
- Text through next-intl (`useTranslations` / `getTranslations`) with the feature's namespace.
- No business rule re-implemented in TypeScript: show what the database returns. `packages/domain` may be used
  for display only (VAT preview, dates).

### WS C pages
- `/admin`: links. `/admin/branches` (list, create, edit; VAT settings). `/admin/schedule` (weekly
  `class_schedules` per branch + "generate sessions for next 4 weeks"). `/admin/packages` (package templates
  and membership price). `/admin/users` (set role + branches).
- `/staff`: today's sessions in my branches and pending registrations count.
- `/staff/registrations` (pending list) and `/staff/registrations/[id]` (review payload, approve with student
  fields, or reject with reason).
- `/staff/students` (search by name/code/nickname) and `/staff/students/[id]`: profile, membership expiry,
  packages with sessions left, bookings; actions "sell package" (dialog: template, membership checkbox,
  payment method, live VAT preview from `packages/domain`) and "book classes" (pick from upcoming sessions).
- `/receipts/[id]`: printable HTML receipt (school/branch, doc no, items, net, VAT, total).

### WS D pages
- `/register`: customer form (student names th/en, nickname, birth date, guardian name/relation/phone,
  medical notes, PDPA consent required, publish consent) → insert `registrations` with `payload`; then shows
  "waiting for teacher review" and the status of the customer's registrations.
- `/portal`: for each linked student: belt, membership expiry, active package with sessions left and expiry,
  upcoming bookings, recent attendance.
- `/kiosk` (role kiosk or staff): pick branch (if more than one) and today's class session; input field that
  keeps focus (Bluetooth scanner types the code + Enter); calls `record_checkin` online with a new
  `crypto.randomUUID()`; full-screen result for 3 s: name, sessions left or the problem text. No offline mode.

## Verification each workstream must run before reporting

- `pnpm --filter @registerweb/web typecheck` and `lint` and `build` (env:
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=x`).
- WS A: `DATABASE_URL="postgresql:///postgres?host=/tmp" pnpm db:test` with new SQL tests for every function
  and every fix above.
- Report: files changed, commands run with results, anything not done, requests for other workstreams.
