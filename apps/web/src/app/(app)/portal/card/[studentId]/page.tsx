import { StudentCardNotFound, StudentCardPrint } from "@/features/card/components/student-card-print";
import { getCardStudent } from "@/features/card/queries";
import { requireRole } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Card for a parent: RLS (students_customer) only returns students linked to this account. */
export default async function PortalStudentCardPage({ params }: { params: Promise<{ studentId: string }> }) {
  await requireRole("customer");
  const { studentId } = await params;
  const student = UUID.test(studentId) ? await getCardStudent(studentId) : null;
  if (!student) return <StudentCardNotFound backHref="/portal" />;
  return <StudentCardPrint student={student} backHref="/portal" />;
}
