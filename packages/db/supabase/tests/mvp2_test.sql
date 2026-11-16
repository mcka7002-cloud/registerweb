-- ทดสอบ migration 20261117000001_mvp2 (ครูประจำคลาส, ครูเช็คชื่อแทน, ยกเลิกเช็คชื่อ, ทดลองเรียน,
-- ยกเลิกใบเสร็จ, นำเข้า CSV, เชื่อมบัญชีผู้ปกครอง)
begin;

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL: %', label; end if;
  raise notice 'ok  %', label;
end $$;
create function pg_temp.err(q text) returns text language plpgsql as $$
begin
  execute q;
  return 'NO ERROR';
exception when others then
  return sqlerrm;
end $$;
create function pg_temp.today() returns date language sql stable as $$ select (now() at time zone 'Asia/Bangkok')::date $$;
create function pg_temp.as_user(u text) returns void language sql as $$ select set_config('test.uid', u, true) $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

grant usage on schema public, auth to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;

-- 1 admin · 2 ผู้จัดการ BKK · 3 ครู BKK · 4 ครู CNX · 5 ผู้ปกครอง · 6 ครู BKK คนที่สอง · 7 ผู้ปกครองคนที่สอง
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@demo.test', '{"full_name":"แอดมิน"}'),
  ('a0000000-0000-0000-0000-000000000002', 'manager@demo.test', '{"full_name":"ผู้จัดการ"}'),
  ('a0000000-0000-0000-0000-000000000003', 'teacher@demo.test', '{"full_name":"ครูหนึ่ง"}'),
  ('a0000000-0000-0000-0000-000000000004', 'teacher2@demo.test', '{"full_name":"ครูเชียงใหม่"}'),
  ('a0000000-0000-0000-0000-000000000005', 'parent@demo.test', '{"full_name":"คุณแม่"}'),
  ('a0000000-0000-0000-0000-000000000006', 'teacher3@demo.test', '{"full_name":"ครูสาม"}'),
  ('a0000000-0000-0000-0000-000000000007', 'Parent2@Demo.test', '{"full_name":"คุณพ่อ"}');
update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001';
update public.profiles set role = 'branch_manager' where id = 'a0000000-0000-0000-0000-000000000002';
update public.profiles set role = 'teacher' where id in ('a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000006');
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

-- คลาสประจำสัปดาห์ + คลาสเมื่อวาน / วันนี้ / สัปดาห์หน้า / ยกเลิก · คลาส CNX
insert into public.class_schedules (id, branch_id, weekday, starts_at, ends_at) values
  ('c1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', extract(dow from pg_temp.today())::int, '17:00', '18:00');
insert into public.class_sessions (id, branch_id, schedule_id, class_date, starts_at, ends_at, cancelled) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', null, pg_temp.today() - 1, '17:00', '18:00', false),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', pg_temp.today(), '17:00', '18:00', false),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', pg_temp.today() + 7, '17:00', '18:00', false),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', null, pg_temp.today() + 1, '10:00', '11:00', true),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', null, pg_temp.today(), '17:00', '18:00', false),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', pg_temp.today() - 7, '17:00', '18:00', false);

-- ============================================================
-- สิทธิ์เรียกฟังก์ชัน + pg_cron
-- ============================================================
select pg_temp.check((select bool_and(has_function_privilege('authenticated', f, 'execute') and not has_function_privilege('anon', f, 'execute'))
  from unnest(array['public.set_session_teachers(uuid,uuid[],boolean)', 'public.staff_checkin(uuid,uuid,uuid,text)',
    'public.void_attendance(uuid,text)', 'public.book_trial(uuid,uuid)', 'public.record_trial(uuid,boolean,jsonb)',
    'public.request_void_document(uuid,text)', 'public.review_void_document(uuid,boolean,text)',
    'public.import_students(uuid,jsonb,boolean)', 'public.link_parent(uuid,text)']) f), 'RPC ใหม่ grant ให้ authenticated เท่านั้น');
select pg_temp.check(not has_function_privilege('authenticated', 'public._parse_import_date(text)', 'execute'),
  'ฟังก์ชันภายใน _parse_import_date เรียกจาก API ไม่ได้');
create function pg_temp.cron_ok() returns boolean language plpgsql as $$
declare ok boolean;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then return true; end if;
  execute $q$select exists (select 1 from cron.job where jobname = 'registerweb-nightly' and schedule = '30 17 * * *')$q$ into ok;
  return ok;
end $$;
select pg_temp.check(pg_temp.cron_ok(),
  'pg_cron: nightly_job 00:30 เวลาไทย (ข้ามเมื่อไม่มี pg_cron)');

-- ============================================================
-- ผู้เรียน + แพ็กเกจ + จองคลาส
-- ============================================================
insert into public.registrations (id, branch_id, account_id, payload, pdpa_consent) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005',
   '{"first_name":"ด.ช.ต้น","last_name":"ใจดี","first_name_en":"Ton","last_name_en":"Jaidee","birth_date":"2017-05-01"}', true),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005',
   '{"first_name":"ด.ญ.ฟ้า","last_name":"ใจดี","first_name_en":"Fah","last_name_en":"Jaidee","birth_date":"2018-01-01"}', true);
select id as tpl8 from public.package_templates where name = '8 ครั้ง / 30 วัน' \gset

select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select (public.approve_registration('d0000000-0000-0000-0000-000000000001', '{}') ->> 'student_id') as sid \gset
select (public.sell_package(:'sid', :'tpl8', true, 'cash') ->> 'document_id') as doc1 \gset
select id as pkg1 from public.student_packages where student_id = :'sid' \gset
select public.book_sessions(:'pkg1', array['c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003']::uuid[]);
reset role;
-- คลาสเมื่อวาน (จองย้อนหลังผ่าน RPC ไม่ได้)
insert into public.bookings (id, branch_id, student_id, student_package_id, class_session_id, status, created_by) values
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', :'sid', :'pkg1', 'c0000000-0000-0000-0000-000000000001', 'booked', 'a0000000-0000-0000-0000-000000000003');

-- ============================================================
-- #16 ครูประจำคลาส
-- ============================================================
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select pg_temp.check(pg_temp.err($q$select public.set_session_teachers('c0000000-0000-0000-0000-000000000002', array['a0000000-0000-0000-0000-000000000003']::uuid[], false)$q$) = 'FORBIDDEN',
  'ครูตั้งครูประจำคลาสเองไม่ได้');
select pg_temp.check(pg_temp.err($q$insert into public.class_session_teachers values ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$) like '%row-level security%',
  'เขียนตาราง class_session_teachers ตรงไม่ได้');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.err($q$select public.set_session_teachers('c0000000-0000-0000-0000-000000000005', array[]::uuid[], false)$q$) = 'FORBIDDEN',
  'ผู้จัดการตั้งครูคลาสสาขาอื่นไม่ได้');
select pg_temp.check(pg_temp.err($q$select public.set_session_teachers('c0000000-0000-0000-0000-000000000004', array[]::uuid[], false)$q$) = 'SESSION_UNAVAILABLE',
  'คลาสที่ยกเลิก SESSION_UNAVAILABLE');
select pg_temp.check(pg_temp.err($q$select public.set_session_teachers('c0000000-0000-0000-0000-000000000002', array['a0000000-0000-0000-0000-000000000004']::uuid[], false)$q$) = 'TEACHER_NOT_IN_BRANCH',
  'ครูสาขาอื่น TEACHER_NOT_IN_BRANCH');
select pg_temp.check(pg_temp.err($q$select public.set_session_teachers('c0000000-0000-0000-0000-000000000002', array['a0000000-0000-0000-0000-000000000005']::uuid[], false)$q$) = 'TEACHER_NOT_IN_BRANCH',
  'ผู้ปกครองเป็นครูประจำคลาสไม่ได้');
select pg_temp.check((public.set_session_teachers('c0000000-0000-0000-0000-000000000002',
  array['a0000000-0000-0000-0000-000000000006']::uuid[], true) ->> 'sessions')::int = 2,
  'ทุกสัปดาห์: ตั้งครูให้คลาสวันนี้ + คลาสสัปดาห์หน้า (ไม่ย้อนหลัง)');
select pg_temp.check((select count(*) from public.class_session_teachers where class_session_id = 'c0000000-0000-0000-0000-000000000006') = 0,
  'คลาสที่ผ่านไปแล้วไม่ถูกแก้');
select pg_temp.check((public.set_session_teachers('c0000000-0000-0000-0000-000000000002',
  array['a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006']::uuid[], false) ->> 'sessions')::int = 1
  and (select count(*) from public.class_session_teachers where class_session_id = 'c0000000-0000-0000-0000-000000000002') = 1,
  'ส่งครูซ้ำ = บันทึกครั้งเดียว');

-- ============================================================
-- #18 ครูเช็คชื่อแทน
-- ============================================================
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');   -- ไม่ใช่ครูประจำคลาสวันนี้ (ครูสามเป็น)
select pg_temp.check(pg_temp.err(format('select public.staff_checkin(gen_random_uuid(), %L, %L, %L)',
  'c0000000-0000-0000-0000-000000000002', :'sid', 'ลืมบัตร')) = 'FORBIDDEN', 'ครูที่ไม่ได้ประจำคลาส เช็คชื่อแทนไม่ได้');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.err(format('select public.staff_checkin(gen_random_uuid(), %L, %L, %L)',
  'c0000000-0000-0000-0000-000000000002', :'sid', 'ลืมบัตร')) = 'FORBIDDEN', 'ครูสาขาอื่นเช็คชื่อแทนไม่ได้');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000006');
select pg_temp.check(pg_temp.err(format('select public.staff_checkin(gen_random_uuid(), %L, %L, %L)',
  'c0000000-0000-0000-0000-000000000002', :'sid', '  ')) = 'REASON_REQUIRED', 'ไม่ใส่เหตุผล REASON_REQUIRED');
select public.staff_checkin(gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002', :'sid', 'ลืมบัตร') as chk \gset
select pg_temp.check(:'chk'::jsonb ->> 'status' = 'ok' and (:'chk'::jsonb ->> 'remaining')::int = 7, 'ครูประจำคลาสเช็คชื่อแทนได้ เหลือ 7 ครั้ง');
select pg_temp.check((select method = 'manual' and reason = 'ลืมบัตร' and recorded_by = 'a0000000-0000-0000-0000-000000000006'
  from public.attendances where id = (:'chk'::jsonb ->> 'attendance_id')::uuid), 'บันทึกวิธี manual + เหตุผล + ผู้บันทึก');
select pg_temp.check(public.staff_checkin(gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002', :'sid', 'ลืมบัตร') ->> 'problem' = 'เช็คชื่อคลาสนี้แล้ว',
  'เช็คชื่อซ้ำ = เช็คชื่อคลาสนี้แล้ว');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');   -- คลาสสัปดาห์ก่อนไม่มีครูประจำ → ครูสาขาไหนก็ได้ (แต่ไม่ได้จอง)
select pg_temp.check(public.staff_checkin(gen_random_uuid(), 'c0000000-0000-0000-0000-000000000006', :'sid', 'ลืมบัตร') ->> 'problem' = 'ไม่พบคลาสของวันนี้',
  'คลาสไม่มีครูประจำ: ครูสาขาเช็คได้ แต่ยังใช้กฎของ record_checkin');
reset role;

-- เช็คชื่อคลาสเมื่อวาน (ผ่าน record_checkin ด้วยเวลาเมื่อวาน) เพื่อทดสอบยกเลิกแล้วกลายเป็น "ขาด"
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select (public.record_checkin(gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', (select code from public.students where id = :'sid'),
  ((pg_temp.today() - 1) + time '17:05') at time zone 'Asia/Bangkok', 'c0000000-0000-0000-0000-000000000001') ->> 'attendance_id') as att_past \gset
reset role;
select pg_temp.check((select sessions_used = 2 from public.student_packages where id = :'pkg1')
  and (select exam_counter = 2 from public.students where id = :'sid'), 'ก่อนยกเลิก: ใช้ไป 2 ครั้ง ตัวนับสอบ 2');

-- ============================================================
-- #20 admin ยกเลิกการเช็คชื่อ
-- ============================================================
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.check(pg_temp.err(format('select public.void_attendance(%L, %L)', :'chk'::jsonb ->> 'attendance_id', 'ผิดคน')) = 'FORBIDDEN',
  'ผู้จัดการยกเลิกการเช็คชื่อไม่ได้ (admin เท่านั้น)');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.err(format('select public.void_attendance(%L, %L)', :'chk'::jsonb ->> 'attendance_id', '')) = 'REASON_REQUIRED',
  'ยกเลิกไม่ใส่เหตุผล REASON_REQUIRED');
select public.void_attendance((:'chk'::jsonb ->> 'attendance_id')::uuid, 'เช็คชื่อผิดคน');
select pg_temp.check(pg_temp.err(format('select public.void_attendance(%L, %L)', :'chk'::jsonb ->> 'attendance_id', 'ซ้ำ')) = 'ALREADY_VOID',
  'ยกเลิกซ้ำ ALREADY_VOID');
select pg_temp.check((select sessions_used = 1 and starts_on is not null from public.student_packages where id = :'pkg1')
  and (select exam_counter = 1 from public.students where id = :'sid')
  and (select status = 'booked' from public.bookings where class_session_id = 'c0000000-0000-0000-0000-000000000002' and student_id = :'sid'),
  'ยกเลิกคลาสวันนี้: คืน 1 ครั้ง ตัวนับสอบ −1 การจองกลับเป็น "จองแล้ว" (ยังมีเช็คชื่ออื่น → วันเริ่มคงเดิม)');
select public.void_attendance(:'att_past', 'สแกนผิดคลาส');
select pg_temp.check((select sessions_used = 0 and starts_on is null and expires_on is null from public.student_packages where id = :'pkg1')
  and (select exam_counter = 0 from public.students where id = :'sid')
  and (select status = 'absent' from public.bookings where id = 'e0000000-0000-0000-0000-000000000001'),
  'ยกเลิกคลาสเมื่อวาน: การจองเป็น "ขาด" และแพ็กเกจกลับเป็นยังไม่เริ่ม');
select pg_temp.check((select data ->> 'reason' = 'เช็คชื่อผิดคน' from public.audit_logs
  where action = 'void_checkin' and entity_id = (:'chk'::jsonb ->> 'attendance_id')::uuid), 'audit log เก็บเหตุผลการยกเลิก');
-- เช็คชื่อใหม่ได้หลังยกเลิก
select pg_temp.as_user('a0000000-0000-0000-0000-000000000006');
select pg_temp.check(public.staff_checkin(gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002', :'sid', 'บัตรชำรุด') ->> 'status' = 'ok',
  'หลังยกเลิกแล้วเช็คชื่อใหม่ได้');
reset role;

-- ============================================================
-- #9 ทดลองเรียน + ประเมิน
-- ============================================================
select pg_temp.as_user('a0000000-0000-0000-0000-000000000005');
set local role authenticated;
select pg_temp.check(pg_temp.err($q$insert into public.registrations (branch_id, account_id, payload, pdpa_consent, trial_notes)
  values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', '{}', true, '{"note":"ปลอม"}')$q$) like '%row-level security%',
  'ลูกค้ากรอกผลทดลองเรียนเองไม่ได้');
select pg_temp.check(pg_temp.err($q$select public.book_trial('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003')$q$) = 'FORBIDDEN',
  'ลูกค้านัดทดลองเรียนเองไม่ได้');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.err($q$select public.book_trial('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003')$q$) = 'FORBIDDEN',
  'ครูสาขาอื่นนัดไม่ได้');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.err($q$select public.book_trial('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005')$q$) = 'SESSION_UNAVAILABLE',
  'คลาสสาขาอื่น SESSION_UNAVAILABLE');
select pg_temp.check(pg_temp.err($q$select public.book_trial('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004')$q$) = 'SESSION_UNAVAILABLE',
  'คลาสที่ยกเลิก SESSION_UNAVAILABLE');
select pg_temp.check(pg_temp.err($q$select public.book_trial('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001')$q$) = 'IN_PAST',
  'คลาสที่ผ่านไปแล้ว IN_PAST');
select pg_temp.check(pg_temp.err($q$select public.record_trial('d0000000-0000-0000-0000-000000000002', true, '{}')$q$) = 'NOT_TRIAL_BOOKED',
  'ยังไม่ได้นัด บันทึกผลไม่ได้');
select public.book_trial('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003');
select pg_temp.check(public.book_trial('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002') ->> 'trial_at' is not null,
  'เลื่อนนัดได้');
select pg_temp.check((select status = 'trial_booked' and trial_session_id = 'c0000000-0000-0000-0000-000000000002'
  and trial_at = (pg_temp.today() + time '17:00') at time zone 'Asia/Bangkok'
  from public.registrations where id = 'd0000000-0000-0000-0000-000000000002'), 'นัดทดลองเรียน: สถานะ + คลาส + เวลาเริ่มคลาส (เวลาไทย)');
select public.record_trial('d0000000-0000-0000-0000-000000000002', true,
  format('{"scores":{"flexibility":4,"strength":3,"focus":5,"listening":4},"note":"ตั้งใจดี","recommended_template_id":"%s"}', :'tpl8')::jsonb);
select pg_temp.check((select trial_attended_at is not null and trial_notes -> 'scores' ->> 'focus' = '5'
  from public.registrations where id = 'd0000000-0000-0000-0000-000000000002'), 'บันทึกผลประเมิน + มาเรียนแล้ว');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000005');
select pg_temp.check((select trial_at is not null from public.registrations where id = 'd0000000-0000-0000-0000-000000000002'),
  'ผู้ปกครองเห็นวันนัดทดลองเรียน');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select (public.approve_registration('d0000000-0000-0000-0000-000000000002', '{}') ->> 'student_id') as sid2 \gset
select pg_temp.check(pg_temp.err($q$select public.book_trial('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003')$q$) = 'NOT_PENDING',
  'อนุมัติแล้วนัดทดลองเรียนไม่ได้');
reset role;
select pg_temp.check((select trial_used_at is not null from public.students where id = :'sid2'), 'อนุมัติหลังทดลองเรียน → ใช้สิทธิ์ทดลองแล้ว');
select pg_temp.check((select trial_used_at is null from public.students where id = :'sid'), 'อนุมัติโดยไม่ทดลองเรียน → ยังไม่ใช้สิทธิ์');

-- ============================================================
-- #28 #55 ขอยกเลิกใบเสร็จ → admin อนุมัติ / ไม่อนุมัติ
-- ============================================================
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select (public.sell_package(:'sid2', :'tpl8', true, 'cash') ->> 'document_id') as doc2 \gset
select pg_temp.as_user('a0000000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.err(format('select public.request_void_document(%L, %L)', :'doc2', 'ผิด')) = 'FORBIDDEN', 'ครูสาขาอื่นขอยกเลิกไม่ได้');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.err(format('select public.request_void_document(%L, %L)', :'doc2', '')) = 'REASON_REQUIRED', 'ขอยกเลิกไม่ใส่เหตุผล');
select public.request_void_document(:'doc2', 'คิดเงินผิดแพ็กเกจ');
select pg_temp.check(pg_temp.err(format('select public.request_void_document(%L, %L)', :'doc2', 'อีกครั้ง')) = 'VOID_PENDING', 'ขอซ้ำ VOID_PENDING');
select pg_temp.check(pg_temp.err(format('select public.review_void_document(%L, true, null)', :'doc2')) = 'FORBIDDEN', 'ผู้จัดการอนุมัติเองไม่ได้');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.err(format('select public.review_void_document(%L, true, null)', :'doc1')) = 'NOT_REQUESTED', 'ยังไม่มีคำขอ NOT_REQUESTED');
select pg_temp.check(pg_temp.err(format('select public.review_void_document(%L, false, %L)', :'doc2', '')) = 'REASON_REQUIRED', 'ไม่อนุมัติต้องใส่เหตุผล');
select public.review_void_document(:'doc2', false, 'ราคาถูกแล้ว');
select pg_temp.check((select status = 'issued' and void_requested_at is null and void_reason is null from public.documents where id = :'doc2'),
  'ไม่อนุมัติ: ใบเสร็จคงเดิม คำขอถูกล้าง');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select public.request_void_document(:'doc2', 'คิดเงินผิดแพ็กเกจ');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select public.review_void_document(:'doc2', true, null);
select pg_temp.check((select status = 'void' and voided_by = 'a0000000-0000-0000-0000-000000000001' and void_reason = 'คิดเงินผิดแพ็กเกจ'
  from public.documents where id = :'doc2'), 'อนุมัติ: ใบเสร็จยกเลิกแล้ว + เหตุผลจากผู้ขอ');
select pg_temp.check((select bool_and(status = 'void') from public.student_packages where student_id = :'sid2'),
  'แพ็กเกจจากใบเสร็จนี้ถูกยกเลิก');
select pg_temp.check((select membership_expires_on is null from public.students where id = :'sid2')
  and (select bool_and(voided_at is not null) from public.memberships where student_id = :'sid2'),
  'สมาชิกจากใบเสร็จนี้ถูกยกเลิก วันหมดอายุสมาชิกกลับเป็นค่าเดิม (ไม่มี)');
select pg_temp.check(pg_temp.err(format('select public.request_void_document(%L, %L)', :'doc2', 'อีก')) = 'ALREADY_VOID', 'ยกเลิกแล้วขอซ้ำไม่ได้');
-- ใบเสร็จที่แพ็กเกจถูกใช้แล้ว
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select public.request_void_document(:'doc1', 'ทดสอบ');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.err(format('select public.review_void_document(%L, true, null)', :'doc1')) = 'PACKAGE_IN_USE',
  'แพ็กเกจมีการเช็คชื่อแล้ว PACKAGE_IN_USE');
reset role;
select pg_temp.check((select count(*) from public.audit_logs where action = 'request_void') = 3
  and (select count(*) from public.audit_logs where action = 'reject_void') = 1
  and (select count(*) from public.audit_logs where action = 'void_document') = 1, 'audit log: ขอ 3 ไม่อนุมัติ 1 อนุมัติ 1');

-- ============================================================
-- #37 นำเข้าผู้เรียนจาก CSV
-- ============================================================
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select pg_temp.check(pg_temp.err($q$select public.import_students('b0000000-0000-0000-0000-000000000001', '[]', false)$q$) = 'FORBIDDEN',
  'ครูนำเข้าไม่ได้');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.err($q$select public.import_students('b0000000-0000-0000-0000-000000000002', '[]', false)$q$) = 'FORBIDDEN',
  'ผู้จัดการนำเข้าสาขาอื่นไม่ได้');
select pg_temp.check(pg_temp.err(format('select public.import_students(%L, %L, false)', 'b0000000-0000-0000-0000-000000000001',
  (select jsonb_agg('{}'::jsonb) from generate_series(1, 501)))) = 'TOO_MANY', 'เกิน 500 แถว TOO_MANY');
select public.import_students('b0000000-0000-0000-0000-000000000001', $j$[
  {"code":"old-001","first_name":"สมชาย","last_name":"เดิม","first_name_en":"Somchai","last_name_en":"Derm","birth_date":"15/03/2555",
   "gender":"ชาย","belt":"สายเหลือง 1","membership_expires_on":"2027-03-31","guardian_name":"คุณแม่สมชาย","guardian_relation":"แม่","guardian_phone":"081-234-5678"},
  {"code":"OLD-001","first_name":"","last_name":"ซ้ำ","first_name_en":"Dup","last_name_en":"Code","birth_date":"2015-13-01","belt":"สายม่วง","gender":"x"},
  {"code":"S00001","first_name":"ก","last_name":"ข","first_name_en":"A","last_name_en":"B","birth_date":"2016-01-01","guardian_phone":"12"}
]$j$, true) as imp \gset
select pg_temp.check((:'imp'::jsonb ->> 'created')::int = 0 and (:'imp'::jsonb ->> 'total')::int = 3, 'มีแถวผิด → ไม่นำเข้าเลย');
select pg_temp.check((select array_agg((e ->> 'row') || ':' || (e ->> 'field') || ':' || (e ->> 'code') order by e ->> 'row', e ->> 'field')
  from jsonb_array_elements(:'imp'::jsonb -> 'errors') e) = array['2:belt:BAD_BELT', '2:birth_date:BAD_DATE', '2:code:DUPLICATE_IN_FILE',
  '2:first_name:REQUIRED', '2:gender:BAD_GENDER', '3:code:CODE_TAKEN', '3:guardian_name:REQUIRED', '3:guardian_phone:BAD_PHONE'],
  'แจ้งข้อผิดพลาดรายแถว/ช่อง');
select public.import_students('b0000000-0000-0000-0000-000000000001', $j$[
  {"code":"old-001","first_name":"สมชาย","last_name":"เดิม","first_name_en":"Somchai","last_name_en":"Derm","birth_date":"15/03/2555",
   "gender":"ชาย","belt":"เหลือง 1","membership_expires_on":"2027-03-31","guardian_name":"คุณแม่สมชาย","guardian_relation":"แม่","guardian_phone":"081-234-5678"},
  {"first_name":"สมหญิง","last_name":"เดิม","first_name_en":"Somying","last_name_en":"Derm","birth_date":"2016-07-09","belt":"3"}
]$j$, false) as dry \gset
select pg_temp.check(jsonb_array_length(:'dry'::jsonb -> 'errors') = 0 and (:'dry'::jsonb ->> 'created')::int = 0
  and not exists (select 1 from public.students where code = 'OLD-001'), 'ตรวจอย่างเดียว (preview) ไม่สร้างข้อมูล');
select public.import_students('b0000000-0000-0000-0000-000000000001', $j$[
  {"code":"old-001","first_name":"สมชาย","last_name":"เดิม","first_name_en":"Somchai","last_name_en":"Derm","birth_date":"15/03/2555",
   "gender":"ชาย","belt":"เหลือง 1","membership_expires_on":"2027-03-31","guardian_name":"คุณแม่สมชาย","guardian_relation":"แม่","guardian_phone":"081-234-5678"},
  {"first_name":"สมหญิง","last_name":"เดิม","first_name_en":"Somying","last_name_en":"Derm","birth_date":"2016-07-09","belt":"3"}
]$j$, true) as imp2 \gset
select pg_temp.check((:'imp2'::jsonb ->> 'created')::int = 2, 'นำเข้า 2 คน');
reset role;
select pg_temp.check((select birth_date = '2012-03-15' and gender = 'male' and belt_rank_id = 1 and membership_expires_on = '2027-03-31'
  from public.students where code = 'OLD-001'), 'แปลงวันที่ พ.ศ. / เพศ / สาย / วันหมดสมาชิก');
select pg_temp.check((select phones = array['0812345678'] and relation = 'แม่' from public.guardians g
  join public.students s on s.id = g.student_id where s.code = 'OLD-001'), 'สร้างผู้ปกครอง + เบอร์ตัวเลขล้วน');
select pg_temp.check((select waive_reason = 'นำเข้าข้อมูลเดิม' and waived_by = 'a0000000-0000-0000-0000-000000000002'
  from public.memberships m join public.students s on s.id = m.student_id where s.code = 'OLD-001'), 'สมาชิกนำเข้าบันทึกเป็นยกเว้นโดยผู้นำเข้า');
select pg_temp.check((select code ~ '^S\d{5}$' and belt_rank_id = 3 from public.students where first_name = 'สมหญิง'),
  'ไม่มีรหัสเดิม → ได้รหัส S ใหม่');

-- ============================================================
-- เชื่อมบัญชีผู้ปกครอง
-- ============================================================
select id as sid3 from public.students where code = 'OLD-001' \gset
select pg_temp.as_user('a0000000-0000-0000-0000-000000000004');
set local role authenticated;
select pg_temp.check(pg_temp.err(format('select public.link_parent(%L, %L)', :'sid3', 'parent@demo.test')) = 'FORBIDDEN', 'ครูสาขาอื่นเชื่อมไม่ได้');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.err(format('select public.link_parent(%L, %L)', :'sid3', 'nobody@demo.test')) = 'ACCOUNT_NOT_FOUND', 'ไม่พบบัญชี');
select pg_temp.check(pg_temp.err(format('select public.link_parent(%L, %L)', :'sid3', 'teacher3@demo.test')) = 'ACCOUNT_NOT_FOUND',
  'บัญชีครูไม่ใช่ผู้ปกครอง');
select pg_temp.check(public.link_parent(:'sid3', ' PARENT@demo.test ') ->> 'full_name' = 'คุณแม่', 'เชื่อมด้วยอีเมล (ไม่สนตัวพิมพ์)');
select pg_temp.check(pg_temp.err(format('select public.link_parent(%L, %L)', :'sid3', 'parent@demo.test')) = 'ALREADY_LINKED', 'เชื่อมซ้ำ');
select public.link_parent(:'sid3', 'parent2@demo.test');
reset role;
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000009', 'parent3@demo.test');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select pg_temp.check(pg_temp.err(format('select public.link_parent(%L, %L)', :'sid3', 'parent3@demo.test')) = 'ACCOUNT_LIMIT', 'เกิน 2 บัญชี ACCOUNT_LIMIT');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from public.students where id = :'sid3') = 1, 'ผู้ปกครองเห็นผู้เรียนที่เชื่อมแล้ว');
reset role;

rollback;
