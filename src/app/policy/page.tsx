import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/DashboardHeader";
import { PolicyReference } from "@/components/PolicyReference";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
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
      <main className="mx-auto max-w-4xl px-4 py-6">
        <PolicyReference />
      </main>
    </div>
  );
}
