-- ทดสอบกฎหลักของ Spec v1 บนฐานข้อมูลจริง (รันหลัง auth_stub.sql + migrations)
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/rules_test.sql
begin;

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL: %', label; end if;
  raise notice 'ok  %', label;
end $$;

-- ---------- ข้อมูลตั้งต้น ----------
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d');
insert into public.profiles (id, full_name, email, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', 'admin@gmail.com', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', 'ครูบี', 'teacher@gmail.com', 'teacher'),
  ('00000000-0000-0000-0000-00000000000c', 'แม่', 'mom@gmail.com', 'customer'),
  ('00000000-0000-0000-0000-00000000000d', 'พ่อ', 'dad@gmail.com', 'customer');
insert into public.branches (id, code, name) values ('10000000-0000-0000-0000-000000000001', 'BKK', 'สาขาหลัก');
insert into public.profile_branches values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001');
insert into public.students (id, branch_id, code, first_name, last_name, first_name_en, last_name_en, nickname, birth_date, membership_expires_on)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'S0001', 'ด.ช.เอ', 'ใจดี', 'A', 'Jaidee', 'เอ', '2016-01-01', '2027-01-01');
insert into public.class_sessions (id, branch_id, class_date, starts_at, ends_at) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-12', '17:00', '18:00'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '2026-11-13', '17:00', '18:00');
insert into public.student_packages (id, branch_id, student_id, name, price, sessions_total, duration_days, paid_on, must_start_by)
  values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
          '4 ครั้ง', 1800, 1, 30, '2026-11-10', '2027-11-10');
insert into public.bookings (id, branch_id, student_id, student_package_id, class_session_id, created_by) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b');

-- ---------- ค่าสมาชิก ----------
select pg_temp.check(public.membership_next_expiry('2027-01-01', '2026-12-15') = '2028-01-01', 'ต่อก่อนหมด = วันหมดเดิม + 1 ปี');
select pg_temp.check(public.membership_next_expiry('2026-01-01', '2026-11-12') = '2027-11-12', 'หมดแล้วต่อ = วันจ่าย + 1 ปี');
select pg_temp.check(public.membership_next_expiry(null, '2026-11-12') = '2027-11-12', 'สมัครครั้งแรก = วันจ่าย + 1 ปี');

-- ---------- บัญชีผู้ปกครองสูงสุด 2 ----------
insert into public.student_accounts values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c'),
                                           ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d');
do $$ begin
  insert into public.student_accounts values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a');
  raise exception 'FAIL: บัญชีที่ 3 ต้องถูกปฏิเสธ';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  ผูกบัญชีที่ 3 ไม่ได้';
end $$;

-- ---------- เช็คชื่อ ----------
select set_config('test.uid', '00000000-0000-0000-0000-00000000000b', true);   -- ครูบี

select pg_temp.check((public.record_checkin('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  'S0001', '2026-11-12 17:05+07', '30000000-0000-0000-0000-000000000001') ->> 'status') = 'ok', 'เช็คชื่อปกติผ่าน');
select pg_temp.check((public.record_checkin('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  'S0001', '2026-11-12 17:05+07', '30000000-0000-0000-0000-000000000001', 'offline_sync') ->> 'status') = 'duplicate', 'ส่ง client_uuid เดิมซ้ำ = duplicate');
select pg_temp.check((select sessions_used from public.student_packages where id = '40000000-0000-0000-0000-000000000001') = 1, 'ส่งซ้ำไม่ตัดครั้งซ้ำ');
select pg_temp.check((select starts_on = '2026-11-12' and expires_on = '2026-12-11' from public.student_packages where id = '40000000-0000-0000-0000-000000000001'), 'อายุแพ็กเกจนับจากวันเรียนครั้งแรก');
select pg_temp.check((select exam_counter from public.students where id = '20000000-0000-0000-0000-000000000001') = 1, 'ตัวนับก่อนสอบ +1');

-- offline: ครั้งหมดแล้ว → เข้าคิวครู ไม่ทิ้ง
select pg_temp.check((public.record_checkin('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
  'S0001', '2026-11-13 17:02+07', '30000000-0000-0000-0000-000000000002', 'offline_sync') ->> 'status') = 'queued', 'offline ผิดกฎ = เข้าคิว');
select pg_temp.check((select problem from public.checkin_review_queue where client_uuid = '60000000-0000-0000-0000-000000000002') = 'ครั้งคงเหลือ = 0', 'คิวบอกเหตุผล');
-- online ผิดกฎ = ปฏิเสธทันที ไม่เข้าคิว
select pg_temp.check((public.record_checkin('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
  'S0001', '2026-11-13 17:02+07', '30000000-0000-0000-0000-000000000002') ->> 'status') = 'rejected', 'online ผิดกฎ = rejected');
-- ไม่ได้จอง
select pg_temp.check((public.record_checkin('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
  'S0001', '2026-11-12 17:05+07', '30000000-0000-0000-0000-000000000002') ->> 'problem') = 'ไม่พบคลาสของวันนี้', 'สแกนคลาสผิดวัน');

-- ---------- งานทุกคืน ----------
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', true);
select public.nightly_job('2026-11-14');
select public.nightly_job('2026-11-14');   -- รันซ้ำ
select pg_temp.check((select status from public.bookings where id = '50000000-0000-0000-0000-000000000002') = 'absent', 'จองแล้วไม่มา = ขาด');
select pg_temp.check((select status from public.students where id = '20000000-0000-0000-0000-000000000001') = 'active', 'สมาชิกยังไม่หมด = active');
select public.nightly_job('2027-01-02');
select pg_temp.check((select status from public.students where id = '20000000-0000-0000-0000-000000000001') = 'inactive', 'สมาชิกหมด = inactive');
update public.students set membership_expires_on = '2027-01-31' where id = '20000000-0000-0000-0000-000000000001';
select public.nightly_job('2027-01-01');
select public.nightly_job('2027-01-01');
select pg_temp.check((select count(*) from public.notification_outbox where template = 'membership_expiring') = 2, 'เตือนสมาชิก 30 วันก่อน ส่งครั้งเดียวต่อบัญชี (2 บัญชี)');

-- ---------- สอบได้ ----------
update public.students set exam_counter = 12, exam_eligible_at = null, belt_rank_id = 0 where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.check(public.exam_eligible('20000000-0000-0000-0000-000000000001'), 'สายขาวครบ 12 ครั้ง = สอบได้');
update public.students set exam_counter = 13, belt_rank_id = 1 where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.check(not public.exam_eligible('20000000-0000-0000-0000-000000000001'), 'เหลือง 1 ต้อง 14 ครั้ง');
select pg_temp.check((select needs_admin_approval from public.belt_ranks where id = 11), 'สายดำต้อง admin อนุมัติ');

-- ---------- วันสอนครู ----------
insert into public.payroll_runs (id, period_month) values ('70000000-0000-0000-0000-000000000001', '2026-11-01');
insert into public.class_session_teachers values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b'),
                                                 ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b');
insert into public.class_sessions (id, branch_id, class_date, starts_at, ends_at) values
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '2026-11-13', '18:00', '19:00');
insert into public.class_session_teachers values ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b');
insert into public.attendance_teachers (class_session_id, teacher_id) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b');   -- 13 พ.ย. สอนแค่คลาสแรก
insert into public.teacher_day_claims (branch_id, teacher_id, work_date) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '2026-11-13');
select public.build_teacher_days('70000000-0000-0000-0000-000000000001');
select pg_temp.check((select result from public.teacher_days where work_date = '2026-11-12') = 'mismatch', 'สอนครบแต่ไม่ได้ลงวัน = mismatch รอ admin');
select pg_temp.check((select result from public.teacher_days where work_date = '2026-11-13') = 'absent', 'ขาดคลาสใดก็ตาม = ขาดทั้งวัน');
update public.payroll_runs set status = 'closed' where id = '70000000-0000-0000-0000-000000000001';
do $$ begin
  update public.teacher_days set resolved_result = 'full' where work_date = '2026-11-12';
  raise exception 'FAIL: ปิดรอบแล้วต้องแก้ไม่ได้';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  ปิดรอบเงินเดือนแล้วแก้ไม่ได้';
end $$;

-- ---------- เอกสารห้ามลบ ----------
do $$ begin
  delete from public.audit_logs;
  raise exception 'FAIL: audit ต้องลบไม่ได้';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok  audit_logs ลบไม่ได้';
end $$;

rollback;
