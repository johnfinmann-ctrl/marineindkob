import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { inviteUserSchema } from "@/lib/validation/schemas";

/**
 * Inviterer en ny bruger. Kører udelukkende server-side, så
 * SUPABASE_SERVICE_ROLE_KEY aldrig når klientens browser.
 * Dobbelttjekker selv, at den kaldende bruger er administrator —
 * "Administratorrettigheder skal verificeres i databasen, ikke kun i
 * brugerfladen" (Fase 3-oplægget, afsnit 13).
 */
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = inviteUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ugyldige data." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Ingen organisation fundet." }, { status: 403 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin", { check_org_id: membership.organization_id });
  if (!isAdmin) {
    return NextResponse.json({ error: "Kun en administrator kan invitere brugere." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email);
  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  const newUserId = created.user.id;
  await admin.from("profiles").upsert({
    id: newUserId,
    full_name: parsed.data.full_name,
    initials: parsed.data.full_name.slice(0, 1).toUpperCase()
  });

  const { data: role } = await admin.from("roles").select("id").eq("code", parsed.data.role).single();
  await admin.from("organization_members").upsert(
    {
      organization_id: membership.organization_id,
      user_id: newUserId,
      role_id: role!.id,
      active: true,
      invited_by: user.id
    },
    { onConflict: "organization_id,user_id" }
  );

  return NextResponse.json({ ok: true });
}
