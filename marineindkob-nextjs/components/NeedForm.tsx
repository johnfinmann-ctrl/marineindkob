"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMembership } from "@/components/MembershipContext";
import { PrimaryButton } from "@/components/ui";
import { shoppingNeedSchema } from "@/lib/validation/schemas";

interface ProductOption {
  id: string;
  name: string;
  icon: string | null;
}

export function NeedForm({ needId }: { needId?: string }) {
  const membership = useMembership();
  const router = useRouter();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [form, setForm] = useState({
    product_id: "",
    current_stock: 0,
    min_stock: 0,
    typical_use: 1,
    need_by_date: "",
    priority: "Middel" as "Høj" | "Middel" | "Lav",
    comment: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowserClient();
      const { data: productList } = await supabase
        .from("products")
        .select("id, name, icon")
        .eq("organization_id", membership.organizationId)
        .eq("active", true)
        .order("name");
      setProducts(productList ?? []);

      if (needId) {
        const { data: need } = await supabase.from("shopping_needs").select("*").eq("id", needId).single();
        if (need) {
          setForm({
            product_id: need.product_id,
            current_stock: Number(need.current_stock),
            min_stock: Number(need.min_stock),
            typical_use: Number(need.typical_use),
            need_by_date: need.need_by_date ?? "",
            priority: need.priority,
            comment: need.comment ?? ""
          });
        }
      }
    }
    load();
  }, [membership.organizationId, needId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = shoppingNeedSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Udfyld felterne korrekt.");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    const status = form.current_stock <= form.min_stock * 0.6 ? "Kritisk" : "Snart";

    const payload = {
      organization_id: membership.organizationId,
      product_id: form.product_id,
      current_stock: form.current_stock,
      min_stock: form.min_stock,
      typical_use: form.typical_use,
      need_by_date: form.need_by_date || null,
      priority: form.priority,
      comment: form.comment || null,
      status,
      updated_by: membership.userId
    };

    const result = needId
      ? await supabase.from("shopping_needs").update(payload).eq("id", needId)
      : await supabase.from("shopping_needs").insert({ ...payload, created_by: membership.userId });

    setSaving(false);
    if (result.error) {
      setError("Kunne ikke gemme. Prøv igen.");
      return;
    }
    router.push("/mangler");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <Field label="Produkt">
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
      </Field>

      <div className="flex gap-2.5">
        <Field label="Nuværende antal">
          <input
            type="number"
            min={0}
            value={form.current_stock}
            onChange={(e) => setForm((f) => ({ ...f, current_stock: Number(e.target.value) }))}
            className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          />
        </Field>
        <Field label="Minimumslager">
          <input
            type="number"
            min={0}
            value={form.min_stock}
            onChange={(e) => setForm((f) => ({ ...f, min_stock: Number(e.target.value) }))}
            className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          />
        </Field>
      </div>

      <div className="flex gap-2.5">
        <Field label="Typisk forbrug pr. uge">
          <input
            type="number"
            min={0}
            step={0.5}
            value={form.typical_use}
            onChange={(e) => setForm((f) => ({ ...f, typical_use: Number(e.target.value) }))}
            className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          />
        </Field>
        <Field label="Skal bruges senest">
          <input
            type="date"
            value={form.need_by_date}
            onChange={(e) => setForm((f) => ({ ...f, need_by_date: e.target.value }))}
            className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          />
        </Field>
      </div>

      <Field label="Prioritet">
        <select
          value={form.priority}
          onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as typeof form.priority }))}
          className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5"
        >
          <option>Høj</option>
          <option>Middel</option>
          <option>Lav</option>
        </select>
      </Field>

      <Field label="Eventuel kommentar">
        <textarea
          value={form.comment}
          onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
          placeholder="Fx mærke, allergi eller anledning"
          className="w-full border border-[#DCD3C0] rounded-xl px-3 py-2.5 min-h-[70px]"
        />
      </Field>

      {error && <p className="text-sm text-red mb-3">{error}</p>}

      <PrimaryButton type="submit" disabled={saving} className="w-full">
        {saving ? "Gemmer…" : "Tilføj til behov"}
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
