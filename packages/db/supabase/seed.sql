-- Seed สำหรับ local dev + demo เท่านั้น (supabase db reset รันไฟล์นี้หลัง migrations)
-- ผู้ใช้ทดสอบ (local เท่านั้น) รหัสผ่านเดียวกันทุกคน: Demo#2026
--   admin@demo.test · manager@demo.test · teacher@demo.test · parent@demo.test · kiosk@demo.test
-- ห้ามใช้ไฟล์นี้กับฐานข้อมูล production

-- ---------- สาขา ----------
insert into public.branches (id, code, name, address) values
  ('11111111-0000-0000-0000-000000000001', 'BKK', 'สาขาหลัก', 'กรุงเทพมหานคร');
insert into public.branch_settings (branch_id, vat_enabled, vat_inclusive, vat_rate) values
  ('11111111-0000-0000-0000-000000000001', true, true, 7);

-- ตารางคลาสประจำสัปดาห์: จ./พ./ศ. 17:00–18:00 · ส. 10:00–11:00 (0 = อาทิตย์)
insert into public.class_schedules (branch_id, weekday, starts_at, ends_at, capacity) values
  ('11111111-0000-0000-0000-000000000001', 1, '17:00', '18:00', 30),
  ('11111111-0000-0000-0000-000000000001', 3, '17:00', '18:00', 30),
  ('11111111-0000-0000-0000-000000000001', 5, '17:00', '18:00', 30),
  ('11111111-0000-0000-0000-000000000001', 6, '10:00', '11:00', 30);

-- ---------- ผู้ใช้ทดสอบ (auth.users + auth.identities · trigger สร้าง profiles) ----------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('Demo#2026', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name), now(), now(),
       '', '', '', ''
  from (values
    ('22222222-0000-0000-0000-000000000001'::uuid, 'admin@demo.test', 'แอดมิน ทดสอบ'),
    ('22222222-0000-0000-0000-000000000002'::uuid, 'manager@demo.test', 'ผู้จัดการ ทดสอบ'),
    ('22222222-0000-0000-0000-000000000003'::uuid, 'teacher@demo.test', 'ครูสมชาย ทดสอบ'),
    ('22222222-0000-0000-0000-000000000004'::uuid, 'parent@demo.test', 'คุณแม่ ทดสอบ'),
    ('22222222-0000-0000-0000-000000000005'::uuid, 'kiosk@demo.test', 'Kiosk สาขาหลัก')
  ) as u(id, email, full_name);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
  from auth.users u where u.email like '%@demo.test';

update public.profiles set role = 'admin' where id = '22222222-0000-0000-0000-000000000001';
update public.profiles set role = 'branch_manager' where id = '22222222-0000-0000-0000-000000000002';
update public.profiles set role = 'teacher' where id = '22222222-0000-0000-0000-000000000003';
update public.profiles set role = 'kiosk' where id = '22222222-0000-0000-0000-000000000005';
insert into public.profile_branches (profile_id, branch_id)
select id, '11111111-0000-0000-0000-000000000001' from public.profiles
 where id in ('22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002',
              '22222222-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000005');
insert into public.teachers (profile_id, employment_status, daily_rate) values ('22222222-0000-0000-0000-000000000003', 'probation', 600);

-- ---------- คลาสสัปดาห์นี้และสัปดาห์หน้า (จันทร์ของสัปดาห์นี้ + 13 วัน) ----------
insert into public.class_sessions (branch_id, schedule_id, class_date, starts_at, ends_at, capacity)
select cs.branch_id, cs.id, d::date, cs.starts_at, cs.ends_at, cs.capacity
  from public.class_schedules cs
 cross join generate_series(date_trunc('week', (now() at time zone 'Asia/Bangkok')::date),
                            date_trunc('week', (now() at time zone 'Asia/Bangkok')::date) + interval '13 days',
                            interval '1 day') d
 where cs.is_active and extract(dow from d) = cs.weekday
on conflict (branch_id, class_date, starts_at) do nothing;

-- ---------- ใบสมัครของผู้ปกครอง ----------
insert into public.registrations (id, branch_id, account_id, payload, pdpa_consent, publish_consent, created_at) values
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004',
   '{"first_name":"ด.ช.ภูมิ","last_name":"ทดสอบ","first_name_en":"Phum","last_name_en":"Thodsob","nickname":"ภูมิ",
     "birth_date":"2017-03-15","gender":"male","height_cm":128,"medical_notes":"",
     "guardians":[{"full_name":"คุณแม่ ทดสอบ","relation":"แม่","phones":["0812345678"]}]}', true, true, now() - interval '7 days'),
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004',
   '{"first_name":"ด.ญ.ใบเตย","last_name":"ทดสอบ","first_name_en":"Baitoey","last_name_en":"Thodsob","nickname":"เตย",
     "birth_date":"2019-08-01","gender":"female",
     "guardians":[{"full_name":"คุณแม่ ทดสอบ","relation":"แม่","phones":["0812345678"]}]}', true, false, now());

-- ---------- ผู้เรียนตัวอย่าง: ครูอนุมัติ → ขายแพ็กเกจ + สมาชิก → จองคลาส (ผ่าน RPC จริงในนามครู) ----------
select set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-000000000003","role":"authenticated"}', false);
select set_config('request.jwt.claim.sub', '22222222-0000-0000-0000-000000000003', false);

select public.approve_registration('33333333-0000-0000-0000-000000000001', '{}');
select public.sell_package(
  (select student_id from public.registrations where id = '33333333-0000-0000-0000-000000000001'),
  (select id from public.package_templates where name = '8 ครั้ง / 30 วัน'),
  true, 'cash');
select public.book_sessions(
  (select sp.id from public.student_packages sp join public.registrations r on r.student_id = sp.student_id
    where r.id = '33333333-0000-0000-0000-000000000001' limit 1),
  (select array_agg(id) from (select id from public.class_sessions
                               where branch_id = '11111111-0000-0000-0000-000000000001'
                                 and class_date >= (now() at time zone 'Asia/Bangkok')::date
                               order by class_date, starts_at limit 4) s));

select set_config('request.jwt.claims', '', false);
select set_config('request.jwt.claim.sub', '', false);
