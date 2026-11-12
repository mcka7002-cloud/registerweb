// หน้า Kiosk เช็คชื่อ (งานข้อ 16, 56): PWA บน iPad + สแกนเนอร์ Bluetooth
// ส่วนเดียวที่ทำงานออฟไลน์ได้ · ส่งข้อมูลผ่าน rpc("record_checkin") พร้อม client_uuid
export default function KioskPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-xl">สแกนบัตรเพื่อเช็คชื่อ</p>
    </main>
  );
}
