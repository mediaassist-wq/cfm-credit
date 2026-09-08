import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { homePathForRole } from "@/lib/auth";
import type { AppUser } from "@/lib/types";

const ROLE_LABEL: Record<AppUser["role"], string> = {
  management: "Management",
  pm: "Project Manager",
  executive: "Executive",
};

export function DashboardHeader({ user, orgName }: { user: AppUser; orgName?: string }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Core Frame Media</p>
          <p className="text-xs text-slate-500">
            {orgName ? `${orgName} · ` : ""}Credit &amp; Tier Management
          </p>
        </div>
        <div className="flex items-center gap-4">
          <nav className="hidden items-center gap-3 text-sm text-slate-600 sm:flex">
            <Link href={homePathForRole(user.role)} className="hover:text-slate-900">
              Dashboard
            </Link>
            <Link href="/policy" className="hover:text-slate-900">
              Policy
            </Link>
          </nav>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-800">{user.name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
