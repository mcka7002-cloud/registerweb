-- MVP1 review fixes (เอกสาร "RegisterWeb MVP1 Review")
--   #1 admin เปลี่ยน role ตัวเองไม่ได้
--   #3 #5 #9 ผู้ปกครองซื้อแพ็กเกจ/ต่อสมาชิกเองโดยแนบสลิป → ครูตรวจรับเงิน → ออกใบเสร็จ
--   #4 รูปถ่ายผู้เรียนตอนลงทะเบียน
-- ห้ามแก้ไฟล์ migration ที่ deploy แล้ว จึงเขียนทับฟังก์ชันด้วย create or replace ที่นี่

-- ============================================================
-- 1. role ตัวเอง: policy profiles_admin (for all) ทำให้ admin เปลี่ยน role ตัวเองได้ จึงกันด้วย trigger
--    auth.uid() เป็น null ตอนรันใน SQL Editor/seed จึงยังตั้ง role ได้ตามปกติ
-- ============================================================
create function public.protect_own_role() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.role is distinct from old.role and new.id = auth.uid() then
    raise exception 'FORBIDDEN';
  end if;
  return new;
end $$;

create trigger profiles_protect_own_role before update of role on public.profiles
  for each row execute function public.protect_own_role();

-- ============================================================
-- 2. ช่องทางชำระเงินของสาขา + วิธีจ่ายที่ลูกค้าเลือกตอนสั่งซื้อ
-- ============================================================
alter table public.branch_settings
  add column promptpay_id text,        -- เบอร์มือถือ 10 หลัก หรือเลขประจำตัวผู้เสียภาษี 13 หลัก
  add column bank_account text;        -- ข้อความแสดงให้ลูกค้า เช่น "กสิกรไทย 123-4-56789-0 ชื่อบัญชี ..."

alter table public.orders add column pay_method public.payment_method;

-- ครูเห็นการชำระเงินที่ตัวเองรับ (สรุปลิ้นชักรายวัน) · ผู้จัดการ/admin เห็นทั้งสาขาตาม payments_read เดิม
create policy payments_received on public.payments for select to authenticated using (received_by = auth.uid());

-- ============================================================
-- 3. Storage: สลิปและรูปผู้เรียน (private) · อัปโหลดได้เฉพาะโฟลเดอร์ <uid>/ ของตัวเอง ไม่มีแก้/ลบ
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('slips', 'slips', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('student-photos', 'student-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy storage_own_upload on storage.objects for insert to authenticated
  with check (bucket_id in ('slips', 'student-photos') and (storage.foldername(name))[1] = auth.uid()::text);

create policy storage_slips_read on storage.objects for select to authenticated
  using (bucket_id = 'slips' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.orders o
                where o.slip_path = storage.objects.name and public.is_staff() and public.has_branch(o.branch_id))));

create policy storage_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'student-photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.registrations r
                where r.payload ->> 'photo_path' = storage.objects.name and public.is_staff() and public.has_branch(r.branch_id))
    or exists (select 1 from public.students s
                where s.photo_path = storage.objects.name and (public.staff_sees_student(s.id) or public.owns_student(s.id)))));

-- ============================================================
-- 4. approve_registration: คัดลอกรูปจาก payload (เฉพาะไฟล์ในโฟลเดอร์ของผู้สมัครเอง)
-- ============================================================
create or replace function public.approve_registration(p_registration uuid, p_student jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.registrations%rowtype;
  src jsonb;
  v_no int;
  v_code text;
  v_student uuid;
  v_photo text;
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

  v_photo := nullif(r.payload ->> 'photo_path', '');
  if v_photo is not null and (r.account_id is null or v_photo not like r.account_id::text || '/%') then
    v_photo := null;
  end if;

  insert into public.student_code_sequences (branch_id) values (r.branch_id) on conflict do nothing;
  loop
    update public.student_code_sequences set last_no = last_no + 1 where branch_id = r.branch_id returning last_no into v_no;
    v_code := 'S' || lpad(v_no::text, 5, '0');
    exit when not exists (select 1 from public.students where code = v_code);
  end loop;

  insert into public.students (branch_id, code, first_name, last_name, first_name_en, last_name_en, nickname,
      birth_date, gender, height_cm, weight_kg, uniform_size, medical_notes, emergency_name, emergency_phone,
      publish_consent, pdpa_consent_at, photo_path)
  values (r.branch_id, v_code, src ->> 'first_name', src ->> 'last_name', src ->> 'first_name_en', src ->> 'last_name_en',
      nullif(src ->> 'nickname', ''), (src ->> 'birth_date')::date, nullif(src ->> 'gender', ''),
      nullif(src ->> 'height_cm', '')::numeric, nullif(src ->> 'weight_kg', '')::numeric,
      nullif(src ->> 'uniform_size', ''), nullif(src ->> 'medical_notes', ''),
      nullif(src ->> 'emergency_name', ''), nullif(src ->> 'emergency_phone', ''),
      r.publish_consent, r.created_at, v_photo)
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

-- ============================================================
-- 5. สร้างบิลแพ็กเกจ (+ สมาชิก) และปิดบิล ใช้ร่วมกันระหว่าง sell_package (ครูรับเงินหน้าร้าน)
--    และ request_package_purchase → review_order (ลูกค้าแนบสลิป ครูตรวจ)
--    ฟังก์ชันภายใน: ไม่ grant ให้ API role
-- ============================================================
create function public._create_package_order(p_student uuid, p_template uuid, p_with_membership boolean,
    p_status public.order_status, p_method public.payment_method, p_slip text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  st public.students%rowtype;
  t public.package_templates%rowtype;
  bs public.branch_settings%rowtype;
  v_today date := public.bkk_today();
  v_mem_price numeric := 0;
  v_mem_new boolean;
  v_net numeric; v_vat numeric; v_total numeric;
  v_account uuid;
  v_order uuid;
begin
  select * into st from public.students where id = p_student for update;
  select * into t from public.package_templates where id = p_template;
  if t.id is null or not t.is_active or (t.branch_id is not null and t.branch_id <> st.branch_id) then
    raise exception 'TEMPLATE_INACTIVE';
  end if;
  if not coalesce(p_with_membership, false)
     and (st.membership_expires_on is null or st.membership_expires_on < v_today) then
    raise exception 'MEMBERSHIP_REQUIRED';
  end if;

  select * into bs from public.branch_settings where branch_id = st.branch_id;
  if p_with_membership then
    v_mem_new := st.membership_expires_on is null;
    select amount into v_mem_price from public.price_settings
     where key = case when v_mem_new then 'membership_new' else 'membership_renewal' end
       and (branch_id = st.branch_id or branch_id is null)
     order by branch_id nulls last limit 1;
    v_mem_price := coalesce(v_mem_price, 0);
  end if;

  select c.net, c.vat, c.total into v_net, v_vat, v_total
    from public.compute_vat(t.price + v_mem_price, coalesce(bs.vat_enabled, false), coalesce(bs.vat_inclusive, true),
                            coalesce(bs.vat_rate, 0)) c;

  select sa.account_id into v_account
    from public.student_accounts sa join public.profiles p on p.id = sa.account_id
   where sa.student_id = st.id
   order by (sa.account_id = auth.uid()) desc, p.created_at limit 1;

  insert into public.orders (branch_id, account_id, created_by, status, pay_method, slip_path,
      subtotal, discount, vat_amount, total)
  values (st.branch_id, v_account, auth.uid(), p_status, p_method, p_slip, v_net, 0, v_vat, v_total)
  returning id into v_order;

  insert into public.order_items (order_id, item_type, student_id, package_template_id, description, unit_price, amount)
  values (v_order, 'package', st.id, t.id, t.name, t.price, t.price);
  if p_with_membership then
    insert into public.order_items (order_id, item_type, student_id, description, unit_price, amount)
    values (v_order, case when v_mem_new then 'membership' else 'membership_renewal' end::public.order_item_type,
            st.id, case when v_mem_new then 'ค่าสมาชิกรายปี' else 'ต่ออายุสมาชิกรายปี' end, v_mem_price, v_mem_price);
  end if;
  return v_order;
end $$;

-- ปิดบิล: รับเงิน → สมาชิก + แพ็กเกจ + ใบเสร็จ · ผู้รับเงิน = auth.uid()
create function public._fulfill_order(p_order uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  it public.order_items%rowtype;
  st public.students%rowtype;
  t public.package_templates%rowtype;
  bs public.branch_settings%rowtype;
  v_today date := public.bkk_today();
  v_branch_code text;
  v_customer text;
  v_new_expiry date;
  v_no int;
  v_doc_no text;
  v_doc uuid;
  v_pkg uuid;
begin
  select * into o from public.orders where id = p_order for update;
  select * into bs from public.branch_settings where branch_id = o.branch_id;
  select code into v_branch_code from public.branches where id = o.branch_id;

  update public.orders set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = o.id;
  insert into public.payments (branch_id, order_id, amount, method, received_by)
  values (o.branch_id, o.id, o.total, o.pay_method, auth.uid());

  for it in select * from public.order_items where order_id = o.id order by item_type loop
    select * into st from public.students where id = it.student_id for update;
    if it.item_type in ('membership', 'membership_renewal') then
      v_new_expiry := public.membership_next_expiry(st.membership_expires_on, v_today);
      insert into public.memberships (student_id, order_item_id, kind, starts_on, expires_on)
      values (st.id, it.id, case when it.item_type = 'membership' then 'new' else 'renewal' end, v_today, v_new_expiry);
      update public.students
         set membership_expires_on = v_new_expiry,
             status = case when anonymized_at is null then 'active' else status end
       where id = st.id;
    elsif it.item_type = 'package' then
      select * into t from public.package_templates where id = it.package_template_id;
      insert into public.student_packages (branch_id, student_id, template_id, order_item_id, name, price,
          sessions_total, makeup_allowed, duration_days, paid_on, must_start_by)
      values (o.branch_id, st.id, t.id, it.id, t.name, t.price, t.sessions, t.makeup_allowed, t.duration_days,
              v_today, (v_today + interval '1 year')::date)
      returning id into v_pkg;
    end if;
  end loop;

  select p.full_name into v_customer from public.profiles p where p.id = o.account_id;
  v_customer := coalesce(v_customer, st.first_name || ' ' || st.last_name);

  -- เลขใบเสร็จ RC-<สาขา>-<ปี>-<00001> รันใหม่ทุกปีต่อสาขา
  insert into public.document_sequences (branch_id, doc_type, year, last_no)
  values (o.branch_id, 'receipt', extract(year from v_today)::int, 1)
  on conflict (branch_id, doc_type, year) do update set last_no = public.document_sequences.last_no + 1
  returning last_no into v_no;
  v_doc_no := 'RC-' || v_branch_code || '-' || extract(year from v_today)::int || '-' || lpad(v_no::text, 5, '0');

  insert into public.documents (branch_id, doc_type, doc_no, order_id, customer_name, subtotal, vat_rate,
      vat_inclusive, vat_amount, total, issued_by)
  values (o.branch_id, 'receipt', v_doc_no, o.id, v_customer, o.subtotal,
          case when coalesce(bs.vat_enabled, false) then bs.vat_rate else 0 end,
          coalesce(bs.vat_inclusive, true), o.vat_amount, o.total, auth.uid())
  returning id into v_doc;

  return jsonb_build_object('order_id', o.id, 'document_id', v_doc, 'doc_no', v_doc_no, 'total', o.total,
                            'student_package_id', v_pkg);
end $$;

-- sell_package: พฤติกรรมเดิม (ครูรับเงินแล้วออกใบเสร็จทันที)
create or replace function public.sell_package(p_student uuid, p_template uuid, p_with_membership boolean,
    p_method public.payment_method) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  st public.students%rowtype;
  v_order uuid;
  v_res jsonb;
begin
  select * into st from public.students where id = p_student;
  if st.id is null or not (public.is_staff() and public.has_branch(st.branch_id)) then
    raise exception 'FORBIDDEN';
  end if;
  v_order := public._create_package_order(p_student, p_template, p_with_membership, 'draft', p_method, null);
  v_res := public._fulfill_order(v_order);
  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (st.branch_id, auth.uid(), 'sell_package', 'orders', v_order,
            jsonb_build_object('student_id', st.id, 'template_id', p_template,
                               'student_package_id', v_res ->> 'student_package_id',
                               'with_membership', p_with_membership, 'method', p_method,
                               'doc_no', v_res ->> 'doc_no', 'total', v_res -> 'total'));
  return v_res - 'student_package_id';
end $$;

-- ============================================================
-- 6. ลูกค้า: ตัวเลือกการซื้อ + สั่งซื้อพร้อมสลิป
-- ============================================================
-- ข้อมูลหน้า "ซื้อแพ็กเกจ / ต่อสมาชิก" (ลูกค้าอ่าน branch_settings ตรงไม่ได้ จึงคืนเฉพาะที่ต้องใช้)
create function public.purchase_options(p_student uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  st public.students%rowtype;
  bs public.branch_settings%rowtype;
  v_today date := public.bkk_today();
  v_key text;
begin
  select * into st from public.students where id = p_student;
  if st.id is null or not (public.owns_student(st.id) or public.staff_sees_student(st.id)) then
    raise exception 'FORBIDDEN';
  end if;
  select * into bs from public.branch_settings where branch_id = st.branch_id;
  v_key := case when st.membership_expires_on is null then 'membership_new' else 'membership_renewal' end;
  return jsonb_build_object(
    'student', jsonb_build_object('id', st.id, 'code', st.code, 'name', st.first_name || ' ' || st.last_name,
                                  'nickname', st.nickname, 'membership_expires_on', st.membership_expires_on),
    'membership_required', st.membership_expires_on is null or st.membership_expires_on < v_today,
    'membership_kind', case when st.membership_expires_on is null then 'new' else 'renewal' end,
    'membership_price', coalesce((select amount from public.price_settings
                                   where key = v_key and (branch_id = st.branch_id or branch_id is null)
                                   order by branch_id nulls last limit 1), 0),
    'vat', jsonb_build_object('enabled', coalesce(bs.vat_enabled, false), 'inclusive', coalesce(bs.vat_inclusive, true),
                              'rate', coalesce(bs.vat_rate, 0)),
    'payment', jsonb_build_object('promptpay_id', bs.promptpay_id, 'bank_account', bs.bank_account),
    'templates', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'price', t.price,
                              'sessions', t.sessions, 'duration_days', t.duration_days) order by t.sort_order, t.price)
                             from public.package_templates t
                            where t.is_active and (t.branch_id is null or t.branch_id = st.branch_id)), '[]'::jsonb),
    'pending_order', (select jsonb_build_object('id', o.id, 'total', o.total, 'created_at', o.created_at)
                        from public.orders o join public.order_items i on i.order_id = o.id
                       where i.student_id = st.id and o.status = 'pending_review'
                       order by o.created_at desc limit 1));
end $$;

create function public.request_package_purchase(p_student uuid, p_template uuid, p_with_membership boolean,
    p_method public.payment_method, p_slip_path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  st public.students%rowtype;
  v_order uuid;
  v_total numeric;
begin
  select * into st from public.students where id = p_student;
  if st.id is null or not public.owns_student(st.id) then raise exception 'FORBIDDEN'; end if;
  if p_method not in ('transfer', 'promptpay') then raise exception 'FORBIDDEN'; end if;
  if coalesce(p_slip_path, '') = '' or p_slip_path not like auth.uid()::text || '/%' then
    raise exception 'SLIP_REQUIRED';
  end if;
  if exists (select 1 from public.orders o join public.order_items i on i.order_id = o.id
              where i.student_id = st.id and o.status = 'pending_review') then
    raise exception 'ORDER_PENDING';
  end if;

  v_order := public._create_package_order(p_student, p_template, p_with_membership, 'pending_review', p_method, p_slip_path);
  select total into v_total from public.orders where id = v_order;
  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (st.branch_id, auth.uid(), 'request_purchase', 'orders', v_order,
            jsonb_build_object('student_id', st.id, 'template_id', p_template, 'with_membership', p_with_membership,
                               'method', p_method, 'total', v_total));
  return jsonb_build_object('order_id', v_order, 'total', v_total);
end $$;

-- ============================================================
-- 7. ครู: ตรวจรับเงินจากสลิป
-- ============================================================
create function public.review_order(p_order uuid, p_approve boolean, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_res jsonb;
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null or not (public.is_staff() and public.has_branch(o.branch_id)) then raise exception 'FORBIDDEN'; end if;
  if o.status <> 'pending_review' then raise exception 'NOT_PENDING'; end if;

  if p_approve then
    v_res := public._fulfill_order(o.id);
    insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
      values (o.branch_id, auth.uid(), 'approve_slip', 'orders', o.id,
              jsonb_build_object('doc_no', v_res ->> 'doc_no', 'total', o.total));
    return v_res - 'student_package_id';
  end if;

  if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  update public.orders set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), reject_reason = trim(p_reason)
   where id = o.id;
  insert into public.audit_logs (branch_id, actor_id, action, entity, entity_id, data)
    values (o.branch_id, auth.uid(), 'reject_slip', 'orders', o.id, jsonb_build_object('reason', trim(p_reason)));
  return '{}'::jsonb;
end $$;

-- ============================================================
-- 8. สิทธิ์
-- ============================================================
revoke execute on function public.protect_own_role(), public._create_package_order(uuid, uuid, boolean,
  public.order_status, public.payment_method, text), public._fulfill_order(uuid) from public, anon, authenticated;
revoke execute on function public.purchase_options(uuid), public.request_package_purchase(uuid, uuid, boolean,
  public.payment_method, text), public.review_order(uuid, boolean, text) from public, anon;
grant execute on function public.purchase_options(uuid),
  public.request_package_purchase(uuid, uuid, boolean, public.payment_method, text),
  public.review_order(uuid, boolean, text)
  to authenticated;
