-- MVP2 (go-live): ครูเช็คชื่อแทน + ครูประจำคลาส + ยกเลิกเช็คชื่อ, ทดลองเรียน + ประเมิน,
-- ขอ/อนุมัติยกเลิกใบเสร็จ, นำเข้าผู้เรียนจาก CSV, เชื่อมบัญชีผู้ปกครอง, ตั้งเวลา nightly_job ด้วย pg_cron
-- สัญญา: docs/mvp2/contracts.md

-- ============================================================
-- 1. Schema
-- ============================================================
alter type public.package_status add value if not exists 'void';

alter table public.registrations
  add column trial_session_id uuid references public.class_sessions(id),
  add column trial_attended_at timestamptz,
  add column trial_notes jsonb;

alter table public.documents add column void_requested_at timestamptz;
alter table public.memberships add column voided_at timestamptz;

-- ลูกค้าสมัครได้เฉพาะใบสมัครใหม่ที่ยังไม่มีข้อมูลทดลองเรียน
drop policy registrations_insert on public.registrations;
create policy registrations_insert on public.registrations for insert to authenticated
  with check (account_id = auth.uid() and status = 'pending' and reviewed_by is null and student_id is null
              and trial_at is null and trial_session_id is null and trial_attended_at is null and trial_notes is null);

-- ครูประจำคลาสแก้ผ่าน set_session_teachers เท่านั้น (นโยบายเดิมไม่ตรวจสาขา)
drop policy class_session_teachers_manage on public.class_session_teachers;

-- ============================================================
-- 2. ครูประจำคลาส
-- ============================================================
create function public.set_session_teachers(p_session uuid, p_teachers uuid[], p_whole_schedule boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.class_sessions%rowtype;
  v_targets uuid[];
  v_bad int;
begin
  if not public.is_manager() then raise exception 'FORBIDDEN'; end if;
  select * into s from public.class_sessions where id = p_session;
  if s.id is null or s.cancelled then raise exception 'SESSION_UNAVAILABLE'; end if;
  if not public.has_branch(s.branch_id) then raise exception 'FORBIDDEN'; end if;

  select count(*) into v_bad
    from unnest(coalesce(p_teachers, '{}')) t
   where not exists (select 1 from public.profiles p
                      where p.id = t and p.role in ('admin', 'branch_manager', 'teacher')
                        and (p.role = 'admin' or exists (select 1 from public.profile_branches pb
                                                          where pb.profile_id = p.id and pb.branch_id = s.branch_id)));
  if v_bad > 0 then raise exception 'TEACHER_NOT_IN_BRANCH'; end if;

  if coalesce(p_whole_schedule, false) and s.schedule_id is not null then
    select array_agg(id) into v_targets from public.class_sessions
     where schedule_id = s.schedule_id and branch_id = s.branch_id and not cancelled
       and (id = s.id or class_date >= public.bkk_today());
  else
    v_targets := array[s.id];
  end if;

  delete from public.class_session_teachers where class_session_id = any (v_targets);
  insert into public.class_session_teachers (class_session_id, teacher_id)
    select x, t from unnest(v_targets) x, (select distinct unnest(coalesce(p_teachers, '{}')) t) tt;

  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (s.branch_id, auth.uid(), 'set_session_teachers', 'class_sessions', s.id,
            jsonb_build_object('teachers', to_jsonb(coalesce(p_teachers, '{}')), 'sessions', cardinality(v_targets),
                               'whole_schedule', coalesce(p_whole_schedule, false)));
  return jsonb_build_object('sessions', cardinality(v_targets));
end $$;

-- ============================================================
-- 3. ครูเช็คชื่อแทน (ลืมบัตร ฯลฯ) และ admin ยกเลิกการเช็คชื่อ
-- ============================================================
create function public.staff_checkin(p_client_uuid uuid, p_session uuid, p_student uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.class_sessions%rowtype;
  v_role public.app_role := public.my_role();
  v_code text;
begin
  select * into s from public.class_sessions where id = p_session;
  if s.id is null or s.cancelled then raise exception 'SESSION_UNAVAILABLE'; end if;
  if not (v_role = 'admin'
          or (v_role = 'branch_manager' and public.has_branch(s.branch_id))
          or (v_role = 'teacher' and public.has_branch(s.branch_id)
              and (exists (select 1 from public.class_session_teachers t
                            where t.class_session_id = s.id and t.teacher_id = auth.uid())
                   or not exists (select 1 from public.class_session_teachers t where t.class_session_id = s.id)))) then
    raise exception 'FORBIDDEN';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;

  select code into v_code from public.students where id = p_student;
  return public.record_checkin(p_client_uuid, s.branch_id, coalesce(v_code, ''), now(), s.id,
                               'online', 'manual', trim(p_reason));
end $$;

create function public.void_attendance(p_attendance uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a public.attendances%rowtype;
  v_date date;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into a from public.attendances where id = p_attendance for update;
  if a.id is null then raise exception 'FORBIDDEN'; end if;
  if a.voided_at is not null then raise exception 'ALREADY_VOID'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;

  update public.attendances set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
   where id = a.id;

  if a.student_package_id is not null and not a.is_trial then
    update public.student_packages set sessions_used = greatest(sessions_used - 1, 0) where id = a.student_package_id;
    -- ครั้งแรกที่ใช้ถูกยกเลิก และไม่มีการเช็คชื่ออื่น → แพ็กเกจกลับเป็น "ยังไม่เริ่ม"
    if not exists (select 1 from public.attendances x
                    where x.student_package_id = a.student_package_id and x.voided_at is null) then
      update public.student_packages set starts_on = null, expires_on = null where id = a.student_package_id;
    end if;
  end if;

  if a.booking_id is not null then
    select s.class_date into v_date from public.class_sessions s where s.id = a.class_session_id;
    update public.bookings
       set status = case when v_date < public.bkk_today() then 'absent' else 'booked' end::public.booking_status
     where id = a.booking_id and status = 'attended';
  end if;

  if not a.is_trial then
    update public.students set exam_counter = greatest(exam_counter - 1, 0) where id = a.student_id;
  end if;

  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (a.branch_id, auth.uid(), 'void_checkin', 'attendances', a.id,
            jsonb_build_object('reason', trim(p_reason), 'student_id', a.student_id,
                               'class_session_id', a.class_session_id, 'method', a.method));
  return '{}'::jsonb;
end $$;

-- ============================================================
-- 4. ทดลองเรียน + ประเมิน
-- ============================================================
create function public.book_trial(p_registration uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.registrations%rowtype;
  s public.class_sessions%rowtype;
  v_at timestamptz;
begin
  select * into r from public.registrations where id = p_registration for update;
  if r.id is null or not (public.is_staff() and public.has_branch(r.branch_id)) then raise exception 'FORBIDDEN'; end if;
  if r.status not in ('pending', 'trial_booked') then raise exception 'NOT_PENDING'; end if;
  select * into s from public.class_sessions where id = p_session;
  if s.id is null or s.cancelled or s.branch_id <> r.branch_id then raise exception 'SESSION_UNAVAILABLE'; end if;
  if s.class_date < public.bkk_today() then raise exception 'IN_PAST'; end if;

  v_at := (s.class_date + s.starts_at) at time zone 'Asia/Bangkok';
  update public.registrations
     set status = 'trial_booked', trial_session_id = s.id, trial_at = v_at,
         trial_attended_at = null, trial_notes = null
   where id = r.id;
  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (r.branch_id, auth.uid(), 'book_trial', 'registrations', r.id,
            jsonb_build_object('class_session_id', s.id, 'trial_at', v_at));
  return jsonb_build_object('trial_at', v_at);
end $$;

create function public.record_trial(p_registration uuid, p_attended boolean, p_notes jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.registrations%rowtype;
begin
  select * into r from public.registrations where id = p_registration for update;
  if r.id is null or not (public.is_staff() and public.has_branch(r.branch_id)) then raise exception 'FORBIDDEN'; end if;
  if r.status <> 'trial_booked' then raise exception 'NOT_TRIAL_BOOKED'; end if;

  update public.registrations
     set trial_attended_at = case when coalesce(p_attended, false) then coalesce(trial_attended_at, now()) end,
         trial_notes = case when jsonb_typeof(p_notes) = 'object' then p_notes else '{}'::jsonb end
   where id = r.id;
  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (r.branch_id, auth.uid(), 'record_trial', 'registrations', r.id,
            jsonb_build_object('attended', coalesce(p_attended, false)));
  return '{}'::jsonb;
end $$;

-- อนุมัติใบสมัครที่ทดลองเรียนแล้ว → students.trial_used_at (ใช้สิทธิ์ทดลองเรียนแล้ว)
create function public.registration_trial_used() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and new.student_id is not null and new.trial_attended_at is not null then
    update public.students set trial_used_at = coalesce(trial_used_at, new.trial_attended_at) where id = new.student_id;
  end if;
  return new;
end $$;
create trigger registrations_trial_used after update of status on public.registrations
  for each row when (old.status is distinct from new.status) execute function public.registration_trial_used();

-- ============================================================
-- 5. ยกเลิกใบเสร็จ: ผู้จัดการ/ครูขอ → admin อนุมัติในคิวตรวจ
-- ============================================================
create function public.request_void_document(p_document uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d public.documents%rowtype;
begin
  select * into d from public.documents where id = p_document for update;
  if d.id is null or not (public.is_staff() and public.has_branch(d.branch_id)) then raise exception 'FORBIDDEN'; end if;
  if d.status = 'void' then raise exception 'ALREADY_VOID'; end if;
  if d.void_requested_at is not null then raise exception 'VOID_PENDING'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;

  update public.documents
     set void_reason = trim(p_reason), void_requested_by = auth.uid(), void_requested_at = now()
   where id = d.id;
  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (d.branch_id, auth.uid(), 'request_void', 'documents', d.id,
            jsonb_build_object('doc_no', d.doc_no, 'total', d.total, 'reason', trim(p_reason)));
  return '{}'::jsonb;
end $$;

create function public.review_void_document(p_document uuid, p_approve boolean, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d public.documents%rowtype;
  v_items uuid[];
  v_pkgs uuid[];
  v_students uuid[];
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into d from public.documents where id = p_document for update;
  if d.id is null then raise exception 'FORBIDDEN'; end if;
  if d.status = 'void' then raise exception 'ALREADY_VOID'; end if;
  if d.void_requested_at is null then raise exception 'NOT_REQUESTED'; end if;

  if not coalesce(p_approve, false) then
    if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
    update public.documents set void_reason = null, void_requested_by = null, void_requested_at = null where id = d.id;
    insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
      values (d.branch_id, auth.uid(), 'reject_void', 'documents', d.id,
              jsonb_build_object('doc_no', d.doc_no, 'reason', trim(p_reason),
                                 'requested_by', d.void_requested_by, 'request_reason', d.void_reason));
    return '{}'::jsonb;
  end if;

  select array_agg(id) into v_items from public.order_items where order_id = d.order_id;
  select array_agg(id) into v_pkgs from public.student_packages where order_item_id = any (coalesce(v_items, '{}'));
  if exists (select 1 from public.student_packages where id = any (coalesce(v_pkgs, '{}')) and sessions_used > 0)
     or exists (select 1 from public.attendances where student_package_id = any (coalesce(v_pkgs, '{}'))
                  and voided_at is null) then
    raise exception 'PACKAGE_IN_USE';
  end if;

  update public.student_packages set status = 'void' where id = any (coalesce(v_pkgs, '{}'));
  update public.bookings set status = 'cancelled'
   where student_package_id = any (coalesce(v_pkgs, '{}')) and status = 'booked';

  with m as (
    update public.memberships set voided_at = now()
     where order_item_id = any (coalesce(v_items, '{}')) and voided_at is null
    returning student_id)
  select array_agg(distinct student_id) into v_students from m;
  update public.students st
     set membership_expires_on = (select max(m.expires_on) from public.memberships m
                                   where m.student_id = st.id and m.voided_at is null)
   where st.id = any (coalesce(v_students, '{}'));

  update public.documents set status = 'void', voided_by = auth.uid(), voided_at = now() where id = d.id;
  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (d.branch_id, auth.uid(), 'void_document', 'documents', d.id,
            jsonb_build_object('doc_no', d.doc_no, 'total', d.total, 'reason', d.void_reason,
                               'requested_by', d.void_requested_by, 'note', nullif(trim(coalesce(p_reason, '')), ''),
                               'packages', to_jsonb(coalesce(v_pkgs, '{}')),
                               'memberships_students', to_jsonb(coalesce(v_students, '{}'))));
  return '{}'::jsonb;
end $$;

-- ============================================================
-- 6. นำเข้าผู้เรียนเดิมจาก CSV
-- ============================================================
-- 'YYYY-MM-DD' หรือ 'DD/MM/YYYY' (ปี พ.ศ. ≥ 2400 แปลงเป็น ค.ศ.) · ไม่ถูกต้อง = null
create function public._parse_import_date(p text) returns date
language plpgsql immutable set search_path = public as $$
declare
  m text[];
  y int;
begin
  p := trim(coalesce(p, ''));
  if p ~ '^\d{4}-\d{1,2}-\d{1,2}$' then
    m := regexp_match(p, '^(\d{4})-(\d{1,2})-(\d{1,2})$');
    y := m[1]::int;
    if y >= 2400 then y := y - 543; end if;
    return make_date(y, m[2]::int, m[3]::int);
  elsif p ~ '^\d{1,2}/\d{1,2}/\d{4}$' then
    m := regexp_match(p, '^(\d{1,2})/(\d{1,2})/(\d{4})$');
    y := m[3]::int;
    if y >= 2400 then y := y - 543; end if;
    return make_date(y, m[2]::int, m[1]::int);
  end if;
  return null;
exception when others then
  return null;
end $$;

create function public.import_students(p_branch uuid, p_rows jsonb, p_commit boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  n int := 0;
  errs jsonb := '[]'::jsonb;
  parsed jsonb := '[]'::jsonb;
  v_code text;
  v_codes text[] := '{}';
  v_birth date;
  v_exp date;
  v_belt smallint;
  v_belt_txt text;
  v_gender text;
  v_phone text;
  p jsonb;
  v_no int;
  v_student uuid;
  v_created int := 0;
  v_today date := public.bkk_today();
  f text;
begin
  if not (public.is_manager() and public.has_branch(p_branch)) then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'BAD_INPUT'; end if;
  if jsonb_array_length(p_rows) > 500 then raise exception 'TOO_MANY'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    n := n + 1;
    if jsonb_typeof(r) <> 'object' then
      errs := errs || jsonb_build_object('row', n, 'field', 'first_name', 'code', 'REQUIRED');
      continue;
    end if;

    foreach f in array array['first_name', 'last_name', 'first_name_en', 'last_name_en', 'birth_date'] loop
      if coalesce(trim(r ->> f), '') = '' then
        errs := errs || jsonb_build_object('row', n, 'field', f, 'code', 'REQUIRED');
      end if;
    end loop;

    v_birth := public._parse_import_date(r ->> 'birth_date');
    if coalesce(trim(r ->> 'birth_date'), '') <> '' and (v_birth is null or v_birth > v_today) then
      errs := errs || jsonb_build_object('row', n, 'field', 'birth_date', 'code', 'BAD_DATE');
    end if;

    v_exp := public._parse_import_date(r ->> 'membership_expires_on');
    if coalesce(trim(r ->> 'membership_expires_on'), '') <> '' and v_exp is null then
      errs := errs || jsonb_build_object('row', n, 'field', 'membership_expires_on', 'code', 'BAD_DATE');
    end if;

    v_belt_txt := trim(coalesce(r ->> 'belt', ''));
    v_belt := null;
    if v_belt_txt = '' then
      v_belt := 0;
    elsif v_belt_txt ~ '^\d{1,2}$' then
      select id into v_belt from public.belt_ranks where id = v_belt_txt::smallint;
    else
      select id into v_belt from public.belt_ranks
       where name_th = v_belt_txt or name_th = 'สาย' || v_belt_txt or name_th = regexp_replace(v_belt_txt, '\s+', ' ', 'g');
    end if;
    if v_belt is null then
      errs := errs || jsonb_build_object('row', n, 'field', 'belt', 'code', 'BAD_BELT');
    end if;

    v_gender := case trim(coalesce(r ->> 'gender', ''))
                  when '' then '' when 'ชาย' then 'male' when 'หญิง' then 'female'
                  when 'male' then 'male' when 'female' then 'female' else null end;
    if v_gender is null then
      errs := errs || jsonb_build_object('row', n, 'field', 'gender', 'code', 'BAD_GENDER');
    end if;

    v_phone := regexp_replace(coalesce(r ->> 'guardian_phone', ''), '\D', '', 'g');
    if coalesce(trim(r ->> 'guardian_name'), '') <> '' or coalesce(trim(r ->> 'guardian_relation'), '') <> ''
       or coalesce(trim(r ->> 'guardian_phone'), '') <> '' then
      if coalesce(trim(r ->> 'guardian_name'), '') = '' then
        errs := errs || jsonb_build_object('row', n, 'field', 'guardian_name', 'code', 'REQUIRED');
      end if;
      if length(v_phone) not between 9 and 10 then
        errs := errs || jsonb_build_object('row', n, 'field', 'guardian_phone',
                                           'code', case when v_phone = '' then 'REQUIRED' else 'BAD_PHONE' end);
      end if;
    end if;

    v_code := upper(trim(coalesce(r ->> 'code', '')));
    if v_code <> '' then
      if v_code !~ '^[A-Z0-9-]{1,20}$' then
        errs := errs || jsonb_build_object('row', n, 'field', 'code', 'code', 'BAD_CODE');
      elsif v_code = any (v_codes) then
        errs := errs || jsonb_build_object('row', n, 'field', 'code', 'code', 'DUPLICATE_IN_FILE');
      elsif exists (select 1 from public.students where code = v_code) then
        errs := errs || jsonb_build_object('row', n, 'field', 'code', 'code', 'CODE_TAKEN');
      end if;
      v_codes := v_codes || v_code;
    end if;

    parsed := parsed || jsonb_build_object(
      'code', v_code, 'first_name', trim(coalesce(r ->> 'first_name', '')), 'last_name', trim(coalesce(r ->> 'last_name', '')),
      'first_name_en', trim(coalesce(r ->> 'first_name_en', '')), 'last_name_en', trim(coalesce(r ->> 'last_name_en', '')),
      'nickname', nullif(trim(coalesce(r ->> 'nickname', '')), ''), 'birth_date', v_birth, 'gender', nullif(v_gender, ''),
      'belt', v_belt, 'membership_expires_on', v_exp,
      'guardian_name', nullif(trim(coalesce(r ->> 'guardian_name', '')), ''),
      'guardian_relation', nullif(trim(coalesce(r ->> 'guardian_relation', '')), ''), 'guardian_phone', nullif(v_phone, ''));
  end loop;

  if not coalesce(p_commit, false) or jsonb_array_length(errs) > 0 then
    return jsonb_build_object('total', n, 'errors', errs, 'created', 0);
  end if;

  insert into public.student_code_sequences (branch_id) values (p_branch) on conflict do nothing;
  for p in select * from jsonb_array_elements(parsed) loop
    v_code := p ->> 'code';
    if v_code = '' then
      loop
        update public.student_code_sequences set last_no = last_no + 1 where branch_id = p_branch returning last_no into v_no;
        v_code := 'S' || lpad(v_no::text, 5, '0');
        exit when not exists (select 1 from public.students where code = v_code) and not v_code = any (v_codes);
      end loop;
    end if;

    insert into public.students (branch_id, code, first_name, last_name, first_name_en, last_name_en, nickname,
        birth_date, gender, belt_rank_id, membership_expires_on)
    values (p_branch, v_code, p ->> 'first_name', p ->> 'last_name', p ->> 'first_name_en', p ->> 'last_name_en',
        p ->> 'nickname', (p ->> 'birth_date')::date, p ->> 'gender', (p ->> 'belt')::smallint,
        (p ->> 'membership_expires_on')::date)
    returning id into v_student;

    if p ->> 'membership_expires_on' is not null then
      insert into public.memberships (student_id, kind, starts_on, expires_on, waived_by, waive_reason)
      values (v_student, 'renewal', ((p ->> 'membership_expires_on')::date - interval '1 year')::date,
              (p ->> 'membership_expires_on')::date, auth.uid(), 'นำเข้าข้อมูลเดิม');
    end if;
    if p ->> 'guardian_name' is not null then
      insert into public.guardians (student_id, full_name, relation, phones, sort_order)
      values (v_student, p ->> 'guardian_name', coalesce(p ->> 'guardian_relation', 'ผู้ปกครอง'),
              array[p ->> 'guardian_phone'], 1);
    end if;
    v_created := v_created + 1;
  end loop;

  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (p_branch, auth.uid(), 'import_students', 'students', null, jsonb_build_object('created', v_created));
  return jsonb_build_object('total', n, 'errors', errs, 'created', v_created);
end $$;

-- ============================================================
-- 7. เชื่อมบัญชีผู้ปกครองกับผู้เรียน (ผู้ปกครองต้องเข้าสู่ระบบมาก่อน 1 ครั้ง)
-- ============================================================
create function public.link_parent(p_student uuid, p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  st public.students%rowtype;
  pr public.profiles%rowtype;
begin
  select * into st from public.students where id = p_student;
  if st.id is null or not (public.is_staff() and public.has_branch(st.branch_id)) then raise exception 'FORBIDDEN'; end if;
  select * into pr from public.profiles
   where lower(email) = lower(trim(coalesce(p_email, ''))) and role = 'customer' limit 1;
  if pr.id is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if exists (select 1 from public.student_accounts where student_id = st.id and account_id = pr.id) then
    raise exception 'ALREADY_LINKED';
  end if;
  if (select count(*) from public.student_accounts where student_id = st.id) >= 2 then
    raise exception 'ACCOUNT_LIMIT';
  end if;
  insert into public.student_accounts (student_id, account_id) values (st.id, pr.id);
  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (st.branch_id, auth.uid(), 'link_parent', 'students', st.id, jsonb_build_object('account_id', pr.id));
  return jsonb_build_object('account_id', pr.id, 'full_name', pr.full_name);
end $$;

-- ============================================================
-- 8. pg_cron: nightly_job ทุกวัน 00:30 น. เวลาไทย (17:30 UTC) · ข้ามบน Postgres ที่ไม่มี pg_cron (SQL test)
-- ============================================================
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    execute $q$select cron.schedule('registerweb-nightly', '30 17 * * *', 'select public.nightly_job()')$q$;
  end if;
end $cron$;

-- ============================================================
-- 9. สิทธิ์
-- ============================================================
revoke execute on function public._parse_import_date(text), public.registration_trial_used()
  from public, anon, authenticated;
revoke execute on function
  public.set_session_teachers(uuid, uuid[], boolean), public.staff_checkin(uuid, uuid, uuid, text),
  public.void_attendance(uuid, text), public.book_trial(uuid, uuid), public.record_trial(uuid, boolean, jsonb),
  public.request_void_document(uuid, text), public.review_void_document(uuid, boolean, text),
  public.import_students(uuid, jsonb, boolean), public.link_parent(uuid, text)
  from public, anon;
grant execute on function
  public.set_session_teachers(uuid, uuid[], boolean), public.staff_checkin(uuid, uuid, uuid, text),
  public.void_attendance(uuid, text), public.book_trial(uuid, uuid), public.record_trial(uuid, boolean, jsonb),
  public.request_void_document(uuid, text), public.review_void_document(uuid, boolean, text),
  public.import_students(uuid, jsonb, boolean), public.link_parent(uuid, text)
  to authenticated;
