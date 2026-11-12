-- ฟังก์ชันฝั่ง server ที่บังคับกฎสำคัญของ Spec v1
-- เรียกจาก Route Handler ด้วย supabase.rpc(...) · ทุกฟังก์ชันเขียน audit_logs

-- ---------- ค่าสมาชิก ----------
-- ต่อก่อนหมด = วันหมดเดิม + 1 ปี · หมดแล้วค่อยต่อ = วันจ่าย + 1 ปี
create function public.membership_next_expiry(current_expiry date, paid_on date) returns date
language sql immutable as $$
  select (case when current_expiry is not null and current_expiry >= paid_on then current_expiry else paid_on end
          + interval '1 year')::date
$$;

create function public.membership_active(s uuid, on_date date default current_date) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select membership_expires_on >= on_date from public.students where id = s), false)
$$;

-- ---------- เช็คชื่อ (online และ offline sync ใช้ตัวเดียวกัน) ----------
-- idempotent ด้วย client_uuid: ส่งซ้ำได้ผลเดิม ไม่ตัดครั้งซ้ำ
-- ตรวจกฎด้วย scanned_at (เวลาสแกนจริง) ไม่ใช่เวลาที่ส่ง
-- ผิดกฎตอน sync = เข้า checkin_review_queue ไม่ทิ้งรายการ
create function public.record_checkin(
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
    raise exception 'not allowed for this branch';
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
  else
    select b.* into v_booking from public.bookings b
      where b.student_id = v_student.id and b.class_session_id = v_session.id and b.status = 'booked';
    if v_booking.id is null then
      v_problem := 'ไม่ได้จองคลาสนี้';
    else
      select * into v_pkg from public.student_packages where id = v_booking.student_package_id for update;
      if v_pkg.status <> 'active' or (v_pkg.expires_on is not null and v_pkg.expires_on < v_day) then
        v_problem := 'แพ็กเกจหมดอายุ';
      elsif v_pkg.sessions_total is not null and v_pkg.sessions_used >= v_pkg.sessions_total + v_pkg.bonus_sessions then
        v_problem := 'ครั้งคงเหลือ = 0';
      elsif exists (select 1 from public.attendances a where a.student_id = v_student.id
                      and a.class_session_id = v_session.id and a.voided_at is null) then
        v_problem := 'เช็คชื่อคลาสนี้แล้ว';
      end if;
    end if;
  end if;

  if v_problem is not null then
    if p_source = 'offline_sync' then
      insert into public.checkin_review_queue (branch_id, client_uuid, student_id, barcode, scanned_at, problem)
        values (p_branch, p_client_uuid, v_student.id, p_barcode, p_scanned_at, v_problem);
      return jsonb_build_object('status', 'queued', 'problem', v_problem);
    end if;
    return jsonb_build_object('status', 'rejected', 'problem', v_problem);
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
  -- ตัวนับก่อนสอบ: นับเฉพาะที่มาเรียนจริง (ทดลองเรียนไม่ผ่านฟังก์ชันนี้)
  update public.students set exam_counter = exam_counter + 1 where id = v_student.id;

  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (p_branch, auth.uid(), 'checkin', 'attendances', v_att,
            jsonb_build_object('source', p_source, 'method', p_method, 'reason', p_reason));

  return jsonb_build_object('status', 'ok', 'attendance_id', v_att, 'student', v_student.nickname,
    'remaining', case when v_pkg.sessions_total is null then null
                      else v_pkg.sessions_total + v_pkg.bonus_sessions - v_pkg.sessions_used - 1 end);
end $$;

-- ---------- สถานะสอบได้ ----------
create function public.exam_eligible(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select st.exam_counter >= r.classes_required
    from public.students st join public.belt_ranks r on r.id = st.belt_rank_id
   where st.id = s and exists (select 1 from public.belt_ranks n where n.id = st.belt_rank_id + 1)
$$;

-- ---------- เทียบวันสอนครู ----------
-- ขาดคลาสใดก็ตามในวันนั้น = ขาดทั้งวัน · ไม่ตรงระหว่าง ลงเอง vs เช็คชื่อ = mismatch รอ admin
create function public.build_teacher_days(p_run uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_month date; n int;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select period_month into v_month from public.payroll_runs where id = p_run and status = 'open';
  if v_month is null then raise exception 'payroll run not open'; end if;

  delete from public.teacher_days where payroll_run_id = p_run and resolved_result is null;

  insert into public.teacher_days (payroll_run_id, teacher_id, branch_id, work_date,
      classes_assigned, classes_taught, claimed, result)
  select p_run, a.teacher_id, s.branch_id, s.class_date,
         count(*),
         count(at.teacher_id),
         exists (select 1 from public.teacher_day_claims c where c.teacher_id = a.teacher_id
                   and c.branch_id = s.branch_id and c.work_date = s.class_date),
         case
           when count(at.teacher_id) < count(*) then 'absent'
           when not exists (select 1 from public.teacher_day_claims c where c.teacher_id = a.teacher_id
                              and c.branch_id = s.branch_id and c.work_date = s.class_date) then 'mismatch'
           else 'full'
         end
    from public.class_session_teachers a
    join public.class_sessions s on s.id = a.class_session_id and not s.cancelled
    left join public.attendance_teachers at on at.class_session_id = s.id and at.teacher_id = a.teacher_id
   where s.class_date >= v_month and s.class_date < (v_month + interval '1 month')::date
     and not exists (select 1 from public.holidays h where h.holiday_date = s.class_date
                       and (h.branch_id is null or h.branch_id = s.branch_id))
   group by a.teacher_id, s.branch_id, s.class_date
  on conflict (payroll_run_id, teacher_id, branch_id, work_date) do nothing;

  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- งานทุกคืน (pg_cron 00:30 เวลาไทย) ----------
-- idempotent: รันซ้ำได้ผลเดิม · outbox กันซ้ำด้วย dedupe_key
create function public.nightly_job(p_today date default (now() at time zone 'Asia/Bangkok')::date) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- จองแล้วไม่มา = ขาด
  update public.bookings b set status = 'absent'
    from public.class_sessions s
   where s.id = b.class_session_id and b.status = 'booked' and s.class_date < p_today;

  -- แพ็กเกจหมดอายุ (เริ่มแล้วเลยวันหมด หรือไม่เริ่มภายใน 1 ปีนับจากวันจ่าย)
  update public.student_packages set status = 'expired'
   where status = 'active' and ((expires_on is not null and expires_on < p_today)
                                or (starts_on is null and must_start_by < p_today));

  -- สมาชิกหมด = inactive (แพ็กเกจที่เหลือยังใช้ได้)
  update public.students set status = 'inactive'
   where status = 'active' and (membership_expires_on is null or membership_expires_on < p_today);
  update public.students set status = 'active'
   where status = 'inactive' and membership_expires_on >= p_today and anonymized_at is null;

  -- ขึ้นสถานะสอบได้
  update public.students st set exam_eligible_at = now()
   where exam_eligible_at is null and public.exam_eligible(st.id);

  -- แจ้งเตือนสมาชิกใกล้หมด 30 วัน
  insert into public.notification_outbox (channel, to_profile, to_address, template, payload, dedupe_key)
  select 'email', p.id, p.email, 'membership_expiring',
         jsonb_build_object('student_id', st.id, 'expires_on', st.membership_expires_on),
         'membership_expiring:' || st.id || ':' || p.id || ':' || st.membership_expires_on
    from public.students st
    join public.student_accounts sa on sa.student_id = st.id
    join public.profiles p on p.id = sa.account_id
   where st.membership_expires_on = p_today + 30
  on conflict (dedupe_key) do nothing;
end $$;
