# ADR 0002: Host on Cloudflare Workers with a lean Supabase prod

- **Status:** Proposed
- **Date:** 2026-11-27
- **Deciders:** RegisterWeb team
- **Supersedes in part:** [ADR 0001](0001-stack-and-architecture.md) (Vercel in §1, the cron route in §6, and §7)

## Context

RegisterWeb is sold to one school as a one-time project, followed by occasional maintenance (MA). It expects about
1,000–1,500 users (parents, teachers, staff and kiosks), and the school wants the lowest monthly cost that is still
reliable in Thailand. Nobody works on it full-time after go-live.

- Supabase has no Bangkok region. The closest region is Singapore (ap-southeast-1), about 30 ms from Bangkok.
- Vercel Hobby forbids commercial use. Vercel Pro costs $20/user/month.
- Cloudflare Workers Paid costs $5/month per account, includes 10M requests, and has edge locations in Bangkok.
- Next.js runs on Workers through the OpenNext adapter (`@opennextjs/cloudflare`). The adapter runs the real
  `next build` output (v1.20 at the time of writing). It doesn't support Node.js middleware. Our `src/middleware.ts` uses the
  edge runtime, which the adapter supports.
- Supabase Pro ($25/month) would be more than the rest of the stack combined.

## Decision

### 1. Hosting

| Concern | Choice |
|---|---|
| `apps/web` and `apps/site` | Cloudflare Workers via `@opennextjs/cloudflare`, one Worker per app per environment |
| Database, auth, pg_cron | Supabase, region **Singapore** |
| Slips and student photos | Cloudflare **R2** (bucket binding `FILES`); Supabase Storage buckets stay but go unused |
| Database backups | Nightly `pg_dump` from GitHub Actions into a private R2 bucket (`BACKUPS`) |
| Images | `images.unoptimized: true` (photos are small; Cloudflare Images would be an extra bill) |

### 2. Environments

| | Staging | Prod |
|---|---|---|
| Owner | the developer's own accounts | the school's accounts (developer invited as admin) |
| Supabase | Free; pauses after 7 idle days and is restored at the start of MA work | Free at first; upgrade to Pro when the DB reaches 400 MB or the school wants built-in backups or an SLA |
| Deploy | manual (`workflow_dispatch`) | release tag `v*`, after the security gate and a manual approval |
| Data | `cloud_demo.sql` demo data | never seed or demo data |

### 3. Delivery

- Every PR runs CI (lint, typecheck, tests, build, SQL tests) and the security workflow.
- Every prod deploy runs, in order: the **security gate** (`security.yml`: gitleaks over the full history,
  `pnpm audit --prod` at high, CodeQL failing at security severity 7+, SQL rule tests, RLS on every table and
  `search_path` on every security definer function) → approval → config and Supabase security-advisor checks →
  `supabase db push` → build → bundle guard → `wrangler deploy`. There is no way to skip the gate.
- Build-only tools (`@opennextjs/cloudflare`, `wrangler`) are dev dependencies: the Worker is bundled at build
  time, so `pnpm audit --prod` covers exactly what ships.
- `NEXT_PUBLIC_*` values are baked in at build time, so each environment builds its own bundle.
- Rollback: `wrangler rollback` for the app; restore a dump from R2 for the database.

### 4. Personal data (PDPA)

Data is stored in Singapore. PDPA has no localisation rule, but this counts as a cross-border transfer
(Sections 28–29). We rely on the Supabase and Cloudflare DPAs (EU standard contractual clauses) and tell parents
where the data is stored in the consent text and on `/privacy`.

## Consequences

**Positive**
- About $6–7/month for prod ($5 Workers Paid, Supabase Free, R2 inside the free 10 GB, plus the domain).
- Staging costs nothing while idle.
- One platform for both environments, so staging tests what prod runs.

**Negative / costs**
- OpenNext is young. Upgrades of Next.js must wait for adapter support, and staging must be checked first.
- Supabase Free has no automatic backups or SLA, and can pause after 7 days without use (for example a long school
  break). Our nightly dump and daily health check cover part of this; the rest is the trigger to upgrade.
- File access moves from Storage RLS policies into a server route, so the access rule needs its own tests.
- Estimated headroom on Supabase Free: about 1,000–1,500 active students for 1–2 years before the 500 MB limit.

## Alternatives considered

| Option | Why not |
|---|---|
| Vercel Pro (sin1) | Native Next.js, no adapter, but about $45/month with Supabase Pro, and staging would run on a different platform |
| Thai VPS or AWS Bangkok | Keeps the app in Thailand, but the database is still in Singapore, and someone must patch and monitor the server |
| Supabase Pro from day one | $25/month more; built-in backups and no pausing. Kept as the upgrade path |
| Cloudflare vinext | Cloudflare's suggestion for new apps, but it re-implements Next.js on Vite; too new for a project with no full-time maintainer |
