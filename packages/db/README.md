# @registerweb/db

Supabase ของระบบ: `supabase/migrations` (schema, RLS, ฟังก์ชัน) และ `supabase/tests` (SQL test ของกฎ Spec v1)

| คำสั่ง (รันที่ root) | ทำอะไร |
|---|---|
| `pnpm db:start` | เปิด Supabase local (ต้องมี Docker) |
| `pnpm db:reset` | ล้างแล้วรัน migrations ใหม่ทั้งหมด |
| `pnpm db:test` | รัน migrations บน Postgres เปล่า + `supabase/tests/*_test.sql` ทุกไฟล์ (ใช้ `DATABASE_URL`) |
| `pnpm db:types` | สร้าง TypeScript types ให้ `apps/web` |

`pnpm db:reset` รัน `supabase/seed.sql` ด้วย: สาขา BKK, ตารางคลาส, ผู้ใช้ทดสอบ `*@demo.test` (รหัสผ่านอยู่ในหัวไฟล์ seed, local เท่านั้น)

> **ห้ามรัน `seed.sql` บน cloud** (สร้างบัญชีที่มีรหัสผ่านเขียนไว้ในไฟล์ และ repo นี้เป็น public)

## ข้อมูลเดโมบน cloud

`supabase/demo/cloud_demo.sql` สร้างข้อมูลเดโมโดยผูกกับบัญชี Google จริง ไม่สร้างบัญชีหรือรหัสผ่าน

1. ผู้ที่จะใช้เดโม (admin, ครู, ผู้ปกครอง และ kiosk ถ้ามี) ล็อกอินเว็บด้วย Google คนละ 1 ครั้ง ใช้ Gmail คนละบัญชี
2. แก้อีเมลใน `DECLARE` ด้านบนของไฟล์
3. วางทั้งไฟล์ใน Supabase → SQL Editor → Run (ทำทั้งหมดหรือไม่ทำเลย)

ได้: สาขา BKK (VAT 7% รวมในราคา), คลาส จ./พ./ศ. 17:00 และ ส. 10:00 ล่วงหน้า 4 สัปดาห์, กำหนด role และสาขา,
นักเรียนตัวอย่าง 2 คนที่ขายแพ็กเกจ + ค่าสมาชิกและจองคลาสแล้ว และใบสมัครรออนุมัติ 1 ใบไว้สาธิต
รันซ้ำได้ (นักเรียนตัวอย่างสร้างครั้งเดียว) · ไม่มีสคริปต์ลบ เพราะใบเสร็จ การชำระเงิน และ audit ลบไม่ได้

กติกา: แก้ schema ด้วยไฟล์ migration ใหม่เสมอ ห้ามแก้ไฟล์ที่ deploy แล้ว · ทุกกฎใหม่ต้องมีเคสใน `supabase/tests/*_test.sql`
