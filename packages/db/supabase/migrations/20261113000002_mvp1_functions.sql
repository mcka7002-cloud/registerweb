-- MVP1: RPC ของ demo (docs/mvp1/contracts.md "RPC functions")
-- ทุกฟังก์ชัน: security definer · ตรวจ role/สาขาก่อน · ผิดกฎ = raise exception '<ERROR_CODE>' · เขียน audit_logs
-- "วันนี้" = วันที่ตามเวลาไทย

create function public.bkk_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Bangkok')::date $$;

-- ---------- VAT (ต้องให้ผลเท่ากับ packages/domain/src/vat.ts) ----------
-- คำนวณเป็นสตางค์ · inclusive: vat = round(p * rate / (100 + rate)) · exclusive: vat = round(p * rate / 100)
create function public.compute_vat(price numeric, enabled boolean, inclusive boolean, rate numeric)
returns table (net numeric, vat numeric, total numeric)
language sql immutable as $$
  with s as (select round(price * 100) as p),
       v as (select p, case when not coalesce(enabled, false) then 0
                            when coalesce(inclusive, true) then round(p * rate / (100 + rate))
                            else round(p * rate / 100) end as vat
               from s)
  select (case when coalesce(enabled, false) and coalesce(inclusive, true) then p - vat else p end) / 100.0,
         vat / 100.0,
         (case when coalesce(enabled, false) and not coalesce(inclusive, true) then p + vat else p end) / 100.0
    from v
$$;

-- ---------- เลขรหัสผู้เรียนรายสาขา ----------
create table public.student_code_sequences (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  last_no int not null default 0
);
alter table public.student_code_sequences enable row level security;   -- ไม่มี policy: ใช้ผ่านฟังก์ชันเท่านั้น

-- ============================================================
-- generate_class_sessions
-- ============================================================
create function public.generate_class_sessions(p_branch uuid, p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not (public.is_admin() or (public.my_role() = 'branch_manager' and public.has_branch(p_branch))) then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.class_sessions (branch_id, schedule_id, class_date, starts_at, ends_at, capacity)
  select cs.branch_id, cs.id, d::date, cs.starts_at, cs.ends_at, cs.capacity
    from public.class_schedules cs
    cross join generate_series(p_from, p_to, interval '1 day') d
   where cs.branch_id = p_branch and cs.is_active
     and extract(dow from d) = cs.weekday
     and not exists (select 1 from public.holidays h where h.holiday_date = d::date
                       and (h.branch_id is null or h.branch_id = p_branch))
  on conflict (branch_id, class_date, starts_at) do nothing;
  get diagnostics n = row_count;

  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (p_branch, auth.uid(), 'generate_sessions', 'class_sessions', null,
            jsonb_build_object('from', p_from, 'to', p_to, 'created', n));
  return jsonb_build_object('created', n);
end $$;

-- ============================================================
-- approve_registration / reject_registration
-- ============================================================
-- p_student: ฟิลด์ผู้เรียน (ไม่ส่ง = ใช้ค่าจาก registrations.payload) + guardians: [{full_name, nickname, relation, phones[]}]
create function public.approve_registration(p_registration uuid, p_student jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.registrations%rowtype;
  src jsonb;
  v_no int;
  v_code text;
  v_student uuid;
  g jsonb;
  i int := 0;
begin
  select * into r from public.registrations where id = p_registration for update;
  if r.id is null or not (public.is_staff() and public.has_branch(r.branch_id)) then
    raise exception 'FORBIDDEN';
  end if;
  if r.status not in ('pending', 'trial_booked') then raise exception 'NOT_PENDING'; end if;

  src := coalesce(r.payload, '{}'::jsonb) || coalesce(p_student, '{}'::jsonb);
  if coalesce(src ->> 'first_name', '') = '' or coalesce(src ->> 'last_name', '') = ''
     or coalesce(src ->> 'first_name_en', '') = '' or coalesce(src ->> 'last_name_en', '') = ''
     or coalesce(src ->> 'birth_date', '') = '' then
    raise exception 'FIELDS_REQUIRED';
  end if;

  -- S + เลขรัน 5 หลักต่อสาขา · students.code unique ทั้งระบบ จึงข้ามเลขที่สาขาอื่นใช้แล้ว
  insert into public.student_code_sequences (branch_id) values (r.branch_id) on conflict do nothing;
  loop
    update public.student_code_sequences set last_no = last_no + 1 where branch_id = r.branch_id returning last_no into v_no;
    v_code := 'S' || lpad(v_no::text, 5, '0');
    exit when not exists (select 1 from public.students where code = v_code);
  end loop;

  insert into public.students (branch_id, code, first_name, last_name, first_name_en, last_name_en, nickname,
      birth_date, gender, height_cm, weight_kg, uniform_size, medical_notes, emergency_name, emergency_phone,
      publish_consent, pdpa_consent_at)
  values (r.branch_id, v_code, src ->> 'first_name', src ->> 'last_name', src ->> 'first_name_en', src ->> 'last_name_en',
      nullif(src ->> 'nickname', ''), (src ->> 'birth_date')::date, nullif(src ->> 'gender', ''),
      nullif(src ->> 'height_cm', '')::numeric, nullif(src ->> 'weight_kg', '')::numeric,
      nullif(src ->> 'uniform_size', ''), nullif(src ->> 'medical_notes', ''),
      nullif(src ->> 'emergency_name', ''), nullif(src ->> 'emergency_phone', ''),
      r.publish_consent, r.created_at)
  returning id into v_student;

  if r.account_id is not null then
    insert into public.student_accounts (student_id, account_id) values (v_student, r.account_id);
  end if;

  for g in select * from jsonb_array_elements(coalesce(src -> 'guardians', '[]'::jsonb)) loop
    i := i + 1;
    exit when i > 2;
    insert into public.guardians (student_id, full_name, nickname, relation, phones, sort_order)
    values (v_student, g ->> 'full_name', nullif(g ->> 'nickname', ''), g ->> 'relation',
            array(select jsonb_array_elements_text(coalesce(g -> 'phones', '[]'::jsonb))), i);
  end loop;

  update public.registrations
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), student_id = v_student
   where id = r.id;

  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (r.branch_id, auth.uid(), 'approve', 'registrations', r.id,
            jsonb_build_object('student_id', v_student, 'code', v_code));
  return jsonb_build_object('student_id', v_student, 'code', v_code);
end $$;

create function public.reject_registration(p_registration uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.registrations%rowtype;
begin
  select * into r from public.registrations where id = p_registration for update;
  if r.id is null or not (public.is_staff() and public.has_branch(r.branch_id)) then
    raise exception 'FORBIDDEN';
  end if;
  if r.status not in ('pending', 'trial_booked') then raise exception 'NOT_PENDING'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;

  update public.registrations
     set status = 'rejected', reject_reason = trim(p_reason), reviewed_by = auth.uid(), reviewed_at = now()
   where id = r.id;
  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (r.branch_id, auth.uid(), 'reject', 'registrations', r.id, jsonb_build_object('reason', trim(p_reason)));
  return '{}'::jsonb;
end $$;

-- ============================================================
-- update_student: แก้ได้เฉพาะฟิลด์ทั่วไป (ไม่แตะสาย ตัวนับ สมาชิก สถานะ)
-- ============================================================
create function public.update_student(p_student uuid, p_fields jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_branch uuid;
  f jsonb := coalesce(p_fields, '{}'::jsonb);
begin
  select branch_id into v_branch from public.students where id = p_student for update;
  if v_branch is null or not (public.is_staff() and public.has_branch(v_branch)) then
    raise exception 'FORBIDDEN';
  end if;

  update public.students set
    nickname       = case when f ? 'nickname' then nullif(f ->> 'nickname', '') else nickname end,
    first_name     = case when f ? 'first_name' and coalesce(f ->> 'first_name', '') <> '' then f ->> 'first_name' else first_name end,
    last_name      = case when f ? 'last_name' and coalesce(f ->> 'last_name', '') <> '' then f ->> 'last_name' else last_name end,
    first_name_en  = case when f ? 'first_name_en' and coalesce(f ->> 'first_name_en', '') <> '' then f ->> 'first_name_en' else first_name_en end,
    last_name_en   = case when f ? 'last_name_en' and coalesce(f ->> 'last_name_en', '') <> '' then f ->> 'last_name_en' else last_name_en end,
    height_cm      = case when f ? 'height_cm' then nullif(f ->> 'height_cm', '')::numeric else height_cm end,
    weight_kg      = case when f ? 'weight_kg' then nullif(f ->> 'weight_kg', '')::numeric else weight_kg end,
    uniform_size   = case when f ? 'uniform_size' then nullif(f ->> 'uniform_size', '') else uniform_size end,
    medical_notes  = case when f ? 'medical_notes' then nullif(f ->> 'medical_notes', '') else medical_notes end,
    emergency_name = case when f ? 'emergency_name' then nullif(f ->> 'emergency_name', '') else emergency_name end,
    emergency_phone = case when f ? 'emergency_phone' then nullif(f ->> 'emergency_phone', '') else emergency_phone end
  where id = p_student;

  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (v_branch, auth.uid(), 'update', 'students', p_student, f);
  return '{}'::jsonb;
end $$;

-- ============================================================
-- sell_package: ขายแพ็กเกจ (+ ค่าสมาชิก) จ่ายครบในรายการเดียว
-- orders.subtotal / documents.subtotal = ยอดก่อน VAT (net)
-- ============================================================
create function public.sell_package(p_student uuid, p_template uuid, p_with_membership boolean,
    p_method public.payment_method) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  st public.students%rowtype;
  t public.package_templates%rowtype;
  bs public.branch_settings%rowtype;
  v_branch_code text;
  v_today date := public.bkk_today();
  v_account uuid;
  v_customer text;
  v_order uuid;
  v_pkg_item uuid;
  v_mem_item uuid;
  v_mem_price numeric := 0;
  v_mem_kind text;
  v_new_expiry date;
  v_gross numeric;
  v_net numeric; v_vat numeric; v_total numeric;
  v_no int;
  v_doc_no text;
  v_doc uuid;
  v_pkg uuid;
begin
  select * into st from public.students where id = p_student for update;
  if st.id is null or not (public.is_staff() and public.has_branch(st.branch_id)) then
    raise exception 'FORBIDDEN';
  end if;

  select * into t from public.package_templates where id = p_template;
  if t.id is null or not t.is_active or (t.branch_id is not null and t.branch_id <> st.branch_id) then
    raise exception 'TEMPLATE_INACTIVE';
  end if;

  if not coalesce(p_with_membership, false)
     and (st.membership_expires_on is null or st.membership_expires_on < v_today) then
    raise exception 'MEMBERSHIP_REQUIRED';
  end if;

  select code into v_branch_code from public.branches where id = st.branch_id;
  select * into bs from public.branch_settings where branch_id = st.branch_id;

  if p_with_membership then
    v_mem_kind := case when st.membership_expires_on is null then 'new' else 'renewal' end;
    select amount into v_mem_price from public.price_settings
     where key = case when v_mem_kind = 'new' then 'membership_new' else 'membership_renewal' end
       and (branch_id = st.branch_id or branch_id is null)
     order by branch_id nulls last limit 1;
    v_mem_price := coalesce(v_mem_price, 0);
  end if;

  v_gross := t.price + v_mem_price;
  select c.net, c.vat, c.total into v_net, v_vat, v_total
    from public.compute_vat(v_gross, coalesce(bs.vat_enabled, false), coalesce(bs.vat_inclusive, true),
                            coalesce(bs.vat_rate, 0)) c;

  select sa.account_id, p.full_name into v_account, v_customer
    from public.student_accounts sa join public.profiles p on p.id = sa.account_id
   where sa.student_id = st.id order by p.created_at limit 1;
  v_customer := coalesce(v_customer, st.first_name || ' ' || st.last_name);

  insert into public.orders (branch_id, account_id, created_by, status, reviewed_by, reviewed_at,
      subtotal, discount, vat_amount, total)
  values (st.branch_id, v_account, auth.uid(), 'approved', auth.uid(), now(), v_net, 0, v_vat, v_total)
  returning id into v_order;

  insert into public.order_items (order_id, item_type, student_id, package_template_id, description, unit_price, amount)
  values (v_order, 'package', st.id, t.id, t.name, t.price, t.price)
  returning id into v_pkg_item;

  if p_with_membership then
    insert into public.order_items (order_id, item_type, student_id, description, unit_price, amount)
    values (v_order, case when v_mem_kind = 'new' then 'membership' else 'membership_renewal' end::public.order_item_type,
            st.id, case when v_mem_kind = 'new' then 'ค่าสมาชิกรายปี' else 'ต่ออายุสมาชิกรายปี' end,
            v_mem_price, v_mem_price)
    returning id into v_mem_item;

    v_new_expiry := public.membership_next_expiry(st.membership_expires_on, v_today);
    insert into public.memberships (student_id, order_item_id, kind, starts_on, expires_on)
    values (st.id, v_mem_item, v_mem_kind, v_today, v_new_expiry);
    update public.students
       set membership_expires_on = v_new_expiry,
           status = case when anonymized_at is null then 'active' else status end
     where id = st.id;
  end if;

  insert into public.payments (branch_id, order_id, amount, method, received_by)
  values (st.branch_id, v_order, v_total, p_method, auth.uid());

  insert into public.student_packages (branch_id, student_id, template_id, order_item_id, name, price,
      sessions_total, makeup_allowed, duration_days, paid_on, must_start_by)
  values (st.branch_id, st.id, t.id, v_pkg_item, t.name, t.price, t.sessions, t.makeup_allowed, t.duration_days,
          v_today, (v_today + interval '1 year')::date)
  returning id into v_pkg;

  -- เลขใบเสร็จ RC-<สาขา>-<ปี>-<00001> รันใหม่ทุกปีต่อสาขา
  insert into public.document_sequences (branch_id, doc_type, year, last_no)
  values (st.branch_id, 'receipt', extract(year from v_today)::int, 1)
  on conflict (branch_id, doc_type, year) do update set last_no = public.document_sequences.last_no + 1
  returning last_no into v_no;
  v_doc_no := 'RC-' || v_branch_code || '-' || extract(year from v_today)::int || '-' || lpad(v_no::text, 5, '0');

  insert into public.documents (branch_id, doc_type, doc_no, order_id, customer_name, subtotal, vat_rate,
      vat_inclusive, vat_amount, total, issued_by)
  values (st.branch_id, 'receipt', v_doc_no, v_order, v_customer, v_net,
          case when coalesce(bs.vat_enabled, false) then bs.vat_rate else 0 end,
          coalesce(bs.vat_inclusive, true), v_vat, v_total, auth.uid())
  returning id into v_doc;

  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (st.branch_id, auth.uid(), 'sell_package', 'orders', v_order,
            jsonb_build_object('student_id', st.id, 'template_id', t.id, 'student_package_id', v_pkg,
                               'with_membership', p_with_membership, 'method', p_method,
                               'doc_no', v_doc_no, 'total', v_total));
  return jsonb_build_object('order_id', v_order, 'document_id', v_doc, 'doc_no', v_doc_no, 'total', v_total);
end $$;

-- ============================================================
-- book_sessions / cancel_booking (ครู/admin จองให้ ลูกค้าจองเองไม่ได้)
-- ============================================================
create function public.book_sessions(p_package uuid, p_sessions uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pk public.student_packages%rowtype;
  v_today date := public.bkk_today();
  v_ids uuid[] := coalesce(p_sessions, '{}');
  v_min date; v_max date;
  v_booked int;
  n int := 0;
  s record;
begin
  select * into pk from public.student_packages where id = p_package for update;
  if pk.id is null or not (public.is_staff() and public.has_branch(pk.branch_id)) then
    raise exception 'FORBIDDEN';
  end if;
  if pk.status <> 'active' or (pk.expires_on is not null and pk.expires_on < v_today)
     or (pk.starts_on is null and pk.must_start_by < v_today) then
    raise exception 'PACKAGE_EXPIRED';
  end if;
  if cardinality(v_ids) = 0 then return jsonb_build_object('booked', 0); end if;
  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then raise exception 'DUPLICATE'; end if;

  for s in select u.id as want, cs.* from unnest(v_ids) u(id)
             left join public.class_sessions cs on cs.id = u.id loop
    if s.branch_id is distinct from pk.branch_id or s.cancelled then raise exception 'SESSION_UNAVAILABLE'; end if;
    if s.class_date < v_today then raise exception 'IN_PAST'; end if;
    if exists (select 1 from public.bookings b where b.student_id = pk.student_id and b.class_session_id = s.want
                 and b.status <> 'cancelled') then
      raise exception 'DUPLICATE';
    end if;
  end loop;

  select min(class_date), max(class_date) into v_min, v_max from public.class_sessions where id = any (v_ids);
  if pk.expires_on is not null then
    if v_max > pk.expires_on then raise exception 'OUT_OF_WINDOW'; end if;
  else
    -- ยังไม่เริ่ม: วันที่จองทั้งหมด (รวมที่จองไว้แล้ว) ต้องอยู่ในช่วง duration_days นับจากวันแรก
    select least(v_min, min(cs.class_date)), greatest(v_max, max(cs.class_date)) into v_min, v_max
      from public.bookings b join public.class_sessions cs on cs.id = b.class_session_id
     where b.student_package_id = pk.id and b.status in ('booked', 'attended');
    if v_max > v_min + pk.duration_days - 1 or v_min > pk.must_start_by then raise exception 'OUT_OF_WINDOW'; end if;
  end if;

  if pk.sessions_total is not null then
    select count(*) into v_booked from public.bookings where student_package_id = pk.id and status = 'booked';
    if cardinality(v_ids) > pk.sessions_total + pk.bonus_sessions - pk.sessions_used - v_booked then
      raise exception 'TOO_MANY';
    end if;
  end if;

  -- จองซ้ำคลาสที่เคยยกเลิก = ใช้แถวเดิม (unique student + session)
  update public.bookings set status = 'booked', student_package_id = pk.id, created_by = auth.uid(), created_at = now()
   where student_id = pk.student_id and class_session_id = any (v_ids) and status = 'cancelled';
  get diagnostics n = row_count;
  insert into public.bookings (branch_id, student_id, student_package_id, class_session_id, created_by)
  select pk.branch_id, pk.student_id, pk.id, x, auth.uid() from unnest(v_ids) x
   where not exists (select 1 from public.bookings b where b.student_id = pk.student_id and b.class_session_id = x);
  get diagnostics v_booked = row_count;
  n := n + v_booked;

  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (pk.branch_id, auth.uid(), 'book', 'student_packages', pk.id, jsonb_build_object('sessions', to_jsonb(v_ids)));
  return jsonb_build_object('booked', n);
end $$;

create function public.cancel_booking(p_booking uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null or not (public.is_staff() and public.has_branch(b.branch_id)) then
    raise exception 'FORBIDDEN';
  end if;
  if b.status <> 'booked' then raise exception 'NOT_BOOKED'; end if;
  update public.bookings set status = 'cancelled' where id = b.id;
  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (b.branch_id, auth.uid(), 'cancel', 'bookings', b.id, null);
  return '{}'::jsonb;
end $$;

-- ============================================================
-- my_home: role + สาขา สำหรับเลือกหน้าแรก
-- admin = ทุกสาขา · ลูกค้า = สาขาของผู้เรียนที่ผูก · อื่น ๆ = profile_branches
-- ============================================================
create function public.my_home() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_role public.app_role;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  v_role := public.my_role();
  return jsonb_build_object('role', v_role, 'branches', coalesce((
    select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.code)
      from public.branches b
     where v_role = 'admin'
        or exists (select 1 from public.profile_branches pb where pb.profile_id = auth.uid() and pb.branch_id = b.id)
        or (v_role = 'customer' and exists (select 1 from public.student_accounts sa join public.students s on s.id = sa.student_id
                                             where sa.account_id = auth.uid() and s.branch_id = b.id))
  ), '[]'::jsonb));
end $$;

-- ============================================================
-- สิทธิ์
-- ============================================================
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.my_role(), public.is_admin(), public.is_staff(), public.is_manager(),
  public.has_branch(uuid), public.owns_student(uuid), public.staff_sees_student(uuid), public.staff_sees_profile(uuid)
  to authenticated;
grant execute on function public.membership_next_expiry(date, date), public.compute_vat(numeric, boolean, boolean, numeric)
  to authenticated;
grant execute on function
  public.record_checkin(uuid, uuid, text, timestamptz, uuid, public.attendance_source, public.attendance_method, text),
  public.generate_class_sessions(uuid, date, date),
  public.approve_registration(uuid, jsonb),
  public.reject_registration(uuid, text),
  public.update_student(uuid, jsonb),
  public.sell_package(uuid, uuid, boolean, public.payment_method),
  public.book_sessions(uuid, uuid[]),
  public.cancel_booking(uuid),
  public.my_home()
  to authenticated;
