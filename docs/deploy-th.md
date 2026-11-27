# คู่มือขึ้นระบบและดูแลระบบ (staging + prod)

เหตุผลของการเลือกโครงสร้างนี้อยู่ใน [ADR 0002](adr/0002-hosting-cloudflare.md) · ไฟล์นี้คือ "ทำอย่างไร"

## 0. ภาพรวม

| | staging | prod |
|---|---|---|
| เจ้าของบัญชี | ผู้พัฒนา (บัญชีฟรี) | **โรงเรียน** (ผู้พัฒนาได้รับเชิญเป็น admin) |
| เว็บ (Cloudflare Workers) | `registerweb-web-staging`, `registerweb-site-staging` · Workers Free | `registerweb-web-production`, `registerweb-site-production` · Workers Paid $5/เดือน |
| ฐานข้อมูล (Supabase, สิงคโปร์) | Free · หยุดเองเมื่อไม่ใช้ 7 วัน | Free ไปก่อน · อัปเกรด Pro เมื่อถึงเกณฑ์ (ข้อ 9) |
| ไฟล์สลิป/รูป (R2) | `registerweb-files-staging` | `registerweb-files` |
| สำรองข้อมูล | ไม่มี (ข้อมูลทดสอบ) | ทุกคืน 02:00 → R2 `registerweb-backups` (เข้ารหัส) |
| deploy | กดเองใน GitHub Actions | tag `v*` → ตรวจความปลอดภัย → อนุมัติ → deploy |
| ข้อมูล | `cloud_demo.sql` | ข้อมูลจริงเท่านั้น **ห้ามรัน seed / demo** |

ค่าใช้จ่าย prod ประมาณ 200–250 บาท/เดือน (Workers $5 + โดเมน) · Supabase และ R2 อยู่ในโควตาฟรี

## 1. ตั้งค่าครั้งแรก

ทำครั้งแรกสำหรับ staging (บัญชีผู้พัฒนา) และอีกรอบสำหรับ prod (บัญชีโรงเรียน) · ค่าที่ได้ไปใส่ใน GitHub ข้อ 1.5

### 1.1 Cloudflare

1. สมัครบัญชี (prod: ใช้อีเมลของโรงเรียน แล้วเชิญผู้พัฒนาที่ Manage Account → Members)
2. prod: Workers & Pages → Plans → **Workers Paid** · staging ใช้ Free ได้ (web 2.19 MiB, site 0.79 MiB ต่ำกว่าเพดาน 3 MiB)
3. เพิ่มโดเมนโรงเรียน: Add a domain → เปลี่ยน nameserver ที่ผู้ให้บริการโดเมนตามที่ Cloudflare บอก → รอสถานะ Active
4. เปิด R2 แล้วสร้าง bucket (ในเครื่องที่ล็อกอิน `npx wrangler login` แล้ว):
   ```bash
   npx wrangler r2 bucket create registerweb-files-staging   # staging
   npx wrangler r2 bucket create registerweb-files           # prod
   npx wrangler r2 bucket create registerweb-backups         # prod
   ```
5. prod: ตั้งการลบสำรองเก่าอัตโนมัติ (daily 30 วัน, monthly 365 วัน):
   ```bash
   npx wrangler r2 bucket lifecycle add registerweb-backups daily-30 daily/ --expire-days 30
   npx wrangler r2 bucket lifecycle add registerweb-backups monthly-365 monthly/ --expire-days 365
   ```
6. API token สำหรับ deploy: My Profile → API Tokens → Create → ใช้แม่แบบ **Edit Cloudflare Workers** · จำกัด Account เป็นบัญชีนี้ และ Zone เป็นโดเมนโรงเรียนเท่านั้น
7. prod: R2 → Manage API tokens → สร้าง token **Object Read & Write** จำกัดเฉพาะ bucket `registerweb-backups` (ใช้กับงานสำรองข้อมูล)
8. Account ID: หน้า Workers & Pages ด้านขวา

### 1.2 Supabase

1. New project · Region **Southeast Asia (Singapore)** · รหัสผ่านฐานข้อมูลสุ่มยาว เก็บในตัวจัดการรหัสผ่าน
   (staging สร้างด้วยสคริปต์ได้: `bash packages/db/scripts/staging-up.sh`)
2. Project Settings → API Keys: คัดลอก **Project URL** และ **publishable key** (`sb_publishable_…`) หรือ anon key แบบเก่า
   **ห้ามใช้ secret key / service_role ในเว็บ** (ขั้นตอน deploy ตรวจและหยุดให้)
3. Account → Access Tokens: สร้าง token สำหรับ CI
4. prod: Connect → **Session pooler** connection string (IPv4) ใส่รหัสผ่าน → ใช้เป็น `PROD_DB_URL` ของงานสำรองข้อมูล
5. Organization → Legal Documents: เซ็น **DPA** (PDPA, ดูข้อ 1.6)

### 1.3 เข้าสู่ระบบด้วย Google

1. Google Cloud Console → APIs & Services → OAuth consent screen (External, ชื่อโรงเรียน, โลโก้) → Credentials → Create OAuth client (Web)
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` · แยก client ของ staging และ prod
3. Supabase → Authentication → Sign In / Providers → Google: ใส่ Client ID / Secret
4. Supabase → Authentication → URL Configuration
   - Site URL: `https://app.<โดเมน>` (staging: `https://staging-app.<โดเมน>`)
   - Redirect URLs: `https://app.<โดเมน>/auth/callback` (staging ตามกัน)

### 1.4 โดเมนของเว็บ

เพิ่ม routes ใน `apps/web/wrangler.jsonc` และ `apps/site/wrangler.jsonc` ในแต่ละ env (commit ผ่าน PR):

```jsonc
"production": {
  "routes": [{ "pattern": "app.<โดเมน>", "custom_domain": true }],
  "r2_buckets": [ ... เดิม ... ]
}
```

แนะนำ: web = `app.<โดเมน>` · site = `<โดเมน>` และ `www.<โดเมน>` · staging ใส่ `staging-` นำหน้า

### 1.5 GitHub

Settings → Environments → สร้าง `staging` และ `production`
- `production`: Required reviewers = ผู้รับผิดชอบ (คนที่อนุมัติขึ้น prod) · Deployment branches and tags → เฉพาะ tag `v*`

| ชื่อ | ชนิด | staging | production | ใช้ที่ |
|---|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | secret | ✓ | ✓ | deploy (ข้อ 1.1-6) |
| `CLOUDFLARE_ACCOUNT_ID` | secret | ✓ | ✓ | deploy, backup |
| `SUPABASE_ACCESS_TOKEN` | secret | ✓ | ✓ | db push, security advisor |
| `SUPABASE_DB_PASSWORD` | secret | ✓ | ✓ | db push |
| `SUPABASE_PROJECT_REF` | secret | ✓ | ✓ | db push |
| `PROD_DB_URL` | secret | | ✓ | backup (ข้อ 1.2-4) |
| `BACKUP_PASSPHRASE` | secret | | ✓ | backup · **โรงเรียนเก็บสำเนาไว้ด้วย** ไม่มีรหัสนี้ = เปิดไฟล์สำรองไม่ได้ |
| `R2_BACKUP_ACCESS_KEY_ID` / `R2_BACKUP_SECRET_ACCESS_KEY` | secret | | ✓ | backup (ข้อ 1.1-7) |
| `NEXT_PUBLIC_SUPABASE_URL` | variable | ✓ | ✓ | build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | variable | ✓ | ✓ | build (publishable / anon เท่านั้น) |
| `NEXT_PUBLIC_DEFAULT_BRANCH_ID` | variable | ✓ | ✓ | ฟอร์มลงทะเบียน |
| `NEXT_PUBLIC_REGISTER_URL` | variable | ✓ | ✓ | ปุ่ม "สมัครเรียน" บน site เช่น `https://app.<โดเมน>/register` |
| `APP_URL` | variable | | ✓ | health check เช่น `https://app.<โดเมน>` |

**ห้ามตั้ง `NEXT_PUBLIC_DEV_LOGIN`** ในทุก environment (deploy จะหยุดเอง) · repo เป็น public: ห้ามวางค่าเหล่านี้ใน issue, PR หรือ log

### 1.6 PDPA ก่อนเปิด prod

- เซ็น DPA ของ Supabase (ข้อ 1.2-5) · DPA ของ Cloudflare รวมอยู่ในข้อตกลงบริการ ดาวน์โหลดเก็บไว้
- หน้า `/privacy` และข้อความยินยอมต้องระบุว่าเก็บข้อมูลที่สิงคโปร์ · ให้ทนายตรวจข้อความก่อนเปิดใช้

## 2. ขึ้น staging

1. staging หยุดอยู่? Supabase Dashboard → โปรเจกต์ → **Restore project** (ประมาณ 2 นาที) · กู้ไม่ได้ (หยุดเกิน 90 วัน) → ใช้ `staging-up.sh`
2. GitHub → Actions → **Deploy** → Run workflow → เลือก branch → Run
3. ตรวจ: เปิด `staging-app.<โดเมน>/login` → เข้าสู่ระบบ Google → ทำตาม `docs/mvp2/demo-th.md`

## 3. ขึ้น prod (release)

```bash
git switch main && git pull
git tag v0.2.0 && git push origin v0.2.0
```

ลำดับที่เกิดขึ้น: **Security** (ข้อ 4) → รออนุมัติใน Actions (Review deployments) → ตรวจค่า + Supabase security advisor → migration → build → ตรวจไฟล์ฝั่งเบราว์เซอร์ → deploy web และ site · ขั้นไหนไม่ผ่าน = หยุด ไม่มีอะไรขึ้น prod

## 4. ด่านตรวจความปลอดภัย (ก่อน prod ทุกครั้ง)

| ตรวจ | ไม่ผ่านแปลว่า | ทำอย่างไร |
|---|---|---|
| secrets (gitleaks) | มีรหัส/คีย์ใน git (ประวัติทั้งหมด) | **เปลี่ยนคีย์นั้นทันที** (คีย์หลุดแล้วเพราะ repo public) แล้วค่อยลบออกจากโค้ด |
| dependencies (pnpm audit) | ไลบรารีที่ขึ้นเว็บมีช่องโหว่ระดับ high ขึ้นไป | อัปเกรดตาม "Patched versions" · ถ้าเป็นแค่เครื่องมือ build ให้อยู่ใน devDependencies |
| code (CodeQL) | โค้ดมีรูปแบบช่องโหว่ร้ายแรง | ดูไฟล์และบรรทัดใน log / แท็บ Security แล้วแก้ |
| database | ตารางไม่มี RLS หรือ security definer ไม่ตั้ง search_path | migration ใหม่: `enable row level security` + policy / `set search_path = public` |
| security advisor (prod) | Supabase พบปัญหาระดับ ERROR | Supabase → Advisors → Security แก้ตามคำแนะนำด้วย migration |
| config / bundle guard | ตั้งค่าผิด หรือคีย์ลับหลุดไปฝั่งเบราว์เซอร์ | แก้ค่าใน GitHub environment · ห้ามใช้ `NEXT_PUBLIC_` กับค่าลับ |

แก้แล้ว merge เข้า main แล้ว tag ใหม่ (`v0.2.1`) · **ห้ามข้ามด่านนี้** ไม่ว่ากรณีใด

## 5. ถอยกลับ (rollback)

- เว็บ: Cloudflare → Workers → `registerweb-web-production` → Deployments → Rollback (หรือ `npx wrangler rollback --env production` ใน `apps/web`)
- ฐานข้อมูล: migration ย้อนไม่ได้ → เขียน migration แก้ไปข้างหน้า · ข้อมูลเสียหาย → กู้จากสำรอง (ข้อ 6)

## 6. กู้ข้อมูลจากสำรอง

> **ร่าง · ยังไม่ได้ทดสอบ** ขั้นตอนนี้ต้องทดสอบกู้บน staging 1 ครั้งก่อนเปิดใช้จริง (แผน deploy ข้อ verification) แล้วแก้ไฟล์นี้ตามผลจริง และจดเวลาที่ใช้

```bash
# 1. ดาวน์โหลด R2 → registerweb-backups → daily/<วันที่>.dump.gpg แล้วถอดรหัส (ใส่ BACKUP_PASSPHRASE)
gpg --decrypt --output db.dump <วันที่>.dump.gpg
# 2. ดูว่าใน dump มีอะไร
pg_restore --list db.dump | less
```

3. กู้ลง **โปรเจกต์ใหม่** ที่ `supabase db push` ครบแล้ว (ห้ามกู้ทับ prod โดยตรง) ด้วย `pg_restore --data-only --no-owner`
   - กู้ `auth.users` ก่อน (`--schema=auth --table=users`) แล้วค่อย `--schema=public`
   - ระวัง: trigger บน `auth.users` สร้างแถว `profiles` ให้อัตโนมัติ → ข้อมูล `profiles` จาก dump จะชนกัน ต้องลบแถวที่ trigger สร้างก่อนกู้ public (ยืนยันวิธีที่ใช้ได้ตอนทดสอบบน staging)
4. ชี้ `NEXT_PUBLIC_SUPABASE_URL` / key ของ GitHub environment ไปโปรเจกต์ใหม่ แล้ว deploy

## 7. งาน MA (แก้ไข/เพิ่มเติมหลังส่งมอบ)

1. กู้ staging (ข้อ 2-1) · `git switch main && git pull` · branch ใหม่
2. แก้ + ทดสอบบน local Supabase (`pnpm db:start`, `pnpm dev:web`) · `pnpm typecheck && pnpm lint && pnpm test`
3. PR → CI + Security ผ่าน → merge
4. Deploy staging (ข้อ 2) → ทดสอบบน iPad / มือถือจริง
5. tag → อนุมัติ → ขึ้น prod (ข้อ 3) · จด release note ในชีต RegisterWeb

## 8. ดูแล prod รายเดือน (10 นาที)

- [ ] Actions → **Prod DB backup** ผ่านทุกคืน · R2 มีไฟล์ล่าสุด
- [ ] Actions → **Prod health check** ไม่มีวันไหนแดง
- [ ] SQL Editor: `select status, start_time from cron.job_run_details order by start_time desc limit 7;` ต้องเป็น `succeeded` ทุกคืน
- [ ] Supabase → Reports: ขนาดฐานข้อมูล (เกณฑ์ข้อ 9) · Cloudflare → R2: ขนาดไฟล์
- [ ] อีเมลแจ้งเตือนจาก Supabase / Cloudflare / GitHub (Dependabot, security)
- [ ] โดเมนต่ออายุอัตโนมัติ · บัตรที่ผูกไว้ยังไม่หมดอายุ

## 9. เมื่อไหร่ต้องอัปเกรด Supabase Pro (+$25/เดือน)

- ฐานข้อมูลเกิน **400 MB** (เพดาน Free 500 MB)
- โปรเจกต์ถูกหยุดเพราะไม่มีการใช้งาน (เช่น ปิดเทอมยาว) มากกว่า 1 ครั้ง
- โรงเรียนต้องการสำรองข้อมูลอัตโนมัติจาก Supabase หรือ SLA

อัปเกรดได้ทันทีที่ Organization → Billing ไม่ต้องย้ายข้อมูล

## 10. ส่งมอบให้โรงเรียน

- [ ] บัญชี prod ทุกตัว (Cloudflare, Supabase, Google Cloud, โดเมน, GitHub ถ้ามี) เป็นของโรงเรียน ผูกบัตรของโรงเรียน
- [ ] รายชื่อผู้มีสิทธิ์ในแต่ละบัญชี (ตรวจตามการ์ด #73) · ลบคนที่ไม่เกี่ยวข้อง
- [ ] `BACKUP_PASSPHRASE` และรหัสผ่านฐานข้อมูล prod อยู่ในตัวจัดการรหัสผ่านของโรงเรียน
- [ ] DPA ของ Supabase และ Cloudflare เก็บไว้ในแฟ้ม PDPA
- [ ] ผู้ติดต่อเมื่อระบบมีปัญหา และวิธีเช็คชื่อสำรอง (ดู go-live checklist ข้อ E)

## 11. ข้อควรระวัง (เจอมาแล้ว)

- `opennextjs-cloudflare build` เรียก `pnpm build` เอง: เครื่องที่ไม่มี `pnpm` ใน PATH (ใช้ผ่าน `npx`) จะ build ไม่ผ่าน → `corepack enable` หรือติดตั้ง pnpm
- หลัง `pnpm add` ในแอปใดแอปหนึ่ง ถ้า test ของแพ็กเกจอื่นหา `vitest` ไม่เจอ → รัน `pnpm install` อีกครั้ง
- zod 4: id ทดสอบใน seed (`22222222-0000-…`) ไม่ใช่ UUID ตาม RFC → ใช้ `z.guid()` ไม่ใช่ `z.string().uuid()`
- Docker (Colima) ดิสก์เต็ม → Supabase local เชื่อมต่อไม่ได้ (`No space left on device`) · ลบ image/volume ที่ไม่ใช้
- โปรเจกต์ Supabase ใหม่ใช้คีย์ `sb_publishable_…` / `sb_secret_…` · ตัว guard รับเฉพาะ publishable หรือ anon JWT
