import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoleCode } from "@/types/database";

export interface CurrentMembership {
  userId: string;
  organizationId: string;
  role: RoleCode;
  fullName: string;
  initials: string;
}

/**
 * Slår den aktuelle brugers organisation og rolle op. Version 1 antager
 * præcis én organisation pr. bruger (Ebeltoft Marineforening), men
 * forespørgslen understøtter uden ændringer, at en bruger senere kan være
 * medlem af flere organisationer.
 */
export async function getCurrentMembership(
  supabase: SupabaseClient
): Promise<CurrentMembership | null> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role_id, roles(code)")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, initials")
    .eq("id", user.id)
    .maybeSingle();

  const roleCode = ((membership as unknown as { roles: { code: RoleCode } | null }).roles?.code ??
    "indkober") as RoleCode;

  return {
    userId: user.id,
    organizationId: membership.organization_id,
    role: roleCode,
    fullName: profile?.full_name ?? user.email ?? "Ukendt bruger",
    initials: profile?.initials ?? "?"
  };
}
