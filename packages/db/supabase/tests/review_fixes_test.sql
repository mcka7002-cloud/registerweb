-- ทดสอบ migration 20261115000001_mvp1_review_fixes (role ตัวเอง, รูปผู้เรียน, ซื้อด้วยสลิป + ครูตรวจรับเงิน)
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

grant usage on schema public, auth, storage to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on storage.objects to authenticated;

-- admin, ครู BKK, ครู CNX, ผู้ปกครอง, ผู้ปกครองอื่น
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@demo.test', '{"full_name":"แอดมิน"}'),
  ('a0000000-0000-0000-0000-000000000003', 'teacher@demo.test', '{"full_name":"ครูหนึ่ง"}'),
  ('a0000000-0000-0000-0000-000000000004', 'teacher2@demo.test', '{"full_name":"ครูสอง"}'),
  ('a0000000-0000-0000-0000-000000000005', 'parent@demo.test', '{"full_name":"คุณแม่"}'),
  ('a0000000-0000-0000-0000-000000000008', 'parent2@demo.test', '{"full_name":"คุณพ่ออื่น"}');
update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001';
update public.profiles set role = 'teacher' where id in ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004');
insert into public.branches (id, code, name) values
  ('b0000000-0000-0000-0000-000000000001', 'BKK', 'สาขาหลัก'),
  ('b0000000-0000-0000-0000-000000000002', 'CNX', 'สาขาเชียงใหม่');
insert into public.branch_settings (branch_id, vat_enabled, vat_inclusive, vat_rate, promptpay_id, bank_account) values
  ('b0000000-0000-0000-0000-000000000001', true, true, 7, '0812345678', 'กสิกรไทย 123-4-56789-0');
insert into public.profile_branches values
  ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002');

-- ============================================================
-- สิทธิ์เรียกฟังก์ชัน
-- ============================================================
select pg_temp.check((select bool_and(has_function_privilege('authenticated', f, 'execute') and not has_function_privilege('anon', f, 'execute'))
  from unnest(array['public.purchase_options(uuid)',
    'public.request_package_purchase(uuid,uuid,boolean,public.payment_method,text)',
    'public.review_order(uuid,boolean,text)']) f), 'RPC ใหม่ grant ให้ authenticated เท่านั้น');
select pg_temp.check(not has_function_privilege('authenticated', 'public._fulfill_order(uuid)', 'execute')
  and not has_function_privilege('authenticated',
    'public._create_package_order(uuid,uuid,boolean,public.order_status,public.payment_method,text)', 'execute'),
  'ฟังก์ชันภายใน (_create_package_order, _fulfill_order) เรียกจาก API ไม่ได้');

-- ============================================================
-- #1 admin เปลี่ยน role ตัวเองไม่ได้
-- ============================================================
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check(pg_temp.err($q$update public.profiles set role = 'customer' where id = 'a0000000-0000-0000-0000-000000000001'$q$) = 'FORBIDDEN',
  'admin เปลี่ยน role ตัวเอง FORBIDDEN');
select pg_temp.check(pg_temp.err($q$update public.profiles set full_name = 'แอดมินใหญ่' where id = 'a0000000-0000-0000-0000-000000000001'$q$) = 'NO ERROR',
  'admin แก้ชื่อตัวเองได้');
select pg_temp.check(pg_temp.err($q$update public.profiles set role = 'branch_manager' where id = 'a0000000-0000-0000-0000-000000000008'$q$) = 'NO ERROR',
  'admin เปลี่ยน role คนอื่นได้');
reset role;
select pg_temp.check((select role = 'admin' from public.profiles where id = 'a0000000-0000-0000-0000-000000000001')
  and (select role = 'branch_manager' from public.profiles where id = 'a0000000-0000-0000-0000-000000000008'), 'role ถูกต้องหลังทดสอบ');
update public.profiles set role = 'customer' where id = 'a0000000-0000-0000-0000-000000000008';

-- ============================================================
-- #4 รูปผู้เรียน: อัปโหลดในโฟลเดอร์ตัวเอง → อนุมัติแล้วคัดลอกไปที่ผู้เรียน
-- ============================================================
select pg_temp.as_user('a0000000-0000-0000-0000-000000000005');
set local role authenticated;
select pg_temp.check(pg_temp.err($q$insert into storage.objects (bucket_id, name) values ('student-photos', 'a0000000-0000-0000-0000-000000000005/p1.jpg')$q$) = 'NO ERROR',
  'ผู้ปกครองอัปโหลดรูปในโฟลเดอร์ตัวเองได้');
select pg_temp.check(pg_temp.err($q$insert into storage.objects (bucket_id, name) values ('student-photos', 'a0000000-0000-0000-0000-000000000008/x.jpg')$q$) like '%row-level security%',
  'อัปโหลดในโฟลเดอร์คนอื่นไม่ได้');
select pg_temp.check(pg_temp.err($q$insert into storage.objects (bucket_id, name) values ('public-media', 'a0000000-0000-0000-0000-000000000005/x.jpg')$q$) like '%row-level security%',
  'อัปโหลด bucket อื่นไม่ได้');
insert into public.registrations (id, branch_id, account_id, payload, pdpa_consent) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005',
   '{"first_name":"ด.ช.ต้น","last_name":"ใจดี","first_name_en":"Ton","last_name_en":"Jaidee","birth_date":"2017-05-01",
     "photo_path":"a0000000-0000-0000-0000-000000000005/p1.jpg"}', true),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005',
   '{"first_name":"ด.ญ.ฟ้า","last_name":"ใจดี","first_name_en":"Fah","last_name_en":"Jaidee","birth_date":"2018-01-01",
     "photo_path":"a0000000-0000-0000-0000-000000000008/x.jpg"}', true);

select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');   -- ครู BKK
select pg_temp.check((select count(*) from storage.objects where name = 'a0000000-0000-0000-0000-000000000005/p1.jpg') = 1,
  'ครูสาขาเดียวกันเห็นรูปในใบสมัคร');
select (public.approve_registration('d0000000-0000-0000-0000-000000000001', '{}') ->> 'student_id') as sid \gset
select (public.approve_registration('d0000000-0000-0000-0000-000000000002', '{}') ->> 'student_id') as sid2 \gset
select pg_temp.as_user('a0000000-0000-0000-0000-000000000004');   -- ครู CNX
select pg_temp.check((select count(*) from storage.objects where name = 'a0000000-0000-0000-0000-000000000005/p1.jpg') = 0,
  'ครูสาขาอื่นไม่เห็นรูป');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000008');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'student-photos') = 0, 'ผู้ปกครองอื่นไม่เห็นรูป');
reset role;
select pg_temp.check((select photo_path from public.students where id = :'sid') = 'a0000000-0000-0000-0000-000000000005/p1.jpg',
  'อนุมัติแล้วคัดลอกรูปไปที่ผู้เรียน');
select pg_temp.check((select photo_path is null from public.students where id = :'sid2'), 'รูปในโฟลเดอร์คนอื่นไม่ถูกคัดลอก');

-- ============================================================
-- #5 #9 ผู้ปกครองซื้อแพ็กเกจ + สมาชิกด้วยสลิป
-- ============================================================
select id as tpl8 from public.package_templates where name = '8 ครั้ง / 30 วัน' \gset
select pg_temp.as_user('a0000000-0000-0000-0000-000000000008');
set local role authenticated;
select pg_temp.check(pg_temp.err(format('select public.purchase_options(%L)', :'sid')) = 'FORBIDDEN', 'ผู้ปกครองอื่นดูตัวเลือกการซื้อไม่ได้');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000005');
select public.purchase_options(:'sid') as opts \gset
select pg_temp.check((:'opts'::jsonb ->> 'membership_required')::boolean and (:'opts'::jsonb ->> 'membership_price')::numeric = 1000
  and :'opts'::jsonb -> 'payment' ->> 'promptpay_id' = '0812345678' and jsonb_array_length(:'opts'::jsonb -> 'templates') >= 1
  and :'opts'::jsonb -> 'pending_order' = 'null'::jsonb, 'purchase_options: ต้องมีสมาชิก ราคา 1000 PromptPay และแพ็กเกจ');

insert into storage.objects (bucket_id, name) values ('slips', 'a0000000-0000-0000-0000-000000000005/s1.jpg');
select pg_temp.check(pg_temp.err(format('select public.request_package_purchase(%L, %L, true, %L, null)', :'sid', :'tpl8', 'promptpay')) = 'SLIP_REQUIRED',
  'ไม่แนบสลิป SLIP_REQUIRED');
select pg_temp.check(pg_temp.err(format('select public.request_package_purchase(%L, %L, true, %L, %L)', :'sid', :'tpl8', 'promptpay',
  'a0000000-0000-0000-0000-000000000008/x.jpg')) = 'SLIP_REQUIRED', 'สลิปในโฟลเดอร์คนอื่น SLIP_REQUIRED');
select pg_temp.check(pg_temp.err(format('select public.request_package_purchase(%L, %L, true, %L, %L)', :'sid', :'tpl8', 'cash',
  'a0000000-0000-0000-0000-000000000005/s1.jpg')) = 'FORBIDDEN', 'ลูกค้าเลือกจ่ายเงินสดเองไม่ได้');
select pg_temp.check(pg_temp.err(format('select public.request_package_purchase(%L, %L, false, %L, %L)', :'sid', :'tpl8', 'promptpay',
  'a0000000-0000-0000-0000-000000000005/s1.jpg')) = 'MEMBERSHIP_REQUIRED', 'ยังไม่มีสมาชิก MEMBERSHIP_REQUIRED');
select public.request_package_purchase(:'sid', :'tpl8', true, 'promptpay', 'a0000000-0000-0000-0000-000000000005/s1.jpg') as req \gset
select pg_temp.check((:'req'::jsonb ->> 'total')::numeric = 3500, 'สั่งซื้อแพ็กเกจ + สมาชิก ยอด 3500');
select pg_temp.check(pg_temp.err(format('select public.request_package_purchase(%L, %L, true, %L, %L)', :'sid', :'tpl8', 'promptpay',
  'a0000000-0000-0000-0000-000000000005/s1.jpg')) = 'ORDER_PENDING', 'สั่งซ้ำระหว่างรอตรวจ ORDER_PENDING');
select pg_temp.check((public.purchase_options(:'sid') -> 'pending_order' ->> 'id') = (:'req'::jsonb ->> 'order_id'), 'purchase_options แสดงบิลที่รอตรวจ');
select pg_temp.check((select status = 'pending_review' and pay_method = 'promptpay' from public.orders where id = (:'req'::jsonb ->> 'order_id')::uuid),
  'ผู้ปกครองเห็นบิลตัวเอง สถานะรอตรวจ');
select pg_temp.check(pg_temp.err(format('select public.review_order(%L, true, null)', :'req'::jsonb ->> 'order_id')) = 'FORBIDDEN',
  'ผู้ปกครองอนุมัติบิลตัวเองไม่ได้');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.err(format('select public.request_package_purchase(%L, %L, true, %L, %L)', :'sid', :'tpl8', 'promptpay',
  'a0000000-0000-0000-0000-000000000003/s.jpg')) = 'FORBIDDEN', 'ครูใช้ช่องทางสั่งซื้อของลูกค้าไม่ได้');
reset role;
select pg_temp.check((select count(*) from public.payments) = 0 and (select count(*) from public.documents) = 0
  and (select count(*) from public.student_packages) = 0 and (select membership_expires_on is null from public.students where id = :'sid'),
  'ก่อนตรวจ: ยังไม่มีการชำระเงิน ใบเสร็จ แพ็กเกจ หรือสมาชิก');

-- ============================================================
-- #3 ครูตรวจรับเงิน
-- ============================================================
select pg_temp.as_user('a0000000-0000-0000-0000-000000000004');   -- ครู CNX
set local role authenticated;
select pg_temp.check(pg_temp.err(format('select public.review_order(%L, true, null)', :'req'::jsonb ->> 'order_id')) = 'FORBIDDEN',
  'ครูสาขาอื่นตรวจไม่ได้');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'slips') = 0, 'ครูสาขาอื่นไม่เห็นสลิป');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');   -- ครู BKK
select pg_temp.check((select count(*) from storage.objects where name = 'a0000000-0000-0000-0000-000000000005/s1.jpg') = 1, 'ครูสาขาเดียวกันเห็นสลิป');
select pg_temp.check(pg_temp.err(format('select public.review_order(%L, false, %L)', :'req'::jsonb ->> 'order_id', ' ')) = 'REASON_REQUIRED',
  'ปฏิเสธไม่มีเหตุผล REASON_REQUIRED');
select public.review_order((:'req'::jsonb ->> 'order_id')::uuid, true, null) as ok1 \gset
select pg_temp.check((:'ok1'::jsonb ->> 'doc_no') = 'RC-BKK-' || extract(year from pg_temp.today()) || '-00001'
  and (:'ok1'::jsonb ->> 'total')::numeric = 3500 and not (:'ok1'::jsonb ? 'student_package_id'), 'อนุมัติสลิป → ใบเสร็จ RC-BKK-ปี-00001');
select pg_temp.check(pg_temp.err(format('select public.review_order(%L, true, null)', :'req'::jsonb ->> 'order_id')) = 'NOT_PENDING', 'อนุมัติซ้ำ NOT_PENDING');
select pg_temp.check((select count(*) = 1 and bool_and(method = 'promptpay' and amount = 3500) from public.payments), 'ครูเห็นเงินที่ตัวเองรับ');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from public.payments) = 0, 'ครูอื่นไม่เห็นเงินที่คนอื่นรับ');
reset role;
select pg_temp.check((select status = 'approved' and reviewed_by = 'a0000000-0000-0000-0000-000000000003'
  from public.orders where id = (:'req'::jsonb ->> 'order_id')::uuid), 'บิล approved โดยครู');
select pg_temp.check((select received_by = 'a0000000-0000-0000-0000-000000000003' from public.payments), 'ผู้รับเงิน = ครูที่ตรวจ');
select pg_temp.check((select membership_expires_on = (pg_temp.today() + interval '1 year')::date and status = 'active' from public.students where id = :'sid'),
  'สมาชิกหมด = วันนี้ + 1 ปี');
select pg_temp.check((select count(*) = 1 and bool_and(sessions_total = 8 and paid_on = pg_temp.today()) from public.student_packages where student_id = :'sid'),
  'สร้างแพ็กเกจ 8 ครั้ง');
select pg_temp.check((select customer_name = 'คุณแม่' and vat_amount = 228.97 from public.documents), 'ใบเสร็จชื่อผู้ปกครอง VAT ถูก');
select pg_temp.check((select count(*) from public.audit_logs where action in ('request_purchase', 'approve_slip')) = 2, 'สั่งซื้อและตรวจเขียน audit');

-- ปฏิเสธสลิป
select pg_temp.as_user('a0000000-0000-0000-0000-000000000005');
set local role authenticated;
insert into storage.objects (bucket_id, name) values ('slips', 'a0000000-0000-0000-0000-000000000005/s2.jpg');
select public.request_package_purchase(:'sid', :'tpl8', false, 'transfer', 'a0000000-0000-0000-0000-000000000005/s2.jpg') as req2 \gset
select pg_temp.check((:'req2'::jsonb ->> 'total')::numeric = 2500, 'สมาชิกยังไม่หมด ซื้อแพ็กเกจอย่างเดียว 2500');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select pg_temp.check(public.review_order((:'req2'::jsonb ->> 'order_id')::uuid, false, 'ยอดในสลิปไม่ตรง') = '{}'::jsonb, 'ปฏิเสธสลิปได้');
reset role;
select pg_temp.check((select status = 'rejected' and reject_reason = 'ยอดในสลิปไม่ตรง' from public.orders where id = (:'req2'::jsonb ->> 'order_id')::uuid),
  'บิล rejected พร้อมเหตุผล');
select pg_temp.check((select count(*) from public.payments) = 1 and (select count(*) from public.student_packages) = 1, 'ปฏิเสธแล้วไม่สร้างเงิน/แพ็กเกจ');

-- sell_package หลัง refactor ยังออกเลขถัดไปและผู้รับเงินคือครู
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select pg_temp.check((public.sell_package(:'sid', :'tpl8', false, 'cash') ->> 'doc_no') like '%-00002', 'sell_package ใช้เลขใบเสร็จต่อจากบิลสลิป');
reset role;

rollback;
