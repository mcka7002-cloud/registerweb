import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { MyRegistrations } from "@/features/register/components/my-registrations";
import { RegistrationForm } from "@/features/register/components/registration-form";
import { listBranches, listMyRegistrations } from "@/features/register/queries";
import { requireRole } from "@/lib/auth";

export default async function RegisterPage() {
  const me = await requireRole();
  const t = await getTranslations("register");
  const [branches, mine] = await Promise.all([listBranches(), listMyRegistrations(me.id)]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <PageHeader title={t("title")} description={t("description")} />
        {branches.length === 0 ? <EmptyState title={t("noBranches")} /> : <RegistrationForm branches={branches} />}
      </div>
      <MyRegistrations items={mine} />
    </div>
  );
}
