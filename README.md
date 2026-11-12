# RegisterWeb

ระบบโรงเรียนเทควันโด: ลงทะเบียน + นัดทดลองเรียน, ค่าสมาชิกรายปี, แพ็กเกจ, จองคลาส, เช็คชื่อ (Kiosk ออฟไลน์ได้),
ครูและเงินเดือน, สอบเลื่อนสาย, งานแข่ง, บัญชี + VAT และเว็บสาธารณะ · 2 ภาษา ไทย/English

- **Spec / Tasks / Flow:** [RegisterWeb Team Workspace](https://claude.ai/artifact/X1NSbhgBvcEg6USkZdoD47) (Spec v1 ล็อก 12 พ.ย. 2026)
- **ที่มาของกฎ:** [Grill Session](https://claude.ai/artifact/3LroTe8FRVgj3n1sJwFdSW)
- **ดีไซน์:** [Figma RegisterWeb](https://www.figma.com/design/oY12YnecLV5ObKXacDqP3D/RegisterWeb)

## โครง mono-repo

| ที่อยู่ | คืออะไร |
|---|---|
| `apps/web` | Next.js: หลังบ้าน (admin, ผู้จัดการสาขา, ครู), พอร์ทัลลูกค้า, Kiosk PWA (`/kiosk`) · port 3000 |
| `apps/site` | Next.js: เว็บสาธารณะบนโดเมนโรงเรียน (หน้าแรก, สาขา, ราคา, ข่าว, ผลงาน) · port 3001 |
| `packages/domain` | กฎธุรกิจแบบ pure function + unit test (vitest) |
| `packages/db` | Supabase: migrations, RLS, ฟังก์ชันฝั่ง server, SQL test |

Stack: Next.js (App Router) · Supabase (Postgres, Auth ด้วย Google, Storage, pg_cron) · shadcn/ui + Tailwind · next-intl · Serwist (PWA) · Vercel · pnpm + Turborepo

## เริ่มต้น

```bash
corepack enable            # ใช้ pnpm ตาม packageManager
pnpm install               # ครั้งแรกให้ commit pnpm-lock.yaml ด้วย
cp apps/web/.env.example apps/web/.env.local
cp apps/site/.env.example apps/site/.env.local
pnpm db:start              # Supabase local (ต้องมี Docker) แล้วเอาค่า key ใส่ .env.local
pnpm dev                   # web :3000 + site :3001
```

| คำสั่ง | ทำอะไร |
|---|---|
| `pnpm test` | unit test ทุก package |
| `pnpm db:test` | รัน migrations + `rules_test.sql` บน Postgres เปล่า (ตั้ง `DATABASE_URL`) |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | ตรวจทั้ง repo ผ่าน Turborepo |

## กติกาทีม

- branch จาก `main` ตั้งชื่อ `task/<เลขงาน>-<สั้นๆ>` เช่น `task/17-checkin-rules` แล้วเปิด PR ให้อีกคน review
- ข้อ 17 และ 56 (ตรวจสิทธิ์เช็คชื่อ, Kiosk ออฟไลน์) เสี่ยงที่สุด ต้องมีคน review เสมอ
- กฎเปลี่ยน → เพิ่มคำถามใน Grill Session → แก้ Spec → แก้โค้ด ตามลำดับนี้
- ทุกสถานะสำคัญเขียนผ่านฟังก์ชัน security definer ในฐานข้อมูลเท่านั้น ห้ามเชื่อค่าจากหน้าจอ

## สิ่งที่ยังรอ

- ตารางคลาส (Grill ข้อ 12, 79): โครง `class_schedules` / `class_sessions` เป็นแบบชั่วคราว
- หน้าตาบัตรนักเรียน (ข้อ 98)
- `packages/domain` ยังจองรายวันตามแบบเดิม ต้องเปลี่ยนเป็นรายคลาสตอนทำงานข้อ 14, 17
