// หน้าแรกเว็บสาธารณะ (งานข้อ 53) · อ่านข้อมูลด้วย anon key ผ่าน policy public เท่านั้น
// สาขา (branches), ราคา (package_templates), โพสต์ที่เผยแพร่ (posts) · ชื่อ/รูปผู้เรียนแสดงเฉพาะคนที่ยินยอม
/** Privacy notice lives in apps/web; NEXT_PUBLIC_APP_URL, else the origin of NEXT_PUBLIC_REGISTER_URL. */
function privacyUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_REGISTER_URL || "http://localhost:3000";
  try {
    return new URL("/privacy", base).toString();
  } catch {
    return "/privacy";
  }
}

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl font-semibold">โรงเรียนเทควันโด</h1>
      <p className="mt-2 text-neutral-600">ข่าวสาร · ผลงาน · สาขา · ราคาแพ็กเกจ</p>
      <footer className="mt-16 border-t pt-4 text-sm text-neutral-600">
        <a href={privacyUrl()} className="underline underline-offset-4">
          ประกาศความเป็นส่วนตัว
        </a>
      </footer>
    </main>
  );
}
