# ADR 0001: Tech stack and architecture for a 1–3 developer team

- **Status:** Proposed
- **Date:** 2026-11-13
- **Deciders:** RegisterWeb team
- **Context source:** Spec v1 (locked 12 Nov 2026), repo review of commit `bdcd2fd`

## Context

RegisterWeb covers registration, annual membership, packages, class booking, check-in (including an offline iPad
kiosk), teacher payroll, belt exams, competitions, sales with VAT receipts and tax invoices, stock, PDPA requests and a
public bilingual website. It will be built and maintained by **one to three developers**, so the deciding forces are:

1. **Few moving parts.** Every runtime, deployable and data layer is something the team must upgrade and debug.
2. **One source of truth per rule.** A review of the scaffold found the same check-in rule written in TypeScript
   (`packages/domain/src/checkin.ts`) and in SQL (`public.record_checkin`) with four differences already
   (bonus sessions ignored, a `cancelled` status the enum lacks, check order reversed, comments pointing to a
   function that doesn't exist).
3. **Security that is easy to review.** The same review reproduced three holes, each caused by an inconsistent write
   path: `nightly_job` callable by `anon`, teachers updating `students.exam_counter` / `membership_expires_on`
   through a broad RLS update policy, and an unreachable "already checked in" branch.
4. **Offline kiosk is the riskiest feature** (Grill items 17, 56) and runs on iPad Safari.

## Decision

### 1. Stack

| Concern | Choice | Notes |
|---|---|---|
| Database, auth, files, scheduled SQL | **Supabase** (Postgres 15, Auth with Google, Storage, pg_cron) | No servers to run. Separate projects for staging and prod. |
| Web app | **Next.js App Router on Vercel**, TypeScript | One runtime for UI and server code; preview deploy per PR. |
| UI | **shadcn/ui + Tailwind** | Components are owned in-repo; no UI-library upgrade breakage. |
| i18n | **next-intl** (th, en) | |
| Kiosk offline | **Serwist** for the app-shell cache only; **IndexedDB** (Dexie or idb-keyval) for the scan queue | See §5. |
| Email | **Resend**, sent from `notification_outbox`; LINE in phase 2 | |
| Errors | **Sentry** | |
| Tests | **Vitest** (domain), SQL rule tests (`packages/db/supabase/tests`), **Playwright** (≈5 critical flows) | |
| Repo | **pnpm workspaces**; Turborepo optional | |

**Not adopted:** an ORM (Drizzle/Prisma) — a second data layer beside RLS and SQL functions; Supabase Edge Functions —
a second runtime (Deno); a separate backend service.

### 2. One place per rule

- **Rules that change state** (check-in, sale, slip approval, membership, payroll close, exam results, document void)
  live **only in SQL `security definer` functions**. The UI displays the function's result and error code.
- **`packages/domain`** holds only UI-side computations that never write: VAT preview, date helpers, price preview,
  error-message maps. Remove `evaluateCheckIn` and the booking validators once the SQL versions exist; keep
  `checkInMessages`.
- A rule that genuinely must exist in both (e.g. `computeVat` / `public.compute_vat`) gets **one shared JSON file of
  test cases** run by both Vitest and the SQL tests, so drift fails CI.

### 3. Data access rules

1. **Reads** go through RLS with the user's session client.
2. **Writes to important tables** go only through `supabase.rpc(...)`. Non-admin roles get **no INSERT/UPDATE/DELETE
   policies** on those tables. Low-risk profile fields may use column-level `grant update (col, …)`.
3. **Every function** begins with a role and branch check. A migration sets
   `alter default privileges in schema public revoke execute on functions from public`, and each function is granted
   explicitly to the roles that need it.
4. **Cron-only functions** (`nightly_job`, `build_teacher_days` if scheduled) are granted to no API role.
5. **Every new table** enables RLS in the same migration. CI fails if any `public` table has RLS disabled.
6. **The service-role key** is used only in server code for jobs (outbox drain), never for user-initiated writes.

PR review checklist: *does this write go through a function, and does that function check the caller?*

### 4. One Next.js app, organised by feature

Merge `apps/site` into `apps/web`. Middleware picks the route group by host name (school domain → public site).

```
apps/web/src/
  app/(site)/        public site: SEO, anon key only
  app/(app)/         back office + customer portal (signed in)
  app/kiosk/         offline PWA
  features/<name>/   checkin, sales, booking, payroll, exams, students, …
    actions.ts       server actions: zod validation, then rpc()
    queries.ts       reads
    components/
packages/db          migrations, SQL tests, generated database types (committed)
packages/domain      UI-only helpers
```

A feature folder is the unit of ownership: one developer can change a feature end to end.

### 5. Offline kiosk

- The kiosk **does not evaluate rules**. It appends `{client_uuid, barcode, scanned_at, class_session_id}` to
  IndexedDB and syncs to `record_checkin(..., 'offline_sync')`. The server decides; rule violations go to
  `checkin_review_queue`.
- **Sync triggers:** the `online` event, a timer, and app start. Safari does not support Background Sync.
- The iPad runs the kiosk **installed to the home screen** so Safari doesn't evict its storage.
- Retries are always safe because `record_checkin` is idempotent on `client_uuid`.

### 6. Background jobs

- **pg_cron** for SQL-only jobs (nightly status updates, package expiry, outbox enqueue).
- **One Vercel Cron route** in the app drains `notification_outbox` to Resend (and LINE later).

### 7. Environments and delivery

- local (Supabase CLI) → **staging** → **prod**, each its own Supabase project and Vercel environment.
- CI on every PR: lint, typecheck, unit tests, SQL tests, RLS-enabled check, generated-types drift check, build.
- On merge to `main`: `supabase db push` to staging. On a release tag: push to prod.
- Commit `pnpm-lock.yaml`; CI installs with `--frozen-lockfile`.
- Migrations are append-only; never edit one that has been deployed.

### 8. Delivery order

1. Auth: `profiles` row created by trigger on `auth.users`; role and branch assignment.
2. Students and registration (public form → trial → approval).
3. Packages and sales (cash/slip, receipts, VAT).
4. Booking per class session.
5. Online check-in, then **offline kiosk** (with Playwright tests) — highest risk, built early.
6. Release 2: exams, payroll. Release 3: stock, competitions, news site, LINE.

## Consequences

**Positive**
- One runtime (TypeScript on Vercel) plus SQL; one deployable app; one place to look for each rule.
- Security review reduces to a short checklist; default-deny function privileges stop new holes by default.
- The kiosk stays small because the server owns every decision.

**Negative / costs**
- Business logic in PL/pgSQL is harder to debug than TypeScript; the team must keep SQL tests thorough.
- Merging `site` into `web` couples their deploys; a bad back-office deploy can affect the public site.
- Two paid plans (Supabase, Vercel) once in production.
- Thai PDF receipts/tax invoices need font and line-breaking work; prototype early and store each issued PDF in
  Storage because tax documents are immutable.

**Follow-up work this ADR creates**
- Migration fixing the reviewed holes: revoke `nightly_job` execute; replace `students_staff_update` with
  column grants or functions; fix the "already checked in" check order in `record_checkin`; add the
  `auth.users` → `profiles` trigger; scope `profiles_self` to branch; fix `post_media_public` visibility.
- Remove duplicated rules from `packages/domain` (§2) and add shared VAT test cases.
- Merge `apps/site` into `apps/web` (§4).
- CI: lockfile, lint, RLS check, types drift, migration deploy (§7).

## Alternatives considered

| Alternative | Why not |
|---|---|
| TypeScript-first writes (server actions + Drizzle over a direct Postgres connection), RLS for reads only | Familiar language, but adds an ORM and connection pooling, needs a rewrite of existing SQL functions and tests, and RLS still has to be maintained for reads. Reconsider if PL/pgSQL becomes a bottleneck for the team. |
| Keep `apps/site` separate | Isolates public-site deploys, but doubles dependency upgrades and Vercel projects for a few static pages. |
| Supabase Edge Functions for jobs | Adds Deno as a second runtime for one job. |
| Custom backend (NestJS, Go, etc.) | Adds hosting, auth integration and ops that Supabase already provides. |
