import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Card } from "@/components/Card";
import { AvatarUploader, NameForm, PasswordForm } from "@/components/AccountForms";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const me = await getCurrentUser();
  const supabase = createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", me.org_id)
    .single();

  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardHeader user={me} orgName={org?.name} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">My account</h1>
          <p className="text-sm text-slate-500">Update your photo, name, and password.</p>
        </div>

        <Card title="Profile photo">
          <AvatarUploader userId={me.id} name={me.name} url={me.avatar_url} />
        </Card>

        <Card title="Name">
          <NameForm userId={me.id} name={me.name} />
        </Card>

        <Card title="Password">
          <PasswordForm />
        </Card>

        <Card title="Account">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Email</dt>
              <dd className="text-slate-800">{me.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Role</dt>
              <dd className="capitalize text-slate-800">{me.role}</dd>
            </div>
          </dl>
        </Card>
      </main>
    </div>
  );
}
