"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrgRealtime } from "@/lib/supabase/useRealtimeTable";
import { useMembership } from "@/components/MembershipContext";
import { Card, Pill, EmptyState, GoldButton, OutlineButton } from "@/components/ui";

interface NeedRow {
  id: string;
  product_id: string;
  current_stock: number;
  min_stock: number;
  typical_use: number;
  need_by_date: string | null;
  priority: string;
  comment: string | null;
  status: "Kritisk" | "Snart" | "Tilbud";
  products: { name: string; icon: string | null; unit_id: string | null } | null;
}

const FILTERS = ["Alle", "Kritiske", "Snart", "På tilbud"] as const;

export default function ManglerPage() {
  const membership = useMembership();
  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Alle");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("shopping_needs")
      .select("id, product_id, current_stock, min_stock, typical_use, need_by_date, priority, comment, status, products(name, icon, unit_id)")
      .eq("organization_id", membership.organizationId)
      .is("deleted_at", null)
      .order("status", { ascending: true });
    if (!error && data) setNeeds(data as unknown as NeedRow[]);
    setLoading(false);
  }, [membership.organizationId]);

  useEffect(() => {
    load();
  }, [load]);
  useOrgRealtime("shopping_needs", membership.organizationId, () => load());

  async function handleDelete(id: string) {
    if (!confirm("Vil du slette denne mangel fra listen?")) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.from("shopping_needs").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  }

  const filtered = needs.filter((n) => {
    if (filter === "Alle") return true;
    if (filter === "Kritiske") return n.status === "Kritisk";
    if (filter === "Snart") return n.status === "Snart";
    if (filter === "På tilbud") return n.status === "Tilbud";
    return true;
  });

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold border-[1.5px] ${
              filter === f ? "bg-navy border-navy text-white" : "bg-white border-[#DCD3C0] text-navy"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <EmptyState icon="📋" title="Ingen varer i denne visning" subtitle="Prøv et andet filter, eller registrér en ny mangel." />
      )}

      {filtered.map((n) => (
        <Card key={n.id} className={`border-l-[5px] ${borderColor(n.status)}`}>
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-serif text-[16.5px] text-navy m-0">
              {n.products?.icon} {n.products?.name}
            </h3>
          </div>
          <Pill color={n.status === "Kritisk" ? "red" : n.status === "Snart" ? "yellow" : "blue"}>
            {n.status === "Kritisk" ? "Kritisk" : n.status === "Snart" ? "Bør snart købes" : "På tilbud"}
          </Pill>
          <div className="grid grid-cols-2 gap-x-3.5 gap-y-1.5 text-[13px] mt-2.5 mb-2.5">
            <div className="text-[#8A8A8A]">På lager</div>
            <div className="font-bold">{n.current_stock}</div>
            <div className="text-[#8A8A8A]">Minimum</div>
            <div className="font-bold">{n.min_stock}</div>
            <div className="text-[#8A8A8A]">Skal bruges</div>
            <div className="font-bold">
              {n.need_by_date ? new Date(n.need_by_date).toLocaleDateString("da-DK") : "—"}
            </div>
          </div>
          {n.comment && <div className="text-xs text-[#8A8A8A] mb-2">📝 {n.comment}</div>}
          <div className="flex gap-2.5 mt-2">
            <Link href={`/mangler/${n.id}`}>
              <OutlineButton>Ret</OutlineButton>
            </Link>
            <Link href="/forslag">
              <OutlineButton>Se forslag</OutlineButton>
            </Link>
            <OutlineButton className="!border-red !text-red" onClick={() => handleDelete(n.id)}>
              Slet
            </OutlineButton>
          </div>
        </Card>
      ))}

      <Link href="/mangler/ny" className="sticky bottom-2 block mt-1">
        <GoldButton className="w-full">＋ Registrér mangel</GoldButton>
      </Link>
    </div>
  );
}

function borderColor(status: string) {
  if (status === "Kritisk") return "border-l-red";
  if (status === "Snart") return "border-l-yellow";
  return "border-l-blue";
}
