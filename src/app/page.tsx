import { redirect } from "next/navigation";
import { getCurrentUser, homePathForRole } from "@/lib/auth";

/** Root route: send each user to their role's dashboard. */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(homePathForRole(user.role));
}
