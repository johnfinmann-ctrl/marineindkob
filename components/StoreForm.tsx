"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMembership } from "@/components/MembershipContext";
import { PrimaryButton } from "@/components/ui";
import { storeSchema, STORE_TYPES } from "@/lib/validation/schemas";

const TYPE_LABELS: Record<(typeof STORE_TYPES)[number], string> = {
  supermarked: "Supermarked",
  discount: "Discount",
  engros: "Engros",
  specialbutik: "Specialbutik",
  onlinebutik: "Onlinebutik"
};

export function StoreForm({ storeId }: { storeId?: string }) {
  const membership = useMembership();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    type: "supermarked" as (typeof STORE_TYPES)[number],
    address: "",
    postal_code: "",
    city: "",
    distance_km: "",
    delivery: false,
    delivery_price: "0",
    min_order: "0",
    hours: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(storeId));

  useEffect(() => {
    if (!storeId) return;
    async function load() {
      const supabase = createSupabaseBrowserClient();
      const { data: store, error: loadError } = await supabase.from("stores").select("*").eq("id", storeId).single();
      if (loadError || !store) {
        setError("Kunne ikke hente butikken.");
        setLoading(false);
        return;
      }
      setForm({
        name: store.name ?? "",
        type: (store.type ?? "supermarked") as (typeof STORE_TYPES)[number],
        address: store.address ?? "",
        postal_code: store.postal_code ?? "",
        city: store.city ?? "",
        distance_km: store.distance_km != null ? String(store.distance_km) : "",
        delivery: Boolean(store.delivery),
        delivery_price: String(store.delivery_price ?? 0),
        min_order: String(store.min_order ?? 0),
        hours: store.hours ?? ""
      });
      setLoading(false);
    }
    load();
  }, [storeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = storeSchema.safeParse({
      name: form.name,
      type: form.type,
      address: form.address,
      postal_code: form.postal_code,
      city: form.city,
      distance_km: form.distance_km === "" ? undefined : Number(form.distance_km),
      delivery: form.delivery,
      delivery_price: Number(form.delivery_price),
      min_order: Number(form.min_order),
      hours: form.hours
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Udfyld felterne korrekt.");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const payload = {
      name: parsed.data.name,
      type: parsed.data.type,
      address: parsed.data.address || null,
      postal_code: parsed.data.postal_code || null,
      city: parsed.data.city || null,
      distance_km: parsed.data.distance_km ?? null,
      delivery: parsed.data.delivery,
      delivery_price: parsed.data.delivery_price,
      min_order: parsed.data.min_order,
      hours: parsed.data.hours || null,
      updated_by: membership.userId
    };

    const result = storeId
      ? await supabase.from("stores").update(payload).eq("id", storeId)
      : await supabase
          .from("stores")
          .insert({ ...payload, organization_id: membership.organizationId, created_by: membership.userId });

    setSaving(false);
    if (result.error) {
      setError(
        result.error.code === "42501"
          ? "Kun administrator kan oprette eller redigere butikker."
          : `Kunne ikke gemme butikken: ${result.error.message}`
      );
      return;
    }
    router.push("/admin/butikker");
    router.refresh();
  }

  if (loading) return null;

  return (
    <form onSubmit={handleSubmit} className="card">
      <Field label="Navn">
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
        />
      </Field>

      <Field label="Butikstype">
        <select
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as (typeof STORE_TYPES)[number] }))}
          className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
        >
          {STORE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Adresse">
        <input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          placeholder="Fx Havnevej 12"
          className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
        />
      </Field>

      <div className="flex gap-2.5">
        <Field label="Postnummer">
          <input
            value={form.postal_code}
            onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
            placeholder="8400"
            inputMode="numeric"
            className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          />
        </Field>
        <Field label="By">
          <input
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="Ebeltoft"
            className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          />
        </Field>
      </div>

      <Field label="Afstand fra Ebeltoft Marineforening (km)">
        <input
          type="number"
          min={0}
          step={0.1}
          value={form.distance_km}
          onChange={(e) => setForm((f) => ({ ...f, distance_km: e.target.value }))}
          placeholder="Fx 2.4 — lad stå tomt for en netbutik"
          className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
        />
      </Field>

      <Field label="Åbningstider">
        <input
          value={form.hours}
          onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
          placeholder="Fx 08–20"
          className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
        />
      </Field>

      <div className="mb-3.5 flex items-center gap-2.5">
        <input
          id="delivery"
          type="checkbox"
          checked={form.delivery}
          onChange={(e) => setForm((f) => ({ ...f, delivery: e.target.checked }))}
          className="w-5 h-5"
        />
        <label htmlFor="delivery" className="text-sm font-bold text-navy">
          Butikken tilbyder levering
        </label>
      </div>

      <div className="flex gap-2.5">
        <Field label="Leveringspris (kr.)">
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.delivery_price}
            onChange={(e) => setForm((f) => ({ ...f, delivery_price: e.target.value }))}
            className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          />
        </Field>
        <Field label="Minimumskøb (kr.)">
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.min_order}
            onChange={(e) => setForm((f) => ({ ...f, min_order: e.target.value }))}
            className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          />
        </Field>
      </div>

      {error && <p className="text-sm text-red mb-3">{error}</p>}
      <PrimaryButton type="submit" disabled={saving} className="w-full">
        {saving ? "Gemmer…" : storeId ? "Gem ændringer" : "Opret butik"}
      </PrimaryButton>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex-1">
      <label className="block text-xs font-bold text-navy mb-1">{label}</label>
      {children}
    </div>
  );
}
