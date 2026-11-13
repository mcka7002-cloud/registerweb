import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserAccessDialog } from "@/features/admin/components/user-access-dialog";
import { listBranchOptions, listUsers } from "@/features/admin/queries";
import { requireRole } from "@/lib/auth";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole("admin");
  const { q = "" } = await searchParams;
  const [t, tc, users, branches] = await Promise.all([
    getTranslations("admin.users"),
    getTranslations(),
    listUsers(),
    listBranchOptions(),
  ]);
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? users.filter((u) => u.full_name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle))
    : users;
  const codeOf = (id: string) => branches.find((b) => b.id === id)?.code ?? "?";

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <form className="mb-4 flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder={t("search")} className="max-w-sm" />
        <Button type="submit" variant="outline">
          {tc("actions.search")}
        </Button>
      </form>
      {shown.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("branches")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.full_name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === "customer" ? "outline" : "secondary"}>{tc(`roles.${u.role}`)}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.branch_ids.length === 0 ? t("noBranches") : u.branch_ids.map(codeOf).join(", ")}
                    </TableCell>
                    <TableCell className="text-right">
                      <UserAccessDialog user={u} branches={branches} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
