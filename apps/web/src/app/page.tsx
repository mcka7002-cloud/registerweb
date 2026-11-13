import { redirect } from "next/navigation";
import { getMe, homePathFor } from "@/lib/auth";

// หน้าแรก: ส่งไปหน้าของแต่ละ role (ไม่มีโปรไฟล์ → /login)
export default async function Home() {
  const me = await getMe();
  redirect(me ? homePathFor(me.role) : "/login");
}
