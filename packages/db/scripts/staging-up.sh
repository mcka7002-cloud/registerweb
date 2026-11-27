#!/usr/bin/env bash
# สร้าง Supabase staging ใหม่ (Free, สิงคโปร์) แล้วรัน migration ทั้งหมด
# ใช้เมื่อ staging เดิมหยุดนานเกินจนกู้คืนไม่ได้ (ดู docs/deploy-th.md หัวข้อ "staging เปิด-ปิด")
#
# ต้องตั้งตัวแปรก่อนรัน (ห้ามเขียนลงไฟล์ใน repo):
#   SUPABASE_ACCESS_TOKEN   token ของบัญชีผู้พัฒนา (Supabase → Account → Access Tokens)
#   SUPABASE_ORG_ID         รหัส organization ของผู้พัฒนา (supabase orgs list)
#   STAGING_DB_PASSWORD     รหัสผ่านฐานข้อมูลใหม่ (สุ่มยาว ๆ แล้วเก็บในตัวจัดการรหัสผ่าน)
#
# รัน:  bash packages/db/scripts/staging-up.sh
set -euo pipefail
cd "$(dirname "$0")/.."

for v in SUPABASE_ACCESS_TOKEN SUPABASE_ORG_ID STAGING_DB_PASSWORD; do
  if [ -z "${!v:-}" ]; then echo "ตั้งค่า $v ก่อน (ดูหัวไฟล์)"; exit 1; fi
done

NAME="registerweb-staging-$(date +%Y%m%d)"
echo "1/4 สร้างโปรเจกต์ $NAME (ap-southeast-1)"
REF=$(npx supabase projects create "$NAME" --org-id "$SUPABASE_ORG_ID" --db-password "$STAGING_DB_PASSWORD" \
  --region ap-southeast-1 -o json | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("id") or d.get("ref"))')
echo "    project ref: $REF"

echo "2/4 รอให้โปรเจกต์พร้อม (ปกติ 1–3 นาที)"
for i in $(seq 1 60); do
  STATUS=$(curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" "https://api.supabase.com/v1/projects/$REF" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))')
  [ "$STATUS" = "ACTIVE_HEALTHY" ] && break
  sleep 10
done
[ "$STATUS" = "ACTIVE_HEALTHY" ] || { echo "โปรเจกต์ยังไม่พร้อม (status: $STATUS) ลองรันข้อ 3 เองภายหลัง"; exit 1; }

echo "3/4 รัน migration"
npx supabase link --project-ref "$REF" --password "$STAGING_DB_PASSWORD"
npx supabase db push --linked --password "$STAGING_DB_PASSWORD"

echo "4/4 เสร็จ · ขั้นต่อไป (ทำเอง):"
cat <<EOF
  ก. คีย์สำหรับเบราว์เซอร์: npx supabase projects api-keys --project-ref $REF  (ใช้ publishable หรือ anon เท่านั้น)
  ข. ตั้งค่า GitHub environment "staging":
       gh secret   set SUPABASE_PROJECT_REF --env staging --body $REF
       gh secret   set SUPABASE_DB_PASSWORD --env staging        (วางรหัสผ่านเมื่อถูกถาม)
       gh variable set NEXT_PUBLIC_SUPABASE_URL --env staging --body https://$REF.supabase.co
       gh variable set NEXT_PUBLIC_SUPABASE_ANON_KEY --env staging --body <publishable key จากข้อ ก.>
  ค. Supabase → Authentication: Site URL, Redirect URL และ Google provider ตาม docs/deploy-th.md ข้อ 1.3
     และเพิ่ม https://$REF.supabase.co/auth/v1/callback ใน Google OAuth client ของ staging
  ง. รัน Deploy (staging) ใน GitHub Actions แล้วให้ admin / ครู / ผู้ปกครองทดสอบเข้าสู่ระบบด้วย Google 1 ครั้ง
  จ. แก้อีเมลใน supabase/demo/cloud_demo.sql แล้ววางใน SQL Editor ของโปรเจกต์ใหม่ (ห้ามรัน seed.sql บน cloud)
EOF
