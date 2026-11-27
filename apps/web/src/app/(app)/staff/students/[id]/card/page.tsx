import { StudentCardNotFound, StudentCardPrint } from "@/features/card/components/student-card-print";
import { getCardStudent } from "@/features/card/queries";
import { requireRole, STAFF_ROLES } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Card for staff: RLS (students_staff) only returns students of the staff member's branches. */
export default async function StaffStudentCardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const student = UUID.test(id) ? await getCardStudent(id) : null;
  if (!student) return <StudentCardNotFound backHref="/staff/students" />;
  return <StudentCardPrint student={student} backHref={`/staff/students/${student.id}`} />;
}
