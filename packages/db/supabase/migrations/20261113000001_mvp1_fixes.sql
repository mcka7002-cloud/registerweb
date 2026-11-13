-- MVP1: แก้ปัญหาจาก review ของ migration 0001–0003 (docs/mvp1/contracts.md "Fixes from the review")
-- ห้ามแก้ไฟล์ migration เดิม · ทุกข้อมีเคสใน supabase/tests/mvp1_test.sql

-- ============================================================
-- 1. record_checkin: ตรวจ "เช็คชื่อแล้ว" ก่อนหา booking · ปฏิเสธแพ็กเกจที่เลย must_start_by
--    โดยยังไม่เริ่ม และแพ็กเกจของสาขาอื่น · ไม่มีสิทธิ์ = FORBIDDEN
-- ============================================================
create or replace function public.record_checkin(
  p_client_uuid uuid,
  p_branch uuid,
  p_barcode text,
  p_scanned_at timestamptz,
  p_class_session uuid,
  p_source public.attendance_source default 'online',
  p_method public.attendance_method default 'scan',
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_student public.students%rowtype;
  v_pkg public.student_packages%rowtype;
  v_booking public.bookings%rowtype;
  v_session public.class_sessions%rowtype;
  v_day date := (p_scanned_at at time zone 'Asia/Bangkok')::date;
  v_problem text;
  v_existing uuid;
  v_att uuid;
begin
  if not (public.has_branch(p_branch) and public.my_role() in ('admin', 'branch_manager', 'teacher', 'kiosk')) then
    raise exception 'FORBIDDEN';
  end if;

  select id into v_existing from public.attendances where client_uuid = p_client_uuid;
  if v_existing is not null then
    return jsonb_build_object('status', 'duplicate', 'attendance_id', v_existing);
  end if;
  if exists (select 1 from public.checkin_review_queue where client_uuid = p_client_uuid) then
    return jsonb_build_object('status', 'queued');
  end if;

  select * into v_student from public.students where code = p_barcode;
  select * into v_session from public.class_sessions where id = p_class_session and branch_id = p_branch;

  if v_student.id is null then
    v_problem := 'ไม่พบรหัสนักเรียน';
  elsif v_session.id is null or v_session.class_date <> v_day then
    v_problem := 'ไม่พบคลาสของวันนี้';
  elsif exists (select 1 from public.attendances a where a.student_id = v_student.id
                  and a.class_session_id = v_session.id and a.voided_at is null) then
    -- ต้องมาก่อนหา booking: เช็คชื่อแล้ว booking เปลี่ยนเป็น attended
    v_problem := 'เช็คชื่อคลาสนี้แล้ว';
  else
    select b.* into v_booking from public.bookings b
      where b.student_id = v_student.id and b.class_session_id = v_session.id and b.status = 'booked';
    if v_booking.id is null then
      v_problem := 'ไม่ได้จองคลาสนี้';
    else
      select * into v_pkg from public.student_packages where id = v_booking.student_package_id for update;
      if v_pkg.branch_id <> p_branch then
        v_problem := 'แพ็กเกจของสาขาอื่น';
      elsif v_pkg.status <> 'active'
         or (v_pkg.expires_on is not null and v_pkg.expires_on < v_day)
         or (v_pkg.starts_on is null and v_pkg.must_start_by < v_day) then
        v_problem := 'แพ็กเกจหมดอายุ';
      elsif v_pkg.sessions_total is not null and v_pkg.sessions_used >= v_pkg.sessions_total + v_pkg.bonus_sessions then
        v_problem := 'ครั้งคงเหลือ = 0';
      end if;
    end if;
  end if;

  if v_problem is not null then
    if p_source = 'offline_sync' then
      insert into public.checkin_review_queue (branch_id, client_uuid, student_id, barcode, scanned_at, problem)
        values (p_branch, p_client_uuid, v_student.id, p_barcode, p_scanned_at, v_problem);
      return jsonb_build_object('status', 'queued', 'problem', v_problem);
    end if;
    return jsonb_build_object('status', 'rejected', 'problem', v_problem,
      'student', v_student.nickname, 'student_name', nullif(trim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, '')), ''));
  end if;

  insert into public.attendances (branch_id, student_id, student_package_id, booking_id, class_session_id,
      client_uuid, scanned_at, method, source, recorded_by, reason)
    values (p_branch, v_student.id, v_pkg.id, v_booking.id, v_session.id,
      p_client_uuid, p_scanned_at, p_method, p_source, auth.uid(), p_reason)
    returning id into v_att;

  update public.student_packages
     set sessions_used = sessions_used + 1,
         starts_on = coalesce(starts_on, v_day),
         expires_on = coalesce(expires_on, v_day + duration_days - 1)
   where id = v_pkg.id;
  update public.bookings set status = 'attended' where id = v_booking.id;
  update public.students set exam_counter = exam_counter + 1 where id = v_student.id;

  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (p_branch, auth.uid(), 'checkin', 'attendances', v_att,
            jsonb_build_object('source', p_source, 'method', p_method, 'reason', p_reason));

  return jsonb_build_object('status', 'ok', 'attendance_id', v_att, 'student', v_student.nickname,
    'student_name', v_student.first_name || ' ' || v_student.last_name,
    'remaining', case when v_pkg.sessions_total is null then null
                      else v_pkg.sessions_total + v_pkg.bonus_sessions - v_pkg.sessions_used - 1 end);
end $$;

-- ============================================================
-- 2. ผู้ใช้ใหม่ใน auth.users → แถว profiles (role customer)
-- ============================================================
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''),
                   new.email, ''),
          coalesce(new.email, ''),
          'customer')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3. RLS
-- ============================================================
-- แก้ข้อมูลผู้เรียนผ่าน update_student เท่านั้น
drop policy students_staff_update on public.students;

-- staff เห็น profile เฉพาะคนในสาขาตัวเอง (staff ที่ผูกสาขา, ผู้ปกครองของผู้เรียน/ใบสมัครในสาขา) · admin เห็นทั้งหมด
create function public.staff_sees_profile(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.is_staff() and (
       exists (select 1 from public.profile_branches pb where pb.profile_id = p and public.has_branch(pb.branch_id))
    or exists (select 1 from public.registrations r where r.account_id = p and public.has_branch(r.branch_id))
    or exists (select 1 from public.student_accounts sa join public.students s on s.id = sa.student_id
                where sa.account_id = p and public.has_branch(s.branch_id))))
$$;
drop policy profiles_self on public.profiles;
create policy profiles_self on public.profiles for select to authenticated
  using (id = auth.uid() or public.staff_sees_profile(id));

-- รูปของโพสต์ที่เผยแพร่และเป็นสาธารณะเท่านั้น
drop policy post_media_public on public.post_media;
create policy post_media_public on public.post_media for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.status = 'published' and p.visibility = 'public'));

-- ============================================================
-- 4. ค่าทั้งระบบ (branch_id null) มีได้ค่าเดียวต่อ key / วัน
-- ============================================================
alter table public.price_settings drop constraint price_settings_branch_id_key_key;
alter table public.price_settings add constraint price_settings_branch_id_key_key unique nulls not distinct (branch_id, key);
alter table public.holidays drop constraint holidays_branch_id_holiday_date_key;
alter table public.holidays add constraint holidays_branch_id_holiday_date_key unique nulls not distinct (branch_id, holiday_date);

-- ค่าสอบสายดำ: ยังไม่มีราคาจาก Grill Session → 0 จน admin ตั้งค่า
insert into public.price_settings (branch_id, key, amount) values (null, 'exam_black', 0)
  on conflict (branch_id, key) do nothing;

-- ============================================================
-- 5. สิทธิ์เรียกฟังก์ชัน: ไม่ให้ใครโดยปริยาย ให้ทีละตัว
--    Supabase ตั้ง default privileges ให้ anon/authenticated ด้วย จึงถอนทั้งสาม
-- ============================================================
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- helper ที่ policy เรียก (ประเมินในสิทธิ์ของผู้ใช้)
grant execute on function public.my_role(), public.is_admin(), public.is_staff(), public.is_manager(),
  public.has_branch(uuid), public.owns_student(uuid), public.staff_sees_student(uuid), public.staff_sees_profile(uuid)
  to authenticated;
grant execute on function public.membership_next_expiry(date, date) to authenticated;
grant execute on function public.record_checkin(uuid, uuid, text, timestamptz, uuid, public.attendance_source,
  public.attendance_method, text) to authenticated;
-- nightly_job, build_teacher_days, membership_active, exam_eligible, handle_new_user: ไม่ให้ API role
