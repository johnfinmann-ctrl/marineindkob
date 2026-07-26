"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMembership } from "@/components/MembershipContext";
import { Card, Pill, PrimaryButton, OutlineButton, SectionTitle } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";

interface MemberRow {
  id: string;
  user_id: string;
  active: boolean;
  roles: { code: string; name: string } | null;
  profiles: { full_name: string } | null;
}

interface AuditRow {
  id: string;
  action: string;
  table_name: string;
  created_at: string;
  user_id: string | null;
}

export default function AdminPage() {
  const membership = useMembership();

  if (membership.role !== "administrator") {
    return (
      <Card>
        <p className="text-sm text-[#4a5a63]">
          Denne side er kun tilgængelig for administratorer. Adgangen er tjekket både her og i
          databasen (Row Level Security), så en indkøber kan ikke omgå dette ved at kalde API'et
          direkte.
        </p>
      </Card>
    );
  }

  return <AdminContent />;
}

function AdminContent() {
  const membership = useMembership();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [auditLog, setAuditLog] = useState<AuditRow[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", role: "indkober" });
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: memberRows } = await supabase
      .from("organization_members")
      .select("id, user_id, active, roles(code, name), profiles(full_name)")
      .eq("organization_id", membership.organizationId);
    setMembers((memberRows ?? []) as unknown as MemberRow[]);

    const { data: audit } = await supabase
      .from("audit_log")
      .select("id, action, table_name, created_at, user_id")
      .eq("organization_id", membership.organizationId)
      .order("created_at", { ascending: false })
      .limit(20);
    setAuditLog(audit ?? []);
  }, [membership.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(member: MemberRow) {
    if (!member.active) return; // genaktivering håndteres ikke i Fase 3
    if (!confirm("Vil du deaktivere denne bruger?")) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("deactivate_member", { p_member_id: member.id });
    if (error) alert(error.message);
    load();
  }

  async function changeRole(member: MemberRow, role: "indkober" | "administrator") {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("set_member_role", { p_member_id: member.id, p_role_code: role });
    if (error) alert(error.message);
    load();
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteStatus("Sender invitation…");
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteForm)
    });
    const data = await res.json();
    if (!res.ok) {
      setInviteStatus(data.error ?? "Kunne ikke invitere brugeren.");
      return;
    }
    setInviteStatus("Invitation sendt.");
    setInviteForm({ email: "", full_name: "", role: "indkober" });
    load();
  }

  async function resetDemo() {
    if (!confirm("Al demodata nulstilles til udgangspunktet. Fortsæt?")) return;
    alert(
      "Kør 'npm run seed' fra en server med adgang til SUPABASE_SERVICE_ROLE_KEY for at nulstille demodata — se README, afsnit 'Nulstil demonstrationsdata'."
    );
  }

  return (
    <div>
      <SectionTitle>Brugere &amp; roller</SectionTitle>
      <Card>
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between py-2 border-b border-sand last:border-0">
            <div>
              <b>{m.profiles?.full_name ?? "Ukendt"}</b>
              <div className="text-xs text-[#8A8A8A]">
                {m.roles?.name ?? "Indkøber"} {!m.active && "· Deaktiveret"}
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={m.roles?.code ?? "indkober"}
                onChange={(e) => changeRole(m, e.target.value as "indkober" | "administrator")}
                className="text-sm border border-[#DCD3C0] rounded-lg px-2 py-1"
              >
                <option value="indkober">Indkøber</option>
                <option value="administrator">Administrator</option>
              </select>
              <OutlineButton onClick={() => toggleActive(m)} disabled={!m.active}>
                Deaktivér
              </OutlineButton>
            </div>
          </div>
        ))}
      </Card>

      <SectionTitle>Invitér ny bruger</SectionTitle>
      <form onSubmit={handleInvite} className="card">
        <div className="flex gap-2.5 mb-3">
          <input
            required
            placeholder="Navn"
            value={inviteForm.full_name}
            onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))}
            className="flex-1 border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          />
          <input
            required
            type="email"
            placeholder="E-mail"
            value={inviteForm.email}
            onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
            className="flex-1 border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          />
        </div>
        <select
          value={inviteForm.role}
          onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
          className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5 mb-3"
        >
          <option value="indkober">Indkøber</option>
          <option value="administrator">Administrator</option>
        </select>
        {inviteStatus && <p className="text-sm text-[#4a5a63] mb-2">{inviteStatus}</p>}
        <PrimaryButton type="submit" className="w-full">
          Send invitation
        </PrimaryButton>
      </form>

      <SectionTitle>Ændringslog</SectionTitle>
      <Card>
        {auditLog.length === 0 && <p className="text-sm text-[#8A8A8A]">Ingen registrerede ændringer endnu.</p>}
        {auditLog.map((a) => (
          <div key={a.id} className="text-xs text-[#4a5a63] py-1.5 border-b border-sand last:border-0">
            <b className="text-navy">{a.action}</b> ({a.table_name}){" "}
            <span className="float-right text-[#8A8A8A]">
              {new Date(a.created_at).toLocaleString("da-DK")}
            </span>
          </div>
        ))}
      </Card>

      <SectionTitle>Demonstrationsdata</SectionTitle>
      <Card>
        <p className="text-sm text-[#4a5a63] mb-3">
          Nulstil al demodata til udgangspunktet — nyttigt før en ny fremvisning. Organisationen og
          brugerne slettes ikke.
        </p>
        <OutlineButton className="!border-red !text-red w-full" onClick={resetDemo}>
          Nulstil demonstrationsdata
        </OutlineButton>
      </Card>
    </div>
  );
}
