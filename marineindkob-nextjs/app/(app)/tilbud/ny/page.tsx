"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMembership } from "@/components/MembershipContext";
import { PrimaryButton } from "@/components/ui";
import { offerSchema } from "@/lib/validation/schemas";
import { calculateOfferRating } from "@/lib/calculations";

export default function NyttilbudPage() {
  const membership = useMembership();
  const router = useRouter();
  const [products, setProducts] = useState<{ id: string; name: string; icon: string | null }[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    product_id: "",
    store_id: "",
    offer_price: "",
    normal_price: "",
    qty: "1",
    unit: "stk",
    start_date: "2026-07-26",
    end_date: "2026-08-02",
    notes: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowserClient();
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("products").select("id, name, icon").eq("organization_id", membership.organizationId).order("name"),
        supabase.from("stores").select("id, name").eq("organization_id", membership.organizationId).order("name")
      ]);
      setProducts(p ?? []);
      setStores(s ?? []);
    }
    load();
  }, [membership.organizationId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = offerSchema.safeParse({
      product_id: form.product_id,
      store_id: form.store_id,
      offer_price: Number(form.offer_price),
      normal_price: Number(form.normal_price),
      qty: Number(form.qty),
      unit: form.unit,
      start_date: form.start_date,
      end_date: form.end_date,
      notes: form.notes
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Udfyld felterne korrekt.");
      return;
    }

    setSaving(true);
    const rating = calculateOfferRating(parsed.data.offer_price, parsed.data.normal_price);
    const supabase = createSupabaseBrowserClient();
    const { error: insertError } = await supabase.from("offers").insert({
      organization_id: membership.organizationId,
      product_id: parsed.data.product_id,
      store_id: parsed.data.store_id,
      offer_price: parsed.data.offer_price,
      normal_price: parsed.data.normal_price,
      qty: parsed.data.qty,
      unit: parsed.data.unit,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      notes: parsed.data.notes || null,
      rating: rating.rating,
      rating_level: rating.level,
      created_by: membership.userId
    });
    setSaving(false);
    if (insertError) {
      setError("Kunne ikke gemme tilbuddet. Prøv igen.");
      return;
    }
    router.push("/tilbud");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <F label="Produkt">
        <select
          value={form.product_id}
          onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
          className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          required
        >
          <option value="">Vælg produkt…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>
      </F>
      <F label="Butik">
        <select
          value={form.store_id}
          onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))}
          className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          required
        >
          <option value="">Vælg butik…</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </F>
      <div className="flex gap-2.5">
        <F label="Tilbudspris (kr.)">
          <input
            type="number"
            step="0.05"
            value={form.offer_price}
            onChange={(e) => setForm((f) => ({ ...f, offer_price: e.target.value }))}
            className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
            required
          />
        </F>
        <F label="Normalpris (kr.)">
          <input
            type="number"
            step="0.05"
            value={form.normal_price}
            onChange={(e) => setForm((f) => ({ ...f, normal_price: e.target.value }))}
            className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
            required
          />
        </F>
      </div>
      <div className="flex gap-2.5">
        <F label="Startdato">
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          />
        </F>
        <F label="Slutdato">
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          />
        </F>
      </div>
      <F label="Noter">
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5 min-h-[60px]"
        />
      </F>
      <p className="text-xs text-[#8A8A8A] mb-3">
        Automatisk aflæsning af tilbudsaviser hører til en senere version. Kontrollér altid priser og mængder.
      </p>
      {error && <p className="text-sm text-red mb-3">{error}</p>}
      <PrimaryButton type="submit" disabled={saving} className="w-full">
        {saving ? "Gemmer…" : "Gem tilbud"}
      </PrimaryButton>
    </form>
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
