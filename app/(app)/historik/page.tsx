"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMembership } from "@/components/MembershipContext";
import { Card, SectionTitle, OutlineButton } from "@/components/ui";
import { formatCurrency, formatDateDMY } from "@/lib/calculations";

interface PurchaseRow {
  id: string;
  purchased_at: string;
  total_price: number;
  saved_amount: number;
  stores: { name: string } | null;
  profiles?: { full_name: string } | null;
}

export default function HistorikPage() {
  const membership = useMembership();
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("purchases")
      .select("id, purchased_at, total_price, saved_amount, stores(name)")
      .eq("organization_id", membership.organizationId)
      .order("purchased_at", { ascending: false })
      .limit(20);
    setPurchases((data ?? []) as unknown as PurchaseRow[]);
  }, [membership.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    const rows = [
      ["Dato", "Butik", "Samlet pris", "Besparelse"],
      ...purchases.map((p) => [
        formatDateDMY(p.purchased_at.slice(0, 10)),
        p.stores?.name ?? "Flere butikker",
        String(p.total_price).replace(".", ","),
        String(p.saved_amount).replace(".", ",")
      ])
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "marineindkob-historik.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <SectionTitle>Seneste køb</SectionTitle>
      {purchases.length === 0 && <p className="text-sm text-[#8A8A8A]">Der er endnu ikke registreret nogen køb.</p>}
      {purchases.map((p) => (
        <Card key={p.id}>
          <div className="flex justify-between">
            <b className="text-navy">{p.stores?.name ?? "Flere butikker"}</b>
            <span className="text-xs text-[#8A8A8A]">{formatDateDMY(p.purchased_at.slice(0, 10))}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[13px] mt-2">
            <div className="text-[#8A8A8A]">Samlet pris</div>
            <div className="font-bold text-right">{formatCurrency(Number(p.total_price))}</div>
            <div className="text-[#8A8A8A]">Faktisk besparelse</div>
            <div className="font-bold text-right text-green">{formatCurrency(Number(p.saved_amount))}</div>
          </div>
        </Card>
      ))}
      <OutlineButton className="w-full mt-2" onClick={exportCsv}>
        ⬇️ Eksportér historik til CSV
      </OutlineButton>
    </div>
  );
}
