-- purchase_options: the pending order now carries its lines and payment method, so the buy page
-- needs no second query (and every guardian linked to the student sees the same thing).
-- create or replace keeps the existing grants (authenticated only).

create or replace function public.purchase_options(p_student uuid) returns jsonb
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
    'pending_order', (select jsonb_build_object('id', o.id, 'total', o.total, 'created_at', o.created_at,
                                                'method', o.pay_method,
                                                'items', (select coalesce(jsonb_agg(jsonb_build_object(
                                                                   'description', i2.description, 'amount', i2.amount)
                                                                   order by i2.amount desc), '[]'::jsonb)
                                                            from public.order_items i2 where i2.order_id = o.id))
                        from public.orders o
                       where o.status = 'pending_review'
                         and exists (select 1 from public.order_items i where i.order_id = o.id and i.student_id = st.id)
                       order by o.created_at desc limit 1));
end $$;
