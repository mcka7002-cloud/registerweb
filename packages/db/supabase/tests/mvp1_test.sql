-- ทดสอบ migration MVP1 (fixes + RPC) · รันหลัง auth_stub.sql + migrations ทั้งหมด
-- RLS/grant: จำลองสิทธิ์ตั้งต้นของ Supabase แล้วสลับเป็น role authenticated / anon
begin;

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL: %', label; end if;
  raise notice 'ok  %', label;
end $$;
-- รันคำสั่งแล้วคืนข้อความ error (หรือ 'NO ERROR') ในสิทธิ์ของ role ปัจจุบัน
create function pg_temp.err(q text) returns text language plpgsql as $$
begin
  execute q;
  return 'NO ERROR';
exception when others then
  return sqlerrm;
end $$;
create function pg_temp.today() returns date language sql stable as $$ select (now() at time zone 'Asia/Bangkok')::date $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- สิทธิ์ตั้งต้นแบบ Supabase
grant usage on schema public, auth to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;

-- ---------- ผู้ใช้ (trigger สร้าง profiles) ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@demo.test', '{"full_name":"แอดมิน"}'),
  ('a0000000-0000-0000-0000-000000000002', 'manager@demo.test', '{"full_name":"ผู้จัดการ"}'),
  ('a0000000-0000-0000-0000-000000000003', 'teacher@demo.test', '{"full_name":"ครูหนึ่ง"}'),
  ('a0000000-0000-0000-0000-000000000004', 'teacher2@demo.test', '{"full_name":"ครูสอง"}'),
  ('a0000000-0000-0000-0000-000000000005', 'parent@demo.test', '{"full_name":"คุณแม่"}'),
  ('a0000000-0000-0000-0000-000000000006', 'kiosk@demo.test', '{"name":"Kiosk"}'),
  ('a0000000-0000-0000-0000-000000000007', 'nobody@demo.test', null);

select pg_temp.check((select role = 'customer' and full_name = 'คุณแม่' and email = 'parent@demo.test'
  from public.profiles where id = 'a0000000-0000-0000-0000-000000000005'), 'trigger สร้าง profile role customer + full_name');
select pg_temp.check((select full_name from public.profiles where id = 'a0000000-0000-0000-0000-000000000006') = 'Kiosk', 'trigger ใช้ meta name ถ้าไม่มี full_name');
select pg_temp.check((select full_name from public.profiles where id = 'a0000000-0000-0000-0000-000000000007') = 'nobody@demo.test', 'trigger ใช้ email ถ้าไม่มีชื่อ');

update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001';
update public.profiles set role = 'branch_manager' where id = 'a0000000-0000-0000-0000-000000000002';
update public.profiles set role = 'teacher' where id in ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004');
update public.profiles set role = 'kiosk' where id = 'a0000000-0000-0000-0000-000000000006';

insert into public.branches (id, code, name) values
  ('b0000000-0000-0000-0000-000000000001', 'BKK', 'สาขาหลัก'),
  ('b0000000-0000-0000-0000-000000000002', 'CNX', 'สาขาเชียงใหม่');
insert into public.branch_settings (branch_id, vat_enabled, vat_inclusive, vat_rate) values
  ('b0000000-0000-0000-0000-000000000001', true, true, 7);
insert into public.profile_branches values
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001');

-- คลาส (17:00 ตายตัว) · schedule 19:00 ทุกวันไว้ทดสอบ generate
insert into public.class_sessions (id, branch_id, class_date, starts_at, ends_at, cancelled) values
  ('c0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', pg_temp.today(), '17:00', '18:00', false),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', pg_temp.today() + 1, '17:00', '18:00', false),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', pg_temp.today() + 2, '17:00', '18:00', false),
  ('c0000000-0000-0000-0000-000000000040', 'b0000000-0000-0000-0000-000000000001', pg_temp.today() + 40, '17:00', '18:00', false),
  ('c0000000-0000-0000-0000-0000000000ff', 'b0000000-0000-0000-0000-000000000001', pg_temp.today() - 1, '17:00', '18:00', false),
  ('c0000000-0000-0000-0000-0000000000cc', 'b0000000-0000-0000-0000-000000000001', pg_temp.today() + 3, '17:00', '18:00', true),
  ('c0000000-0000-0000-0000-0000000000b2', 'b0000000-0000-0000-0000-000000000002', pg_temp.today() + 1, '17:00', '18:00', false);
insert into public.class_schedules (branch_id, weekday, starts_at, ends_at)
  select 'b0000000-0000-0000-0000-000000000001', d, '19:00', '20:00' from generate_series(0, 6) d;
insert into public.holidays (branch_id, holiday_date, name) values ('b0000000-0000-0000-0000-000000000001', pg_temp.today() + 3, 'วันหยุด');

-- ============================================================
-- สิทธิ์เรียกฟังก์ชัน
-- ============================================================
select pg_temp.check(not has_function_privilege('authenticated', 'public.nightly_job(date)', 'execute')
                 and not has_function_privilege('anon', 'public.nightly_job(date)', 'execute'), 'nightly_job ไม่ได้ grant ให้ anon/authenticated');
select pg_temp.check(not has_function_privilege('authenticated', 'public.build_teacher_days(uuid)', 'execute'), 'build_teacher_days ไม่ได้ grant');
select pg_temp.check((select bool_and(has_function_privilege('authenticated', f, 'execute') and not has_function_privilege('anon', f, 'execute'))
  from unnest(array['public.generate_class_sessions(uuid,date,date)', 'public.approve_registration(uuid,jsonb)',
    'public.reject_registration(uuid,text)', 'public.update_student(uuid,jsonb)',
    'public.sell_package(uuid,uuid,boolean,public.payment_method)', 'public.book_sessions(uuid,uuid[])',
    'public.cancel_booking(uuid)', 'public.my_home()',
    'public.record_checkin(uuid,uuid,text,timestamptz,uuid,public.attendance_source,public.attendance_method,text)']) f),
  'RPC ทุกตัว grant ให้ authenticated เท่านั้น ไม่ให้ anon');

select set_config('test.uid', 'a0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select pg_temp.check(pg_temp.err('select public.nightly_job()') like 'permission denied%', 'admin (authenticated) เรียก nightly_job ไม่ได้');
reset role;
select set_config('test.uid', '', true);
set local role anon;
select pg_temp.check(pg_temp.err('select public.nightly_job()') like 'permission denied%', 'anon เรียก nightly_job ไม่ได้');
select pg_temp.check(pg_temp.err($q$select public.record_checkin(gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'x', now(), null)$q$) like 'permission denied%', 'anon เรียก record_checkin ไม่ได้');
reset role;

-- ============================================================
-- compute_vat (ตรงกับ packages/domain/src/vat.ts)
-- ============================================================
select pg_temp.check((select net = 2336.45 and vat = 163.55 and total = 2500 from public.compute_vat(2500, true, true, 7)), 'VAT 2500 รวมใน 7%');
select pg_temp.check((select net = 2500 and vat = 175 and total = 2675 from public.compute_vat(2500, true, false, 7)), 'VAT 2500 แยกนอก 7%');
select pg_temp.check((select net = 1682.24 and vat = 117.76 and total = 1800 from public.compute_vat(1800, true, true, 7)), 'VAT 1800 รวมใน 7%');
select pg_temp.check((select net = 1800 and vat = 0 and total = 1800 from public.compute_vat(1800, false, true, 7)), 'ปิด VAT = ไม่คิด');

-- ============================================================
-- ค่าตั้งต้นและ unique nulls not distinct
-- ============================================================
select pg_temp.check(exists (select 1 from public.price_settings where branch_id is null and key = 'exam_black'), 'มีราคา exam_black');
select pg_temp.check(pg_temp.err($q$insert into public.price_settings (branch_id, key, amount) values (null, 'exam_color', 5)$q$) like '%unique%', 'price_settings ค่ากลางซ้ำ key ไม่ได้');
select pg_temp.check(pg_temp.err($q$insert into public.holidays (branch_id, holiday_date) values (null, '2026-12-31'), (null, '2026-12-31')$q$) like '%unique%', 'holidays ค่ากลางซ้ำวันไม่ได้');

-- ============================================================
-- generate_class_sessions
-- ============================================================
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000003', true);   -- ครู
set local role authenticated;
select pg_temp.check(pg_temp.err(format('select public.generate_class_sessions(%L, %L, %L)', 'b0000000-0000-0000-0000-000000000001', pg_temp.today(), pg_temp.today() + 13)) = 'FORBIDDEN', 'ครูสร้างคลาสไม่ได้ FORBIDDEN');
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000002', true);   -- ผู้จัดการ BKK
select pg_temp.check(pg_temp.err(format('select public.generate_class_sessions(%L, %L, %L)', 'b0000000-0000-0000-0000-000000000002', pg_temp.today(), pg_temp.today() + 13)) = 'FORBIDDEN', 'ผู้จัดการสาขาอื่น FORBIDDEN');
select pg_temp.check((public.generate_class_sessions('b0000000-0000-0000-0000-000000000001', pg_temp.today(), pg_temp.today() + 13) ->> 'created')::int = 13, 'สร้างคลาส 14 วัน ข้ามวันหยุด = 13');
select pg_temp.check((public.generate_class_sessions('b0000000-0000-0000-0000-000000000001', pg_temp.today(), pg_temp.today() + 13) ->> 'created')::int = 0, 'สร้างซ้ำ = ข้ามที่มีแล้ว');
reset role;
select pg_temp.check((select count(*) from public.audit_logs where action = 'generate_sessions') = 2, 'generate เขียน audit');

-- ============================================================
-- registrations: ลูกค้าส่งฟอร์มเอง → ครูอนุมัติ/ปฏิเสธ
-- ============================================================
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000005', true);
set local role authenticated;
insert into public.registrations (id, branch_id, account_id, payload, pdpa_consent, publish_consent) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005',
   '{"first_name":"ด.ช.ต้น","last_name":"ใจดี","first_name_en":"Ton","last_name_en":"Jaidee","nickname":"ต้น","birth_date":"2017-05-01",
     "guardians":[{"full_name":"คุณแม่","relation":"แม่","phones":["0810000000"]}]}', true, true),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005',
   '{"first_name":"ด.ญ.ฝน"}', true, false),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005',
   '{"first_name":"ด.ญ.ฟ้า","last_name":"ใจดี","first_name_en":"Fah","last_name_en":"Jaidee","birth_date":"2018-01-01"}', true, false);
select pg_temp.check(pg_temp.err($q$select public.reject_registration('d0000000-0000-0000-0000-000000000002', 'x')$q$) = 'FORBIDDEN', 'ลูกค้าปฏิเสธใบสมัครไม่ได้ FORBIDDEN');
select pg_temp.check(pg_temp.err($q$select public.approve_registration('d0000000-0000-0000-0000-000000000001', '{}')$q$) = 'FORBIDDEN', 'ลูกค้าอนุมัติไม่ได้ FORBIDDEN');

select set_config('test.uid', 'a0000000-0000-0000-0000-000000000004', true);   -- ครูสาขาอื่น
select pg_temp.check(pg_temp.err($q$select public.approve_registration('d0000000-0000-0000-0000-000000000001', '{}')$q$) = 'FORBIDDEN', 'ครูสาขาอื่นอนุมัติไม่ได้ FORBIDDEN');

select set_config('test.uid', 'a0000000-0000-0000-0000-000000000003', true);   -- ครู BKK
select public.approve_registration('d0000000-0000-0000-0000-000000000001', '{"nickname":"ต้นน้อย","height_cm":"125"}') as approved \gset
select pg_temp.check((:'approved'::jsonb ->> 'code') = 'S00001', 'อนุมัติ → รหัส S00001');
select (:'approved'::jsonb ->> 'student_id') as sid \gset
select pg_temp.check(pg_temp.err($q$select public.approve_registration('d0000000-0000-0000-0000-000000000001', '{}')$q$) = 'NOT_PENDING', 'อนุมัติซ้ำ NOT_PENDING');
select pg_temp.check(pg_temp.err($q$select public.approve_registration('d0000000-0000-0000-0000-000000000002', '{}')$q$) = 'FIELDS_REQUIRED', 'ข้อมูลไม่ครบ FIELDS_REQUIRED');
select pg_temp.check(pg_temp.err($q$select public.reject_registration('d0000000-0000-0000-0000-000000000002', '  ')$q$) = 'REASON_REQUIRED', 'ปฏิเสธไม่มีเหตุผล REASON_REQUIRED');
select pg_temp.check(public.reject_registration('d0000000-0000-0000-0000-000000000002', 'อายุไม่ถึง') = '{}'::jsonb, 'ปฏิเสธใบสมัครได้');
select pg_temp.check(pg_temp.err($q$select public.reject_registration('d0000000-0000-0000-0000-000000000002', 'ซ้ำ')$q$) = 'NOT_PENDING', 'ปฏิเสธซ้ำ NOT_PENDING');
-- ข้ามเลขที่ถูกใช้ไปแล้ว (students.code unique ทั้งระบบ)
reset role;
insert into public.students (branch_id, code, first_name, last_name, first_name_en, last_name_en, birth_date)
  values ('b0000000-0000-0000-0000-000000000002', 'S00002', 'สาขาอื่น', 'x', 'x', 'x', '2015-01-01');
set local role authenticated;
select pg_temp.check((public.approve_registration('d0000000-0000-0000-0000-000000000003', null) ->> 'code') = 'S00003', 'รหัสข้ามเลขที่ใช้แล้ว → S00003');
reset role;

select pg_temp.check((select nickname = 'ต้นน้อย' and height_cm = 125 and branch_id = 'b0000000-0000-0000-0000-000000000001' and publish_consent
  from public.students where id = :'sid'), 'สร้างผู้เรียนจาก payload + p_student');
select pg_temp.check(exists (select 1 from public.student_accounts where student_id = :'sid' and account_id = 'a0000000-0000-0000-0000-000000000005'), 'ผูกผู้เรียนกับบัญชีผู้สมัคร');
select pg_temp.check((select count(*) from public.guardians where student_id = :'sid' and phones = '{0810000000}') = 1, 'สร้างผู้ปกครองจาก guardians');
select pg_temp.check((select status = 'approved' and student_id = :'sid' and reviewed_by = 'a0000000-0000-0000-0000-000000000003'
  from public.registrations where id = 'd0000000-0000-0000-0000-000000000001'), 'ใบสมัคร approved');
select pg_temp.check((select reject_reason from public.registrations where id = 'd0000000-0000-0000-0000-000000000002') = 'อายุไม่ถึง', 'บันทึกเหตุผลที่ปฏิเสธ');
select pg_temp.check((select count(*) from public.audit_logs where entity = 'registrations') = 3, 'อนุมัติ/ปฏิเสธเขียน audit');

-- ============================================================
-- RLS: profiles_self และแก้ students ตรงไม่ได้
-- ============================================================
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select pg_temp.check((select count(*) from public.profiles where id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005')) = 2, 'ครูเห็น profile staff และผู้ปกครองในสาขา');
select pg_temp.check((select count(*) from public.profiles where id in ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007')) = 0, 'ครูไม่เห็น profile สาขาอื่น/ไม่เกี่ยวข้อง');
update public.students set exam_counter = 99, nickname = 'แฮ็ก' where id = :'sid';
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000004', true);
select pg_temp.check((select count(*) from public.profiles where id = 'a0000000-0000-0000-0000-000000000005') = 0, 'ครูสาขาอื่นไม่เห็นผู้ปกครอง BKK');
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000001', true);
select pg_temp.check((select count(*) from public.profiles) = 7, 'admin เห็น profile ทั้งหมด');
reset role;
select pg_temp.check((select exam_counter = 0 and nickname = 'ต้นน้อย' from public.students where id = :'sid'), 'ครู UPDATE students ตรงไม่ได้');

-- ============================================================
-- update_student
-- ============================================================
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select pg_temp.check(pg_temp.err(format('select public.update_student(%L, %L)', :'sid', '{"nickname":"x"}')) = 'FORBIDDEN', 'ครูสาขาอื่นแก้ผู้เรียน FORBIDDEN');
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000003', true);
select pg_temp.check(public.update_student(:'sid', '{"nickname":"ต้น","weight_kg":"28.5","exam_counter":50,"belt_rank_id":5}') = '{}'::jsonb, 'update_student ได้');
reset role;
select pg_temp.check((select nickname = 'ต้น' and weight_kg = 28.5 and height_cm = 125 and exam_counter = 0 and belt_rank_id = 0
  from public.students where id = :'sid'), 'แก้เฉพาะฟิลด์ที่อนุญาต');

-- ============================================================
-- sell_package
-- ============================================================
select id as tpl8 from public.package_templates where name = '8 ครั้ง / 30 วัน' \gset
insert into public.package_templates (id, name, price, sessions, duration_days, is_active)
  values ('e0000000-0000-0000-0000-000000000001', 'เลิกขาย', 100, 1, 30, false);
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000005', true);
set local role authenticated;
select pg_temp.check(pg_temp.err(format('select public.sell_package(%L, %L, true, %L)', :'sid', :'tpl8', 'cash')) = 'FORBIDDEN', 'ลูกค้าขายไม่ได้ FORBIDDEN');
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000003', true);
select pg_temp.check(pg_temp.err(format('select public.sell_package(%L, %L, false, %L)', :'sid', :'tpl8', 'cash')) = 'MEMBERSHIP_REQUIRED', 'ยังไม่มีสมาชิก MEMBERSHIP_REQUIRED');
select pg_temp.check(pg_temp.err(format('select public.sell_package(%L, %L, true, %L)', :'sid', 'e0000000-0000-0000-0000-000000000001', 'cash')) = 'TEMPLATE_INACTIVE', 'แพ็กเกจเลิกขาย TEMPLATE_INACTIVE');
select public.sell_package(:'sid', :'tpl8', true, 'cash') as sale1 \gset
select pg_temp.check((:'sale1'::jsonb ->> 'doc_no') = 'RC-BKK-' || extract(year from pg_temp.today()) || '-00001'
                 and (:'sale1'::jsonb ->> 'total')::numeric = 3500, 'ขายแพ็กเกจ + สมาชิก → RC-BKK-ปี-00001 ยอด 3500');
select public.sell_package(:'sid', :'tpl8', false, 'transfer') as sale2 \gset
select pg_temp.check((:'sale2'::jsonb ->> 'doc_no') like '%-00002' and (:'sale2'::jsonb ->> 'total')::numeric = 2500, 'สมาชิกยังไม่หมด ขายแพ็กเกจอย่างเดียว เลขถัดไป');
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000005', true);
select pg_temp.check((select count(*) from public.documents) = 2, 'ผู้ปกครองเห็นใบเสร็จของตัวเอง');
reset role;
select pg_temp.check((select vat_amount = 228.97 and subtotal = 3271.03 and total = 3500 and status = 'approved'
    and account_id = 'a0000000-0000-0000-0000-000000000005'
  from public.orders where id = (:'sale1'::jsonb ->> 'order_id')::uuid), 'order: VAT รวมใน 7% ของ 3500');
select pg_temp.check((select vat_amount = 228.97 and vat_rate = 7 and customer_name = 'คุณแม่'
  from public.documents where id = (:'sale1'::jsonb ->> 'document_id')::uuid), 'ใบเสร็จมี VAT และชื่อลูกค้า');
select pg_temp.check((select count(*) from public.order_items where order_id = (:'sale1'::jsonb ->> 'order_id')::uuid) = 2, 'order มี 2 รายการ');
select pg_temp.check((select amount = 3500 and method = 'cash' from public.payments where order_id = (:'sale1'::jsonb ->> 'order_id')::uuid), 'บันทึกการชำระเงิน');
select pg_temp.check((select membership_expires_on = (pg_temp.today() + interval '1 year')::date from public.students where id = :'sid'), 'สมาชิกหมด = วันนี้ + 1 ปี');
select pg_temp.check((select count(*) = 1 from public.memberships where student_id = :'sid' and kind = 'new'), 'สร้าง memberships');
select pg_temp.check((select count(*) = 2 and bool_and(paid_on = pg_temp.today() and must_start_by = (pg_temp.today() + interval '1 year')::date
                       and sessions_total = 8 and starts_on is null)
  from public.student_packages where student_id = :'sid'), 'student_packages snapshot + must_start_by');
select pg_temp.check((select count(*) from public.audit_logs where action = 'sell_package') = 2, 'ขายเขียน audit');
select id as pkg from public.student_packages where order_item_id in
  (select id from public.order_items where order_id = (:'sale1'::jsonb ->> 'order_id')::uuid) \gset

-- ============================================================
-- book_sessions / cancel_booking
-- ============================================================
-- ผู้เรียนเพิ่มสำหรับเคสขอบ
insert into public.students (id, branch_id, code, first_name, last_name, first_name_en, last_name_en, birth_date, membership_expires_on)
  values ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'S90001', 'บี', 'ทดสอบ', 'B', 'T', '2015-01-01', pg_temp.today() + 100);
insert into public.student_packages (id, branch_id, student_id, name, price, sessions_total, duration_days, paid_on, must_start_by, starts_on, expires_on) values
  ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '1 ครั้ง', 100, 1, 30, pg_temp.today(), pg_temp.today() + 365, null, null),
  ('f1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'เลยกำหนดเริ่ม', 100, 4, 30, pg_temp.today() - 400, pg_temp.today() - 35, null, null),
  ('f1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'ใกล้หมด', 100, 4, 30, pg_temp.today() - 29, pg_temp.today() + 300, pg_temp.today() - 28, pg_temp.today() + 1),
  ('f1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'สาขาอื่น', 100, 4, 30, pg_temp.today(), pg_temp.today() + 365, null, null);

select set_config('test.uid', 'a0000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select pg_temp.check(pg_temp.err(format('select public.book_sessions(%L, %L)', :'pkg', '{c0000000-0000-0000-0000-000000000001}')) = 'FORBIDDEN', 'ครูสาขาอื่นจองไม่ได้ FORBIDDEN');
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000003', true);
select pg_temp.check((public.book_sessions(:'pkg', '{c0000000-0000-0000-0000-000000000000,c0000000-0000-0000-0000-000000000001}') ->> 'booked')::int = 2, 'จอง 2 คลาสได้');
select pg_temp.check(pg_temp.err(format('select public.book_sessions(%L, %L)', :'pkg', '{c0000000-0000-0000-0000-000000000001}')) = 'DUPLICATE', 'จองคลาสเดิมซ้ำ DUPLICATE');
select pg_temp.check(pg_temp.err(format('select public.book_sessions(%L, %L)', :'pkg', '{c0000000-0000-0000-0000-000000000002,c0000000-0000-0000-0000-000000000002}')) = 'DUPLICATE', 'คลาสซ้ำในรายการ DUPLICATE');
select pg_temp.check(pg_temp.err(format('select public.book_sessions(%L, %L)', :'pkg', '{c0000000-0000-0000-0000-0000000000ff}')) = 'IN_PAST', 'คลาสที่ผ่านไปแล้ว IN_PAST');
select pg_temp.check(pg_temp.err(format('select public.book_sessions(%L, %L)', :'pkg', '{c0000000-0000-0000-0000-000000000040}')) = 'OUT_OF_WINDOW', 'เกิน duration นับจากคลาสแรก OUT_OF_WINDOW');
select pg_temp.check(pg_temp.err(format('select public.book_sessions(%L, %L)', :'pkg', '{c0000000-0000-0000-0000-0000000000cc}')) = 'SESSION_UNAVAILABLE', 'คลาสยกเลิก SESSION_UNAVAILABLE');
select pg_temp.check(pg_temp.err(format('select public.book_sessions(%L, %L)', :'pkg', '{c0000000-0000-0000-0000-0000000000b2}')) = 'SESSION_UNAVAILABLE', 'คลาสสาขาอื่น SESSION_UNAVAILABLE');
select pg_temp.check(pg_temp.err($q$select public.book_sessions('f1000000-0000-0000-0000-000000000001', '{c0000000-0000-0000-0000-000000000001,c0000000-0000-0000-0000-000000000002}')$q$) = 'TOO_MANY', 'จองเกินครั้งคงเหลือ TOO_MANY');
select pg_temp.check(pg_temp.err($q$select public.book_sessions('f1000000-0000-0000-0000-000000000002', '{c0000000-0000-0000-0000-000000000001}')$q$) = 'PACKAGE_EXPIRED', 'เลย must_start_by PACKAGE_EXPIRED');
select pg_temp.check(pg_temp.err($q$select public.book_sessions('f1000000-0000-0000-0000-000000000003', '{c0000000-0000-0000-0000-000000000002}')$q$) = 'OUT_OF_WINDOW', 'เกินวันหมดอายุ OUT_OF_WINDOW');
select pg_temp.check(pg_temp.err($q$select public.book_sessions('f1000000-0000-0000-0000-000000000004', '{c0000000-0000-0000-0000-0000000000b2}')$q$) = 'FORBIDDEN', 'แพ็กเกจสาขาอื่น FORBIDDEN');

select id as bk1 from public.bookings where student_package_id = :'pkg' and class_session_id = 'c0000000-0000-0000-0000-000000000001' \gset
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000004', true);
select pg_temp.check(pg_temp.err(format('select public.cancel_booking(%L)', :'bk1')) = 'FORBIDDEN', 'ครูสาขาอื่นยกเลิกไม่ได้ FORBIDDEN');
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000003', true);
select pg_temp.check(public.cancel_booking(:'bk1') = '{}'::jsonb, 'ยกเลิกการจองได้');
select pg_temp.check(pg_temp.err(format('select public.cancel_booking(%L)', :'bk1')) = 'NOT_BOOKED', 'ยกเลิกซ้ำ NOT_BOOKED');
select pg_temp.check((public.book_sessions(:'pkg', '{c0000000-0000-0000-0000-000000000001}') ->> 'booked')::int = 1, 'จองใหม่คลาสที่เคยยกเลิกได้');
reset role;
select pg_temp.check((select status from public.bookings where id = :'bk1') = 'booked', 'ใช้แถว booking เดิม');
select pg_temp.check((select count(*) from public.audit_logs where entity in ('bookings') or action = 'book') = 3, 'จอง/ยกเลิกเขียน audit');

-- ============================================================
-- record_checkin (kiosk)
-- ============================================================
-- ผู้เรียนบี: booking ที่ใช้แพ็กเกจเลย must_start_by และแพ็กเกจสาขาอื่น (ใส่ตรงเพื่อทดสอบด่านเช็คชื่อ)
insert into public.bookings (branch_id, student_id, student_package_id, class_session_id, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003');

select set_config('test.uid', 'a0000000-0000-0000-0000-000000000005', true);
set local role authenticated;
select pg_temp.check(pg_temp.err(format('select public.record_checkin(gen_random_uuid(), %L, %L, now(), %L)',
  'b0000000-0000-0000-0000-000000000001', 'S00001', 'c0000000-0000-0000-0000-000000000000')) = 'FORBIDDEN', 'ลูกค้าเช็คชื่อไม่ได้ FORBIDDEN');
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000006', true);   -- kiosk
select public.record_checkin(gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'S00001', now(), 'c0000000-0000-0000-0000-000000000000') as ci \gset
select pg_temp.check((:'ci'::jsonb ->> 'status') = 'ok' and (:'ci'::jsonb ->> 'remaining')::int = 7, 'kiosk เช็คชื่อ → เหลือ 7');
select pg_temp.check((public.record_checkin(gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'S00001', now(),
  'c0000000-0000-0000-0000-000000000000') ->> 'problem') = 'เช็คชื่อคลาสนี้แล้ว', 'สแกนครั้งที่สอง = เช็คชื่อคลาสนี้แล้ว');
select pg_temp.check((public.record_checkin(gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'S90001', now(),
  'c0000000-0000-0000-0000-000000000000') ->> 'problem') = 'แพ็กเกจหมดอายุ', 'แพ็กเกจเลย must_start_by ที่ยังไม่เริ่ม = หมดอายุ');
reset role;
update public.bookings set student_package_id = 'f1000000-0000-0000-0000-000000000004'
 where student_id = 'f0000000-0000-0000-0000-000000000001' and class_session_id = 'c0000000-0000-0000-0000-000000000000';
set local role authenticated;
select pg_temp.check((public.record_checkin(gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'S90001', now(),
  'c0000000-0000-0000-0000-000000000000') ->> 'problem') = 'แพ็กเกจของสาขาอื่น', 'แพ็กเกจสาขาอื่นเช็คชื่อไม่ได้');
reset role;
select pg_temp.check((select sessions_used = 1 and starts_on = pg_temp.today() from public.student_packages where id = :'pkg'), 'ตัดครั้งเดียว แพ็กเกจเริ่มวันนี้');

-- ============================================================
-- my_home
-- ============================================================
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select pg_temp.check(public.my_home() = '{"role":"teacher","branches":[{"id":"b0000000-0000-0000-0000-000000000001","name":"สาขาหลัก"}]}'::jsonb, 'my_home ครู = สาขาของตัวเอง');
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000001', true);
select pg_temp.check(jsonb_array_length(public.my_home() -> 'branches') = 2 and public.my_home() ->> 'role' = 'admin', 'my_home admin = ทุกสาขา');
select set_config('test.uid', 'a0000000-0000-0000-0000-000000000005', true);
select pg_temp.check(public.my_home() ->> 'role' = 'customer' and jsonb_array_length(public.my_home() -> 'branches') = 1, 'my_home ลูกค้า = สาขาของผู้เรียน');
select set_config('test.uid', '', true);
select pg_temp.check(pg_temp.err('select public.my_home()') = 'FORBIDDEN', 'my_home ไม่ล็อกอิน FORBIDDEN');
reset role;

-- ============================================================
-- post_media_public: เฉพาะโพสต์ published + public
-- ============================================================
insert into public.posts (id, kind, visibility, status, title_th, author_id) values
  ('a1000000-0000-0000-0000-000000000001', 'news', 'public', 'published', 'สาธารณะ', 'a0000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000002', 'news', 'customers', 'published', 'ลูกค้าเท่านั้น', 'a0000000-0000-0000-0000-000000000001');
insert into public.post_media (post_id, path) values
  ('a1000000-0000-0000-0000-000000000001', 'a.jpg'), ('a1000000-0000-0000-0000-000000000002', 'b.jpg');
set local role anon;
select pg_temp.check((select count(*) from public.post_media) = 1, 'anon เห็นรูปเฉพาะโพสต์ public');
reset role;

rollback;
