import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types";

/**
 * Loads the authenticated user's profile row from public.users.
 * Redirects to /login if there is no session or no profile.
 */
export async function getCurrentUser(): Promise<AppUser> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    // Authenticated in Supabase Auth but no profile row provisioned yet.
    redirect("/login?error=no_profile");
  }

  return profile as AppUser;
}

/** Returns the default landing path for a role. */
export function homePathForRole(role: AppUser["role"]): string {
  switch (role) {
    case "management":
      return "/management";
    case "pm":
      return "/pm";
    case "executive":
    default:
      return "/executive";
  }
}
