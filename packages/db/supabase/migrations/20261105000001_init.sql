-- RegisterWeb: schema หลัก ตาม Spec v1 (ล็อก 12 พ.ย. 2026)
-- อ้างอิงแท็บ Spec และ Technical flow ใน RegisterWeb Team Workspace
-- กติกา:
--   * ข้อมูลของสาขามี branch_id เสมอ และเปิด RLS ใน migration 0002
--   * เขียนสถานะสำคัญ (เช็คชื่อ, ขาย, อนุมัติสลิป, ผลสอบ, ปิดรอบเงินเดือน) ผ่านฟังก์ชัน security definer เท่านั้น
--   * เอกสารภาษีและ audit ห้ามลบ ยกเลิก (void) ได้อย่างเดียว
--   * ราคาทุกอย่างตั้งค่าได้ ค่าใน seed เป็นค่าเริ่มต้นจาก Grill Session

create extension if not exists pgcrypto;

-- ============================================================
-- enums
-- ============================================================
create type public.app_role as enum ('admin', 'branch_manager', 'teacher', 'customer', 'kiosk');
create type public.student_status as enum ('active', 'inactive');
create type public.registration_status as enum ('pending', 'trial_booked', 'approved', 'rejected');
create type public.package_status as enum ('active', 'expired');
create type public.booking_status as enum ('booked', 'attended', 'absent', 'cancelled');
create type public.attendance_method as enum ('scan', 'manual');
create type public.attendance_source as enum ('online', 'offline_sync');
create type public.employment_status as enum ('probation', 'permanent');
create type public.payroll_status as enum ('open', 'closed', 'paid');
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.order_status as enum ('draft', 'pending_review', 'approved', 'rejected');
create type public.order_item_type as enum ('package', 'membership', 'membership_renewal', 'product', 'exam_fee', 'exam_photo', 'card_fee');
create type public.payment_method as enum ('cash', 'transfer', 'promptpay', 'slip');
create type public.doc_type as enum ('receipt', 'tax_invoice');
create type public.doc_status as enum ('issued', 'void');
create type public.txn_type as enum ('income', 'expense');
create type public.promo_kind as enum ('percent', 'amount', 'sibling', 'bonus_sessions', 'multi_month');
create type public.exam_round_status as enum ('open', 'scored', 'closed');
create type public.medal as enum ('gold', 'silver', 'bronze', 'participant');
create type public.post_kind as enum ('news', 'album', 'video', 'achievement');
create type public.post_status as enum ('draft', 'pending', 'published', 'archived');
create type public.post_visibility as enum ('public', 'customers');
create type public.notify_channel as enum ('email', 'line');

-- ============================================================
-- สาขา การตั้งค่า และผู้ใช้
-- ============================================================
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  tax_id text,
  open_hours jsonb,                         -- ช่วงเวลาให้เลือกวันนัดทดลองเรียน
  created_at timestamptz not null default now()
);

create table public.branch_settings (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  vat_enabled boolean not null default false,   -- ปิด = ไม่คิด VAT ทุกรายการ
  vat_inclusive boolean not null default true,
  vat_rate numeric(5,2) not null default 7.00 check (vat_rate >= 0),
  updated_at timestamptz not null default now()
);

-- ราคาที่ตั้งค่าได้ (null branch = ใช้ทุกสาขา)
create table public.price_settings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id),
  key text not null check (key in ('membership_new', 'membership_renewal', 'exam_color', 'exam_black', 'exam_photo', 'card_replacement')),
  amount numeric(10,2) not null check (amount >= 0),
  unique (branch_id, key)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,                      -- ล็อกอินด้วย Gmail ทุก role
  role public.app_role not null default 'customer',
  locale text not null default 'th' check (locale in ('th', 'en')),
  line_user_id text,                        -- เฟส 2: เชื่อม LINE Login
  notify_channels public.notify_channel[] not null default '{email}',
  created_at timestamptz not null default now()
);

-- ครู/ผู้จัดการสาขา/kiosk ผูกได้หลายสาขา
create table public.profile_branches (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  primary key (profile_id, branch_id)
);

-- ============================================================
-- สายและหัวข้อสอบ
-- ============================================================
create table public.belt_ranks (
  id smallint primary key,                  -- ลำดับต่ำไปสูง
  name_th text not null,
  name_en text not null,
  gup smallint,                             -- สายขาวและสายดำ = null
  dan smallint,                             -- สายดำ ดั้ง 1–10
  classes_required int not null,            -- ต้องมาเรียนจริงกี่ครั้งก่อนสอบขั้นถัดไป
  needs_admin_approval boolean not null default false  -- สายดำขึ้นไป
);

-- หัวข้อสอบเพื่อขึ้นจาก rank นี้ไป rank ถัดไป (ผ่าน/ไม่ผ่าน ไม่มีคะแนน) admin แก้ได้
create table public.exam_topics (
  id uuid primary key default gen_random_uuid(),
  from_rank smallint not null references public.belt_ranks(id),
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- ============================================================
-- ลงทะเบียน ลูกค้า และผู้เรียน
-- ============================================================
-- ฟอร์มสาธารณะเขียนลงตารางนี้ ครูประเมินหลังทดลองเรียนแล้วจึงสร้าง student
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  account_id uuid references public.profiles(id),   -- บัญชี Gmail ที่กรอก
  payload jsonb not null,                           -- ฟิลด์ฟอร์มสมัครทั้งหมด
  pdpa_consent boolean not null check (pdpa_consent),
  publish_consent boolean not null default false,   -- ยินยอมเผยแพร่ชื่อ/รูปบนเว็บ
  trial_at timestamptz,                             -- วันนัดทดลองเรียน
  status public.registration_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  reject_reason text,
  student_id uuid,
  created_at timestamptz not null default now(),
  check (status <> 'rejected' or coalesce(reject_reason, '') <> '')
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),   -- สาขาหลัก (ย้ายได้)
  code text not null unique,                 -- ค่าในบาร์โค้ด/QR
  first_name text not null,
  last_name text not null,
  first_name_en text not null,
  last_name_en text not null,
  nickname text,
  birth_date date not null,
  gender text,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  uniform_size text,
  medical_notes text,
  photo_path text,                           -- Storage bucket "student-photos" (private)
  belt_rank_id smallint not null default 0 references public.belt_ranks(id),
  exam_counter int not null default 0,       -- ครั้งที่มาเรียนจริงนับจากวันสอบล่าสุด
  exam_eligible_at timestamptz,              -- ขึ้นสถานะ "สอบได้"
  membership_expires_on date,                -- สมาชิก 1 ปี ใช้ได้ทุกสาขา
  status public.student_status not null default 'active',
  trial_used_at timestamptz,
  publish_consent boolean not null default false,
  pdpa_consent_at timestamptz,
  emergency_name text,                       -- ผู้เรียนอายุ 20+ ไม่มีผู้ปกครอง
  emergency_phone text,
  anonymized_at timestamptz,                 -- PDPA: ปิดบังข้อมูลแล้ว
  created_at timestamptz not null default now()
);
create index on public.students (branch_id, status);

alter table public.registrations
  add constraint registrations_student_fk foreign key (student_id) references public.students(id);

-- ผู้เรียน 1 คนผูกได้สูงสุด 2 บัญชี (ตรวจใน trigger)
create table public.student_accounts (
  student_id uuid not null references public.students(id) on delete cascade,
  account_id uuid not null references public.profiles(id) on delete cascade,
  primary key (student_id, account_id)
);

-- ข้อมูลผู้ปกครองตามฟอร์ม (สูงสุด 2 คนต่อผู้เรียน, 3 เบอร์ต่อคน)
create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  account_id uuid references public.profiles(id),
  full_name text not null,
  nickname text,
  relation text not null,
  phones text[] not null check (cardinality(phones) between 1 and 3),
  sort_order smallint not null default 1 check (sort_order in (1, 2))
);

-- ============================================================
-- ค่าสมาชิกรายปี
-- ============================================================
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  order_item_id uuid,                        -- รายการขายที่จ่ายค่าสมาชิก (null = admin ยกเว้น)
  kind text not null check (kind in ('new', 'renewal')),
  starts_on date not null,
  expires_on date not null,                  -- ต่อก่อนหมด = วันหมดเดิม + 1 ปี
  waived_by uuid references public.profiles(id),
  waive_reason text,
  created_at timestamptz not null default now(),
  check (expires_on > starts_on),
  check (waived_by is null or coalesce(waive_reason, '') <> '')
);
create index on public.memberships (student_id, expires_on);

-- ============================================================
-- ตารางคลาส (รอรายละเอียดข้อ 12/79)
-- ============================================================
create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = อาทิตย์
  starts_at time not null,
  ends_at time not null,
  capacity int check (capacity is null or capacity > 0),
  is_active boolean not null default true,
  check (ends_at > starts_at)
);

-- คลาสจริงรายวัน สร้างจาก schedule ล่วงหน้า
create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  schedule_id uuid references public.class_schedules(id),
  class_date date not null,
  starts_at time not null,
  ends_at time not null,
  capacity int,
  cancelled boolean not null default false,
  unique (branch_id, class_date, starts_at)
);
create index on public.class_sessions (branch_id, class_date);

-- ครูที่จัดลงคลาสล่วงหน้า (หลายคนได้)
create table public.class_session_teachers (
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  primary key (class_session_id, teacher_id)
);

-- ============================================================
-- แพ็กเกจและการจอง
-- ============================================================
create table public.package_templates (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id),   -- null = ทุกสาขา
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  sessions int check (sessions is null or sessions > 0),  -- null = ไม่จำกัด
  duration_days int not null check (duration_days > 0),
  makeup_allowed int not null default 1 check (makeup_allowed >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- snapshot ค่าตอนขาย · ใช้ได้สาขาเดียว · ไม่คืนเงิน ไม่พัก
create table public.student_packages (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  student_id uuid not null references public.students(id),
  template_id uuid references public.package_templates(id),
  order_item_id uuid,
  name text not null,
  price numeric(10,2) not null,
  sessions_total int,
  sessions_used int not null default 0,
  bonus_sessions int not null default 0,       -- โปรแถมครั้งเรียน
  makeup_allowed int not null default 1,
  makeup_used int not null default 0,
  duration_days int not null,
  paid_on date not null,
  starts_on date,                              -- นับจากวันเรียนครั้งแรก
  expires_on date,
  must_start_by date not null,                 -- ต้องเริ่มเรียนภายใน 1 ปีนับจากวันจ่าย
  queue_after uuid references public.student_packages(id),   -- ต่อก่อนหมด เข้าคิวต่อท้าย
  status public.package_status not null default 'active',
  created_at timestamptz not null default now(),
  check (expires_on is null or expires_on >= starts_on),
  check (sessions_total is null or sessions_used <= sessions_total + bonus_sessions),
  check (makeup_used <= makeup_allowed)
);
create index on public.student_packages (student_id, status);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  student_id uuid not null references public.students(id),
  student_package_id uuid not null references public.student_packages(id),
  class_session_id uuid not null references public.class_sessions(id),
  status public.booking_status not null default 'booked',
  is_makeup boolean not null default false,
  makeup_for_booking_id uuid references public.bookings(id),
  created_by uuid not null references public.profiles(id),   -- ครู/admin เท่านั้น ลูกค้าจองเองไม่ได้
  created_at timestamptz not null default now(),
  unique (student_id, class_session_id)
);

-- ============================================================
-- เช็คชื่อ (online + offline sync)
-- ============================================================
create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  student_id uuid not null references public.students(id),
  student_package_id uuid references public.student_packages(id),   -- null = ทดลองเรียน
  booking_id uuid references public.bookings(id),
  class_session_id uuid references public.class_sessions(id),
  client_uuid uuid not null unique,            -- กันส่งซ้ำตอน sync
  scanned_at timestamptz not null,             -- เวลาสแกนจริงในเครื่อง
  recorded_at timestamptz not null default now(),
  method public.attendance_method not null,
  source public.attendance_source not null default 'online',
  is_trial boolean not null default false,     -- ไม่นับตัวนับสอบ
  recorded_by uuid references public.profiles(id),
  reason text,                                 -- บังคับเมื่อ key-in
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  void_reason text,
  check (method = 'scan' or (recorded_by is not null and coalesce(reason, '') <> '')),
  check (is_trial or student_package_id is not null)
);
create unique index attendances_one_per_session on public.attendances (student_id, class_session_id) where voided_at is null;

-- ครูที่ระบุตอนเช็คชื่อคลาส = ข้อมูลวันสอนจริง
create table public.attendance_teachers (
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  recorded_by uuid references public.profiles(id),
  recorded_at timestamptz not null default now(),
  primary key (class_session_id, teacher_id)
);

-- รายการ sync ที่ผิดกฎ (แพ็กเกจหมด, ไม่ได้จอง, ...) รอครูตัดสิน
create table public.checkin_review_queue (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  client_uuid uuid not null unique,
  student_id uuid references public.students(id),
  barcode text not null,
  scanned_at timestamptz not null,
  problem text not null,
  status public.approval_status not null default 'pending',
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_note text
);

-- ============================================================
-- ครูและเงินเดือน
-- ============================================================
create table public.teachers (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  employment_status public.employment_status not null default 'probation',
  daily_rate numeric(10,2),                    -- ช่วงทดลองงาน
  monthly_salary numeric(10,2),                -- หลังผ่านโปร
  absence_deduction numeric(10,2) not null default 0,   -- หักต่อวันที่ขาด
  weekend_rate numeric(10,2) not null default 0,        -- ค่าพิเศษต่อวัน เสาร์–อาทิตย์
  permanent_from date,                         -- เริ่มคิดรายเดือนรอบถัดไปหลังกด "ผ่านโปร"
  check (employment_status = 'probation' or monthly_salary is not null)
);

-- วันหยุดที่ admin ระบุ (null branch = ทุกสาขา)
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id),
  holiday_date date not null,
  name text,
  unique (branch_id, holiday_date)
);

-- ครูลงวันสอนเอง (ย้อนหลังได้จนปิดรอบ)
create table public.teacher_day_claims (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  teacher_id uuid not null references public.profiles(id),
  work_date date not null,
  note text,
  created_at timestamptz not null default now(),
  unique (teacher_id, branch_id, work_date)
);

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique check (extract(day from period_month) = 1),
  status public.payroll_status not null default 'open',
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  paid_by uuid references public.profiles(id),
  paid_at timestamptz
);

-- ผลเทียบรายวัน: ตาราง vs ลงเอง vs เช็คชื่อ
create table public.teacher_days (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  branch_id uuid not null references public.branches(id),
  work_date date not null,
  classes_assigned int not null,
  classes_taught int not null,
  claimed boolean not null,
  result text not null check (result in ('full', 'absent', 'mismatch')),   -- ขาดคลาสใด = absent
  resolved_result text check (resolved_result in ('full', 'absent')),
  resolved_by uuid references public.profiles(id),
  resolve_note text,
  unique (payroll_run_id, teacher_id, branch_id, work_date)
);

create table public.payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  amount numeric(10,2) not null,               -- + เพิ่ม / − ลด / ค่าจ้างพิเศษ manual
  note text not null check (note <> ''),
  created_by uuid not null references public.profiles(id),
  approval public.approval_status not null default 'approved',   -- ผู้จัดการสาขาทำ = pending
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.payroll_items (
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  base_amount numeric(10,2) not null,
  absent_days int not null default 0,
  deduction_amount numeric(10,2) not null default 0,
  weekend_days int not null default 0,
  weekend_amount numeric(10,2) not null default 0,
  adjustment_amount numeric(10,2) not null default 0,
  net_amount numeric(10,2) not null,
  primary key (payroll_run_id, teacher_id)
);

-- ============================================================
-- การขาย การชำระเงิน เอกสาร
-- ============================================================
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id),
  name text not null,
  kind public.promo_kind not null,
  value numeric(10,2) not null check (value >= 0),
  applies_to_membership boolean not null default false,
  applies_to_products boolean not null default false,
  code text unique,
  starts_on date not null,
  ends_on date not null,                       -- ทุกโปรมีวันหมดเขต
  is_active boolean not null default true,
  check (ends_on >= starts_on)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  account_id uuid references public.profiles(id),   -- ลูกค้าที่ซื้อ (บิลรวมหลายผู้เรียนได้)
  created_by uuid not null references public.profiles(id),
  status public.order_status not null default 'draft',
  promotion_id uuid references public.promotions(id),
  slip_path text,                                   -- Storage bucket "slips" (private)
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  reject_reason text,
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  vat_amount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  check (status <> 'rejected' or coalesce(reject_reason, '') <> '')
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type public.order_item_type not null,
  student_id uuid references public.students(id),
  package_template_id uuid references public.package_templates(id),
  product_variant_id uuid,
  exam_candidate_id uuid,
  description text not null,
  qty int not null default 1 check (qty > 0),
  unit_price numeric(10,2) not null,
  discount numeric(10,2) not null default 0,
  amount numeric(10,2) not null
);

alter table public.memberships add constraint memberships_item_fk foreign key (order_item_id) references public.order_items(id);
alter table public.student_packages add constraint student_packages_item_fk foreign key (order_item_id) references public.order_items(id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  order_id uuid not null references public.orders(id),
  amount numeric(10,2) not null check (amount >= 0),
  method public.payment_method not null,
  paid_at timestamptz not null default now(),
  received_by uuid references public.profiles(id)    -- ครูที่ยืนยัน/อนุมัติสลิป
);

create table public.document_sequences (
  branch_id uuid not null references public.branches(id),
  doc_type public.doc_type not null,
  year int not null,
  last_no int not null default 0,
  primary key (branch_id, doc_type, year)
);

-- ใบเสร็จ 2 ภาษา · ใบกำกับภาษีภาษาไทย · เลขรันแยกสาขา
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  doc_type public.doc_type not null,
  doc_no text not null,
  order_id uuid not null references public.orders(id),
  issued_at timestamptz not null default now(),
  customer_name text not null,
  customer_tax_id text,
  customer_address text,
  subtotal numeric(10,2) not null,
  vat_rate numeric(5,2) not null default 0,
  vat_inclusive boolean not null default true,
  vat_amount numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  status public.doc_status not null default 'issued',
  void_reason text,
  void_requested_by uuid references public.profiles(id),
  voided_by uuid references public.profiles(id),     -- admin เท่านั้น
  voided_at timestamptz,
  issued_by uuid references public.profiles(id),
  unique (branch_id, doc_type, doc_no),
  check (status = 'issued' or (void_reason is not null and voided_at is not null and voided_by is not null))
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  type public.txn_type not null,
  category text not null,
  description text,
  amount numeric(10,2) not null check (amount >= 0),
  vat_amount numeric(10,2) not null default 0,
  occurred_on date not null,
  document_id uuid references public.documents(id),
  payroll_run_id uuid references public.payroll_runs(id),   -- รายจ่ายเงินเดือนอัตโนมัติ
  receipt_path text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.transactions (branch_id, occurred_on);

-- ============================================================
-- สินค้า (ชุด เสื้อ กางเกง)
-- ============================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('uniform', 'shirt', 'pants', 'other')),
  is_active boolean not null default true
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  price numeric(10,2) not null check (price >= 0),
  unique (product_id, size)
);

alter table public.order_items add constraint order_items_variant_fk foreign key (product_variant_id) references public.product_variants(id);

create table public.stock_levels (
  branch_id uuid not null references public.branches(id),
  variant_id uuid not null references public.product_variants(id),
  qty int not null default 0 check (qty >= 0),
  primary key (branch_id, variant_id)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  variant_id uuid not null references public.product_variants(id),
  qty_change int not null,
  reason text not null check (reason in ('receive', 'sale', 'transfer_out', 'transfer_in', 'adjust')),
  transfer_id uuid,
  order_item_id uuid references public.order_items(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ตารางไซส์ชุดตามส่วนสูง (เติมอัตโนมัติในฟอร์ม)
create table public.uniform_sizes (
  size text primary key,
  label text not null,
  height_min int not null,
  height_max int not null,
  collar text not null,
  check (height_max >= height_min)
);

-- ============================================================
-- สอบเลื่อนสาย
-- ============================================================
create table public.exam_rounds (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  exam_date date not null,
  status public.exam_round_status not null default 'open',
  created_by uuid not null references public.profiles(id)
);

create table public.exam_candidates (
  id uuid primary key default gen_random_uuid(),
  exam_round_id uuid not null references public.exam_rounds(id) on delete cascade,
  student_id uuid not null references public.students(id),
  from_rank smallint not null references public.belt_ranks(id),
  to_rank smallint not null references public.belt_ranks(id),
  prelim_passed_by uuid not null references public.profiles(id),   -- ครูสอบย่อยผ่านแล้ว
  prelim_passed_at timestamptz not null default now(),
  admin_approved_by uuid references public.profiles(id),          -- สายดำขึ้นไป
  retake_of uuid references public.exam_candidates(id),
  free_retake boolean not null default false,                      -- สายดำแก้ตัวฟรี 1 ครั้ง
  wants_photo boolean not null default false,
  passed boolean,
  unique (exam_round_id, student_id),
  check (to_rank = from_rank + 1)
);

-- snapshot หัวข้อตอนลงสอบ · สอบซ้ำมีเฉพาะหัวข้อที่ไม่ผ่าน
create table public.exam_results (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.exam_candidates(id) on delete cascade,
  topic_name text not null,
  sort_order int not null default 0,
  passed boolean,
  scored_by uuid references public.profiles(id)
);

alter table public.order_items add constraint order_items_exam_fk foreign key (exam_candidate_id) references public.exam_candidates(id);

create table public.belt_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  from_rank smallint references public.belt_ranks(id),
  to_rank smallint not null references public.belt_ranks(id),
  exam_candidate_id uuid references public.exam_candidates(id),
  changed_by uuid not null references public.profiles(id),
  note text,
  changed_at timestamptz not null default now()
);

-- ============================================================
-- งานแข่ง (เฟสแรก: บันทึกงาน + ผล · รายรับ-จ่ายอยู่ BL-1)
-- ============================================================
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  location text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.competition_teachers (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  primary key (competition_id, teacher_id)
);

create table public.competition_results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  student_id uuid not null references public.students(id),
  category text not null,                    -- รุ่น/ประเภท
  result public.medal not null,
  publish boolean not null default false     -- admin เลือกเผยแพร่บนเว็บ
);

-- ============================================================
-- เว็บข่าวสารและผลงาน
-- ============================================================
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id),   -- null = ทุกสาขา
  kind public.post_kind not null,
  visibility public.post_visibility not null default 'public',
  status public.post_status not null default 'draft',
  title_th text not null,
  title_en text,
  body_th text,
  body_en text,
  youtube_url text,
  competition_id uuid references public.competitions(id),
  author_id uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),   -- ครูร่าง → admin อนุมัติ
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  path text not null,                         -- Storage bucket "public-media"
  sort_order int not null default 0
);

-- ============================================================
-- คิวตรวจ แจ้งเตือน PDPA audit
-- ============================================================
-- รายการของผู้จัดการสาขา: มีผลทันทีแล้วรอ admin ตรวจ หรือรออนุมัติก่อนมีผล
create table public.review_queue (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id),
  actor_id uuid not null references public.profiles(id),
  entity text not null,
  entity_id uuid not null,
  action text not null,
  requires_approval boolean not null default false,   -- void ภาษี, ปรับเงินเดือน
  status public.approval_status not null default 'pending',
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_outbox (
  id bigint generated always as identity primary key,
  channel public.notify_channel not null,
  to_profile uuid references public.profiles(id),
  to_address text not null,
  template text not null,       -- news, package_expiring, membership_expiring, exam_eligible, slip_result, exam_result, trial_result
  payload jsonb not null default '{}',
  dedupe_key text unique,       -- กันส่งซ้ำจาก cron
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  requested_by uuid not null references public.profiles(id),
  kind text not null default 'erase' check (kind in ('erase', 'export')),
  status public.approval_status not null default 'pending',
  processed_by uuid references public.profiles(id),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  branch_id uuid references public.branches(id),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  data jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (entity, entity_id);

-- ============================================================
-- triggers กฎที่ฐานข้อมูลต้องบังคับเอง
-- ============================================================
create function public.forbid_delete() returns trigger language plpgsql as $$
begin
  raise exception '% cannot be deleted; void it instead', tg_table_name;
end $$;
create trigger documents_no_delete before delete on public.documents for each row execute function public.forbid_delete();
create trigger audit_logs_no_delete before delete on public.audit_logs for each row execute function public.forbid_delete();
create trigger payments_no_delete before delete on public.payments for each row execute function public.forbid_delete();

-- ผู้เรียน 1 คนผูกได้สูงสุด 2 บัญชี
create function public.check_student_accounts_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.student_accounts where student_id = new.student_id) >= 2 then
    raise exception 'a student can be linked to at most 2 accounts';
  end if;
  return new;
end $$;
create trigger student_accounts_limit before insert on public.student_accounts
  for each row execute function public.check_student_accounts_limit();

-- เงินเดือนที่ปิดรอบแล้วแก้ไม่ได้ (ยกเว้น admin เปลี่ยนสถานะ run เอง)
create function public.forbid_closed_payroll() returns trigger language plpgsql as $$
declare st public.payroll_status;
begin
  select status into st from public.payroll_runs where id = coalesce(new.payroll_run_id, old.payroll_run_id);
  if st <> 'open' then
    raise exception 'payroll run is %; reopen it first', st;
  end if;
  return coalesce(new, old);
end $$;
create trigger teacher_days_locked before insert or update or delete on public.teacher_days
  for each row execute function public.forbid_closed_payroll();
create trigger payroll_adjustments_locked before insert or update or delete on public.payroll_adjustments
  for each row execute function public.forbid_closed_payroll();

-- ============================================================
-- seed ค่าเริ่มต้นจาก Grill Session
-- ============================================================
insert into public.price_settings (branch_id, key, amount) values
  (null, 'membership_new', 1000), (null, 'membership_renewal', 1000),
  (null, 'exam_color', 1000), (null, 'exam_photo', 299), (null, 'card_replacement', 0);

-- สายสี: ขาว 12 ครั้ง · เหลือง 1–แดง 1 ขั้นละ 14 · แดง 2 → ดำ 30 · สายดำขึ้นไปอย่างน้อย 30 + admin อนุมัติ
insert into public.belt_ranks (id, name_th, name_en, gup, dan, classes_required, needs_admin_approval) values
  (0, 'สายขาว', 'White', null, null, 12, false),
  (1, 'สายเหลือง 1', 'Yellow 1', 10, null, 14, false),
  (2, 'สายเหลือง 2', 'Yellow 2', 9, null, 14, false),
  (3, 'สายเขียว 1', 'Green 1', 8, null, 14, false),
  (4, 'สายเขียว 2', 'Green 2', 7, null, 14, false),
  (5, 'สายฟ้า 1', 'Blue 1', 6, null, 14, false),
  (6, 'สายฟ้า 2', 'Blue 2', 5, null, 14, false),
  (7, 'สายน้ำตาล 1', 'Brown 1', 4, null, 14, false),
  (8, 'สายน้ำตาล 2', 'Brown 2', 3, null, 14, false),
  (9, 'สายแดง 1', 'Red 1', 2, null, 14, false),
  (10, 'สายแดง 2', 'Red 2', 1, null, 30, false);
insert into public.belt_ranks (id, name_th, name_en, gup, dan, classes_required, needs_admin_approval)
  select 10 + d, 'สายดำ ดั้ง ' || d, 'Black Dan ' || d, null, d, 30, true from generate_series(1, 10) d;

insert into public.exam_topics (from_rank, name, sort_order)
  select 0, t, o from unnest(array['ท่าชก','ท่าเตะ','Poomsae','ฟันไม้']) with ordinality as x(t, o);
insert into public.exam_topics (from_rank, name, sort_order)
  select r, t, o from generate_series(1, 2) r, unnest(array['ท่าเตะ','Poomsae','เตะเป้าเร็ว','ฟันไม้']) with ordinality as x(t, o);
insert into public.exam_topics (from_rank, name, sort_order)
  select r, t, o from generate_series(3, 9) r, unnest(array['ท่าเตะ','Poomsae','เตะเข้าคู่']) with ordinality as x(t, o);
-- แดง 2 ขึ้นไป: Poomsae 1–10 แยกรายท่า + ท่าสายดำ (จำนวนท่า = ระดับดั้งที่จะขึ้น) + ท่าเตะ 1–3 + รุกรับ
insert into public.exam_topics (from_rank, name, sort_order)
  select r, 'Poomsae ท่าที่ ' || p, p from generate_series(10, 19) r, generate_series(1, 10) p;
insert into public.exam_topics (from_rank, name, sort_order)
  select r, 'ท่าสายดำ ท่าที่ ' || k, 10 + k from generate_series(10, 19) r, generate_series(1, 10) k where k <= r - 9;
insert into public.exam_topics (from_rank, name, sort_order)
  select r, 'ท่าเตะ ' || k, 30 + k from generate_series(10, 19) r, generate_series(1, 3) k;
insert into public.exam_topics (from_rank, name, sort_order)
  select r, 'รุกรับ', 40 from generate_series(10, 19) r;

insert into public.uniform_sizes (size, label, height_min, height_max, collar) values
  ('90', '00000', 85, 94, 'คอดำ-แดง (เยาวชน)'), ('100', '0000', 95, 104, 'คอดำ-แดง (เยาวชน)'),
  ('110', '000', 105, 114, 'คอดำ-แดง (เยาวชน)'), ('120', '00', 115, 124, 'คอดำ-แดง (เยาวชน)'),
  ('130', '0', 125, 134, 'คอดำ-แดง (เยาวชน)'), ('140', '1', 135, 144, 'คอดำ-แดง (เยาวชน)'),
  ('150', '2', 145, 154, 'คอดำ-แดง (เยาวชน)'), ('160', '3', 155, 164, 'คอดำ (บุคคลทั่วไป)'),
  ('170', '4', 165, 174, 'คอดำ (บุคคลทั่วไป)'), ('180', '5', 175, 184, 'คอดำ (บุคคลทั่วไป)'),
  ('190', '6', 185, 194, 'คอดำ (บุคคลทั่วไป)');

insert into public.package_templates (branch_id, name, price, sessions, duration_days, sort_order) values
  (null, '4 ครั้ง / 30 วัน', 1800, 4, 30, 1),
  (null, '8 ครั้ง / 30 วัน', 2500, 8, 30, 2),
  (null, '12 ครั้ง / 30 วัน', 3200, 12, 30, 3),
  (null, 'ไม่จำกัด / 30 วัน', 3500, null, 30, 4);
