// หน้าแรกเว็บสาธารณะ (งานข้อ 53) · อ่านข้อมูลด้วย anon key ผ่าน policy public เท่านั้น
// สาขา (branches), ราคา (package_templates), โพสต์ที่เผยแพร่ (posts) · ชื่อ/รูปผู้เรียนแสดงเฉพาะคนที่ยินยอม
export default function Home() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl font-semibold">โรงเรียนเทควันโด</h1>
      <p className="mt-2 text-neutral-600">ข่าวสาร · ผลงาน · สาขา · ราคาแพ็กเกจ</p>
    </main>
  );
}
