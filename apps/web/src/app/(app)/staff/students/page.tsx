import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { searchStudents } from "@/features/students/queries";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { formatThaiDate, todayInBangkok } from "@/lib/utils";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole(...STAFF_ROLES);
  const { q = "" } = await searchParams;
  const [t, tc, students] = await Promise.all([getTranslations("students"), getTranslations(), searchStudents(q)]);
  const today = todayInBangkok();

  return (
    <>
      <PageHeader title={t("list.title")} />
      <form className="mb-4 flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder={t("list.search")} className="max-w-sm" autoFocus />
        <Button type="submit" variant="outline">
          {tc("actions.search")}
        </Button>
      </form>
      {students.length === 0 ? (
        <EmptyState title={t("list.empty")} />
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fields.code")}</TableHead>
                  <TableHead>{t("list.name")}</TableHead>
                  <TableHead>{t("list.branch")}</TableHead>
                  <TableHead>{t("list.membership")}</TableHead>
                  <TableHead>{t("list.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono">
                      <Link href={`/staff/students/${s.id}`} className="underline-offset-4 hover:underline">
                        {s.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/staff/students/${s.id}`} className="font-medium underline-offset-4 hover:underline">
                        {s.first_name} {s.last_name}
                      </Link>
                      {s.nickname ? <span className="text-muted-foreground"> ({s.nickname})</span> : null}
                    </TableCell>
                    <TableCell>{s.branch}</TableCell>
                    <TableCell className={s.membership_expires_on && s.membership_expires_on < today ? "text-destructive" : undefined}>
                      {s.membership_expires_on ? formatThaiDate(s.membership_expires_on) : "–"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "secondary" : "outline"}>{t(`detail.statuses.${s.status}`)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {students.length === 50 ? <p className="mt-2 text-xs text-muted-foreground">{t("list.limit")}</p> : null}
    </>
  );
}
