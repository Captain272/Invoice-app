import { getSession } from "@/server/actions/auth-helper";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  const settings = await prisma.appSetting.findMany();
  const map: Record<string, string> = {};
  settings.forEach((s) => { map[s.key] = s.value; });

  return (
    <>
      <PageHeader title="Settings" description="Manage your profile and app-wide defaults." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Your profile</h2>
          <SettingsForm initialName={me?.name ?? ""} initialEmail={me?.email ?? ""} settings={map} />
        </CardContent></Card>
      </div>
    </>
  );
}
