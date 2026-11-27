-- RegisterWeb MVP1 + MVP2: demo data for a CLOUD project (Supabase SQL Editor)
--
-- Safe for cloud: creates NO login accounts and stores NO passwords. It attaches demo data to real
-- Google accounts that have already signed in to the app once (so their `profiles` row exists).
--
-- How to run
--   1. Each person signs in to the deployed app with Google once: admin, teacher, parent (and kiosk if used).
--   2. Edit the four emails in the DECLARE block below.
--   3. Paste this whole file into Supabase → SQL Editor → Run. It runs as one transaction: all or nothing.
--   4. Safe to run again: branch, settings, roles and schedule are upserted; demo students are created only
--      once (marked with payload "demo_tag": "mvp1").
--
-- What it creates
--   * Branch BKK "สาขาหลัก" with VAT 7% inclusive; weekly classes Mon/Wed/Fri 17:00–18:00 and Sat 10:00–11:00
--   * Class sessions from Monday of this week to 4 weeks ahead
--   * Payment details for the parent buy page (if you fill them in below)
--   * Roles: admin, teacher, (kiosk) linked to BKK; the parent stays a customer
--   * 3 applications from the parent:
--       ภูมิ   approved → 8-session package + membership (cash) → 4 classes booked
--       ข้าวหอม approved → unlimited package + membership (transfer) → 3 classes booked
--       ใบเตย  left pending, so you can approve it live in the demo
--   * MVP2 (once, "demo_tag": "mvp2"): application กล้า with a trial class booked on the next class, and the
--     teacher set as the teacher of every class from today on (so manual check-in works for them)
--
-- Note: receipts, payments and audit logs can't be deleted (by design), so there is no "undo" script.
-- To start over, create a new Supabase project or reset the database from the dashboard.

do $$
declare
  -- ===== EDIT THESE =====
  admin_email   text := 'admin@example.com';
  teacher_email text := 'teacher@example.com';
  parent_email  text := 'parent@example.com';
  kiosk_email   text := null;               -- e.g. 'kiosk@example.com', or leave null
  -- School's real payment details, shown to parents on the buy page (PromptPay QR includes the amount).
  -- Leave null to set them later in Admin → สาขา. Never put someone else's number here.
  promptpay_id  text := null;               -- mobile (10 digits) or tax id (13 digits)
  bank_account  text := null;               -- e.g. 'กสิกรไทย 123-4-56789-0 ชื่อบัญชี โรงเรียน...'
  -- ======================

  v_admin   uuid;
  v_teacher uuid;
  v_parent  uuid;
  v_kiosk   uuid;
  v_branch  uuid;
  v_today   date := (now() at time zone 'Asia/Bangkok')::date;
  v_reg_a   uuid := gen_random_uuid();
  v_reg_b   uuid := gen_random_uuid();
  v_reg_c   uuid := gen_random_uuid();
  v_reg_d   uuid := gen_random_uuid();
  v_student uuid;
  v_package uuid;
  v_sale    jsonb;
  v_missing text[] := '{}';
begin
  -- ---------- 1. find the real accounts ----------
  select id into v_admin   from public.profiles where lower(email) = lower(admin_email);
  select id into v_teacher from public.profiles where lower(email) = lower(teacher_email);
  select id into v_parent  from public.profiles where lower(email) = lower(parent_email);
  if kiosk_email is not null then
    select id into v_kiosk from public.profiles where lower(email) = lower(kiosk_email);
    if v_kiosk is null then v_missing := v_missing || kiosk_email; end if;
  end if;
  if v_admin   is null then v_missing := v_missing || admin_email;   end if;
  if v_teacher is null then v_missing := v_missing || teacher_email; end if;
  if v_parent  is null then v_missing := v_missing || parent_email;  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'No profile for: %. Each of these must sign in to the app with Google once, then run this again.',
      array_to_string(v_missing, ', ');
  end if;
  if v_parent in (v_admin, v_teacher) or v_parent = v_kiosk then
    raise exception 'The parent email must be a different account from admin, teacher and kiosk.';
  end if;
  if v_teacher = v_admin then
    raise exception 'Use a different account for the teacher than for the admin (the admin already sees everything).';
  end if;

  -- ---------- 2. branch, VAT, weekly schedule ----------
  insert into public.branches (code, name, address)
    values ('BKK', 'สาขาหลัก', 'กรุงเทพมหานคร')
  on conflict (code) do update set name = excluded.name
  returning id into v_branch;

  insert into public.branch_settings (branch_id, vat_enabled, vat_inclusive, vat_rate, promptpay_id, bank_account)
    values (v_branch, true, true, 7, promptpay_id, bank_account)
  on conflict (branch_id) do update
    set vat_enabled = true, vat_inclusive = true, vat_rate = 7,
        promptpay_id = coalesce(excluded.promptpay_id, public.branch_settings.promptpay_id),
        bank_account = coalesce(excluded.bank_account, public.branch_settings.bank_account),
        updated_at = now();

  insert into public.class_schedules (branch_id, weekday, starts_at, ends_at, capacity)
  select v_branch, s.weekday, s.starts_at, s.ends_at, 30
    from (values (1, time '17:00', time '18:00'), (3, time '17:00', time '18:00'),
                 (5, time '17:00', time '18:00'), (6, time '10:00', time '11:00')) as s(weekday, starts_at, ends_at)
   where not exists (select 1 from public.class_schedules cs
                      where cs.branch_id = v_branch and cs.weekday = s.weekday and cs.starts_at = s.starts_at);

  -- ---------- 3. roles and branch links ----------
  update public.profiles set role = 'admin'   where id = v_admin;
  update public.profiles set role = 'teacher' where id = v_teacher;
  if v_kiosk is not null then
    update public.profiles set role = 'kiosk' where id = v_kiosk;
  end if;
  insert into public.profile_branches (profile_id, branch_id)
  select p, v_branch from unnest(array[v_admin, v_teacher, v_kiosk]) as p
   where p is not null
  on conflict do nothing;
  insert into public.teachers (profile_id, employment_status, daily_rate)
    values (v_teacher, 'probation', 600)
  on conflict (profile_id) do nothing;

  -- ---------- 4. class sessions (through the real function, as the admin) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform public.generate_class_sessions(v_branch, date_trunc('week', v_today)::date, v_today + 27);

  -- ---------- 5. demo students (once) ----------
  if exists (select 1 from public.registrations where payload->>'demo_tag' = 'mvp1') then
    raise notice 'Demo students already exist; skipped creating them again.';
  else
    insert into public.registrations (id, branch_id, account_id, payload, pdpa_consent, publish_consent, created_at) values
      (v_reg_a, v_branch, v_parent,
       '{"demo_tag":"mvp1","first_name":"ด.ช.ภูมิ","last_name":"ใจดี","first_name_en":"Phum","last_name_en":"Jaidee",
         "nickname":"ภูมิ","birth_date":"2017-03-15","gender":"male","height_cm":128,
         "guardians":[{"full_name":"ผู้ปกครองตัวอย่าง","relation":"แม่","phones":["0800000001"]}]}',
       true, true, now() - interval '7 days'),
      (v_reg_b, v_branch, v_parent,
       '{"demo_tag":"mvp1","first_name":"ด.ญ.ข้าวหอม","last_name":"ใจดี","first_name_en":"Khaohom","last_name_en":"Jaidee",
         "nickname":"ข้าวหอม","birth_date":"2015-11-02","gender":"female","height_cm":141,
         "guardians":[{"full_name":"ผู้ปกครองตัวอย่าง","relation":"แม่","phones":["0800000001"]}]}',
       true, false, now() - interval '5 days'),
      (v_reg_c, v_branch, v_parent,
       '{"demo_tag":"mvp1","first_name":"ด.ญ.ใบเตย","last_name":"ใจดี","first_name_en":"Baitoey","last_name_en":"Jaidee",
         "nickname":"ใบเตย","birth_date":"2019-08-01","gender":"female",
         "guardians":[{"full_name":"ผู้ปกครองตัวอย่าง","relation":"แม่","phones":["0800000001"]}]}',
       true, false, now() - interval '1 day');

    -- act as the teacher for the staff steps, so every rule and audit log runs as in the app
    perform set_config('request.jwt.claims', json_build_object('sub', v_teacher, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_teacher::text, true);

    -- ภูมิ: 8 sessions + membership, cash, 4 classes
    v_student := (public.approve_registration(v_reg_a, '{}'::jsonb) ->> 'student_id')::uuid;
    v_sale := public.sell_package(v_student,
      (select id from public.package_templates where name = '8 ครั้ง / 30 วัน' and is_active limit 1), true, 'cash');
    select id into v_package from public.student_packages where student_id = v_student order by created_at desc limit 1;
    perform public.book_sessions(v_package,
      (select array_agg(id) from (select id from public.class_sessions
                                   where branch_id = v_branch and not cancelled and class_date >= v_today
                                   order by class_date, starts_at limit 4) s));
    raise notice 'ภูมิ: receipt %', v_sale ->> 'doc_no';

    -- ข้าวหอม: unlimited + membership, transfer, 3 classes
    v_student := (public.approve_registration(v_reg_b, '{}'::jsonb) ->> 'student_id')::uuid;
    v_sale := public.sell_package(v_student,
      (select id from public.package_templates where sessions is null and is_active order by sort_order limit 1), true, 'transfer');
    select id into v_package from public.student_packages where student_id = v_student order by created_at desc limit 1;
    perform public.book_sessions(v_package,
      (select array_agg(id) from (select id from public.class_sessions
                                   where branch_id = v_branch and not cancelled and class_date >= v_today
                                   order by class_date, starts_at limit 3) s));
    raise notice 'ข้าวหอม: receipt %', v_sale ->> 'doc_no';
    raise notice 'ใบเตย: left pending for a live approval';
  end if;

  -- ---------- 6. MVP2: trial booking + teachers of each class (once) ----------
  if exists (select 1 from public.registrations where payload->>'demo_tag' = 'mvp2') then
    raise notice 'MVP2 demo data already exists; skipped.';
  else
    insert into public.registrations (id, branch_id, account_id, payload, pdpa_consent, publish_consent, created_at) values
      (v_reg_d, v_branch, v_parent,
       '{"demo_tag":"mvp2","first_name":"ด.ช.กล้า","last_name":"ใจดี","first_name_en":"Kla","last_name_en":"Jaidee",
         "nickname":"กล้า","birth_date":"2018-11-20","gender":"male",
         "guardians":[{"full_name":"ผู้ปกครองตัวอย่าง","relation":"แม่","phones":["0800000001"]}]}',
       true, false, now() - interval '1 day');
    perform set_config('request.jwt.claims', json_build_object('sub', v_teacher, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_teacher::text, true);
    perform public.book_trial(v_reg_d,
      (select id from public.class_sessions where branch_id = v_branch and not cancelled and class_date >= v_today
        order by class_date, starts_at limit 1));

    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    perform public.set_session_teachers(s.id, array[v_teacher], false)
       from public.class_sessions s where s.branch_id = v_branch and not s.cancelled and s.class_date >= v_today;
    raise notice 'กล้า: trial booked; teacher set on upcoming classes';
  end if;

  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  raise notice 'Done. Branch BKK id %', v_branch;
end $$;
