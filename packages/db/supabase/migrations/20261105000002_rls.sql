-- Row Level Security ตาม Spec v1
--   admin           เห็นและแก้ได้ทุกสาขา (2 คน สิทธิ์เท่ากัน)
--   branch_manager  เหมือนครู + แก้ปัญหาเบื้องต้นในสาขาตัวเอง (ทุกรายการเข้า review_queue)
--   teacher         สาขาที่ผูกไว้ · ไม่เห็นบัญชีโรงเรียน · เห็นเงินเดือนของตัวเอง
--   customer        เห็นเฉพาะผู้เรียนที่ผูกกับบัญชีตัวเอง · จองคลาสเองไม่ได้
--   kiosk           เรียกฟังก์ชันเช็คชื่อของสาขาตัวเองเท่านั้น
-- การเขียนสถานะสำคัญทำผ่านฟังก์ชัน security definer ใน migration 0003

create function public.my_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'branch_manager', 'teacher'), false)
$$;

create function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'branch_manager'), false)
$$;

create function public.has_branch(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.profile_branches pb where pb.profile_id = auth.uid() and pb.branch_id = b)
$$;

create function public.owns_student(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.student_accounts sa where sa.student_id = s and sa.account_id = auth.uid())
$$;

create function public.staff_sees_student(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() and exists (select 1 from public.students st where st.id = s and public.has_branch(st.branch_id))
$$;

-- เปิด RLS ทุกตาราง
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- ข้อมูลอ้างอิง: ทุกคนที่ล็อกอินอ่านได้, admin แก้ ----------
do $$
declare t text;
begin
  foreach t in array array['belt_ranks', 'exam_topics', 'uniform_sizes', 'price_settings', 'products', 'product_variants', 'holidays'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;

-- ข้อมูลที่หน้าเว็บสาธารณะใช้ (anon): สาขา, ราคาแพ็กเกจ, โพสต์ที่เผยแพร่
create policy branches_public on public.branches for select to anon, authenticated using (true);
create policy branches_admin on public.branches for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy branch_settings_read on public.branch_settings for select to authenticated using (public.has_branch(branch_id));
create policy branch_settings_admin on public.branch_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy package_templates_public on public.package_templates for select to anon, authenticated using (is_active);
create policy package_templates_admin on public.package_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- ผู้ใช้ ----------
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role());   -- เปลี่ยน role ตัวเองไม่ได้
create policy profiles_admin on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profile_branches_read on public.profile_branches for select to authenticated using (profile_id = auth.uid() or public.is_staff());
create policy profile_branches_admin on public.profile_branches for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- ลงทะเบียน ----------
create policy registrations_insert on public.registrations for insert to authenticated
  with check (account_id = auth.uid() and status = 'pending' and reviewed_by is null and student_id is null);
create policy registrations_own on public.registrations for select to authenticated using (account_id = auth.uid());
create policy registrations_staff on public.registrations for select to authenticated using (public.is_staff() and public.has_branch(branch_id));

-- ---------- ผู้เรียน ----------
create policy students_customer on public.students for select to authenticated using (public.owns_student(id));
create policy students_staff on public.students for select to authenticated using (public.is_staff() and public.has_branch(branch_id));
create policy students_staff_update on public.students for update to authenticated
  using (public.is_staff() and public.has_branch(branch_id)) with check (public.has_branch(branch_id));
create policy student_accounts_read on public.student_accounts for select to authenticated
  using (account_id = auth.uid() or public.staff_sees_student(student_id));
create policy guardians_read on public.guardians for select to authenticated
  using (public.owns_student(student_id) or public.staff_sees_student(student_id));
create policy guardians_staff_write on public.guardians for all to authenticated
  using (public.staff_sees_student(student_id)) with check (public.staff_sees_student(student_id));

-- ประวัติที่ลูกค้าเห็นได้: สมาชิก, แพ็กเกจ, การจอง, การมาเรียน, สาย, สอบ, แข่ง
do $$
declare t text;
begin
  foreach t in array array['memberships', 'student_packages', 'bookings', 'attendances', 'belt_history', 'competition_results'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.owns_student(student_id) or public.staff_sees_student(student_id))', t || '_read', t);
  end loop;
end $$;

-- ---------- คลาสและตาราง: staff ของสาขา ----------
create policy class_schedules_read on public.class_schedules for select to authenticated using (true);
create policy class_schedules_manage on public.class_schedules for all to authenticated
  using (public.is_manager() and public.has_branch(branch_id)) with check (public.is_manager() and public.has_branch(branch_id));
create policy class_sessions_read on public.class_sessions for select to authenticated using (true);
create policy class_sessions_manage on public.class_sessions for all to authenticated
  using (public.is_manager() and public.has_branch(branch_id)) with check (public.is_manager() and public.has_branch(branch_id));
create policy class_session_teachers_read on public.class_session_teachers for select to authenticated using (public.is_staff());
create policy class_session_teachers_manage on public.class_session_teachers for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy attendance_teachers_read on public.attendance_teachers for select to authenticated using (public.is_staff());
create policy checkin_queue_staff on public.checkin_review_queue for select to authenticated using (public.is_staff() and public.has_branch(branch_id));

-- ---------- ครูและเงินเดือน ----------
create policy teachers_self on public.teachers for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy teachers_admin on public.teachers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy day_claims_self on public.teacher_day_claims for select to authenticated using (teacher_id = auth.uid() or public.is_manager());
create policy day_claims_insert on public.teacher_day_claims for insert to authenticated
  with check (teacher_id = auth.uid() and public.has_branch(branch_id));
create policy payroll_runs_read on public.payroll_runs for select to authenticated using (public.is_staff());
create policy payroll_runs_admin on public.payroll_runs for all to authenticated using (public.is_admin()) with check (public.is_admin());
do $$
declare t text;
begin
  foreach t in array array['teacher_days', 'payroll_items', 'payroll_adjustments'] loop
    execute format('create policy %I on public.%I for select to authenticated using (teacher_id = auth.uid() or public.is_admin())', t || '_read', t);
  end loop;
end $$;
create policy teacher_days_admin on public.teacher_days for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- การขายและเอกสาร ----------
create policy promotions_read on public.promotions for select to authenticated using (true);
create policy promotions_admin on public.promotions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy orders_own on public.orders for select to authenticated using (account_id = auth.uid());
create policy orders_staff on public.orders for select to authenticated using (public.is_staff() and public.has_branch(branch_id));
create policy order_items_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.account_id = auth.uid() or (public.is_staff() and public.has_branch(o.branch_id)))));
create policy payments_read on public.payments for select to authenticated using (public.is_manager() and public.has_branch(branch_id));
create policy documents_own on public.documents for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.account_id = auth.uid()));
create policy documents_staff on public.documents for select to authenticated using (public.is_staff() and public.has_branch(branch_id));
-- บัญชีโรงเรียน: admin เท่านั้น (ครูไม่เห็นบัญชี)
create policy transactions_admin on public.transactions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy stock_read on public.stock_levels for select to authenticated using (public.is_staff() and public.has_branch(branch_id));
create policy stock_movements_read on public.stock_movements for select to authenticated using (public.is_manager() and public.has_branch(branch_id));

-- ---------- สอบ ----------
create policy exam_rounds_read on public.exam_rounds for select to authenticated using (public.is_staff() and public.has_branch(branch_id));
create policy exam_rounds_admin on public.exam_rounds for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy exam_candidates_read on public.exam_candidates for select to authenticated
  using (public.owns_student(student_id) or public.staff_sees_student(student_id));
create policy exam_results_read on public.exam_results for select to authenticated
  using (exists (select 1 from public.exam_candidates c where c.id = candidate_id and (public.owns_student(c.student_id) or public.staff_sees_student(c.student_id))));

-- ---------- งานแข่งและเว็บ ----------
create policy competitions_read on public.competitions for select to authenticated using (true);
create policy competitions_admin on public.competitions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy competition_teachers_read on public.competition_teachers for select to authenticated using (true);
create policy competition_results_admin on public.competition_results for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy posts_public on public.posts for select to anon, authenticated using (status = 'published' and visibility = 'public');
create policy posts_customers on public.posts for select to authenticated using (status = 'published');
create policy posts_staff_read on public.posts for select to authenticated using (public.is_staff());
create policy posts_draft on public.posts for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid() and (public.is_admin() or status in ('draft', 'pending')));
create policy posts_own_update on public.posts for update to authenticated
  using (author_id = auth.uid() and status in ('draft', 'pending')) with check (status in ('draft', 'pending'));
create policy posts_admin on public.posts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy post_media_public on public.post_media for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.status = 'published'));

-- ---------- คิวตรวจ แจ้งเตือน PDPA audit ----------
create policy review_queue_admin on public.review_queue for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy review_queue_own on public.review_queue for select to authenticated using (actor_id = auth.uid());
create policy data_requests_own on public.data_requests for insert to authenticated
  with check (requested_by = auth.uid() and public.owns_student(student_id));
create policy data_requests_read on public.data_requests for select to authenticated using (requested_by = auth.uid() or public.is_admin());
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using (public.is_admin());
-- ไม่มี policy = เข้าถึงผ่านฟังก์ชันเท่านั้น: document_sequences, notification_outbox
