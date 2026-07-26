"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMembership } from "@/components/MembershipContext";
import { Card, Pill, GoldButton, PrimaryButton } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";
import { eventSchema } from "@/lib/validation/schemas";

interface EventRow {
  id: string;
  name: string;
  date: string;
  guests: number;
  menu: string | null;
  budget: number;
}

export default function ArrangementerPage() {
  const membership = useMembership();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", date: "2026-09-01", guests: "20", menu: "", budget: "1000" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("events")
      .select("id, name, date, guests, menu, budget")
      .eq("organization_id", membership.organizationId)
      .is("deleted_at", null)
      .order("date", { ascending: true });
    setEvents(data ?? []);
  }, [membership.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = eventSchema.safeParse({
      name: form.name,
      date: form.date,
      guests: Number(form.guests),
      menu: form.menu,
      budget: Number(form.budget)
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Udfyld felterne korrekt.");
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error: insertError } = await supabase.from("events").insert({
      organization_id: membership.organizationId,
      ...parsed.data,
      created_by: membership.userId,
      updated_by: membership.userId
    });
    setSaving(false);
    if (insertError) {
      setError("Kunne ikke oprette arrangementet.");
      return;
    }
    setShowForm(false);
    setForm({ name: "", date: "2026-09-01", guests: "20", menu: "", budget: "1000" });
    load();
  }

  return (
    <div>
      {events.map((e) => (
        <Card key={e.id}>
          <div className="flex justify-between items-start">
            <h3 className="font-serif text-navy m-0">🎉 {e.name}</h3>
            <Pill color="blue">{new Date(e.date).toLocaleDateString("da-DK")}</Pill>
          </div>
          <div className="grid grid-cols-2 gap-x-3.5 gap-y-1.5 text-[13px] mt-2.5 mb-1">
            <div className="text-[#8A8A8A]">Deltagere</div>
            <div className="font-bold">{e.guests}</div>
            <div className="text-[#8A8A8A]">Budget</div>
            <div className="font-bold">{formatCurrency(Number(e.budget))}</div>
          </div>
          {e.menu && <div className="text-xs text-[#8A8A8A]">{e.menu}</div>}
        </Card>
      ))}

      {showForm ? (
        <form onSubmit={handleCreate} className="card">
          <F label="Navn">
            <input
              value={form.name}
              onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))}
              className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
              required
            />
          </F>
          <div className="flex gap-2.5">
            <F label="Dato">
              <input
                type="date"
                value={form.date}
                onChange={(ev) => setForm((f) => ({ ...f, date: ev.target.value }))}
                className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
              />
            </F>
            <F label="Deltagere">
              <input
                type="number"
                value={form.guests}
                onChange={(ev) => setForm((f) => ({ ...f, guests: ev.target.value }))}
                className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
              />
            </F>
          </div>
          <F label="Menu">
            <textarea
              value={form.menu}
              onChange={(ev) => setForm((f) => ({ ...f, menu: ev.target.value }))}
              className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5 min-h-[60px]"
            />
          </F>
          <F label="Budget (kr.)">
            <input
              type="number"
              value={form.budget}
              onChange={(ev) => setForm((f) => ({ ...f, budget: ev.target.value }))}
              className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
            />
          </F>
          {error && <p className="text-sm text-red mb-3">{error}</p>}
          <PrimaryButton type="submit" disabled={saving} className="w-full">
            {saving ? "Gemmer…" : "Opret arrangement"}
          </PrimaryButton>
        </form>
      ) : (
        <GoldButton className="w-full" onClick={() => setShowForm(true)}>
          ＋ Opret arrangement
        </GoldButton>
      )}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex-1">
      <label className="block text-xs font-bold text-navy mb-1">{label}</label>
      {children}
    </div>
  );
}
