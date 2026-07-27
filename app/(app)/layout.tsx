import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/auth/membership";
import { MembershipProvider } from "@/components/MembershipContext";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);

  if (!membership) {
    redirect("/login?error=no_membership");
  }

  return (
    <MembershipProvider membership={membership}>
      <AppShell>{children}</AppShell>
    </MembershipProvider>
  );
}
