# @registerweb/db

Supabase ของระบบ: `supabase/migrations` (schema, RLS, ฟังก์ชัน) และ `supabase/tests` (SQL test ของกฎ Spec v1)

| คำสั่ง (รันที่ root) | ทำอะไร |
|---|---|
| `pnpm db:start` | เปิด Supabase local (ต้องมี Docker) |
| `pnpm db:reset` | ล้างแล้วรัน migrations ใหม่ทั้งหมด |
| `pnpm db:test` | รัน migrations บน Postgres เปล่า + `supabase/tests/*_test.sql` ทุกไฟล์ (ใช้ `DATABASE_URL`) |
| `pnpm db:types` | สร้าง TypeScript types ให้ `apps/web` |

`pnpm db:reset` รัน `supabase/seed.sql` ด้วย: สาขา BKK, ตารางคลาส, ผู้ใช้ทดสอบ `*@demo.test` (รหัสผ่านอยู่ในหัวไฟล์ seed, local เท่านั้น)

กติกา: แก้ schema ด้วยไฟล์ migration ใหม่เสมอ ห้ามแก้ไฟล์ที่ deploy แล้ว · ทุกกฎใหม่ต้องมีเคสใน `supabase/tests/*_test.sql`
