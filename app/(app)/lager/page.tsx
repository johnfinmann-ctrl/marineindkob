"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrgRealtime } from "@/lib/supabase/useRealtimeTable";
import { useMembership } from "@/components/MembershipContext";
import { Card, Pill } from "@/components/ui";

interface StockRow {
  id: string;
  product_id: string;
  quantity: number;
  minimum_quantity: number;
  average_weekly_consumption: number;
  expiry_date: string | null;
  version: number;
  products: { name: string; icon: string | null } | null;
}

export default function LagerPage() {
  const membership = useMembership();
  const [items, setItems] = useState<StockRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("stock_items")
      .select("id, product_id, quantity, minimum_quantity, average_weekly_consumption, expiry_date, version, products(name, icon)")
      .eq("organization_id", membership.organizationId)
      .order("products(name)", { ascending: true });
    setItems((data ?? []) as unknown as StockRow[]);
  }, [membership.organizationId]);

  useEffect(() => {
    load();
  }, [load]);
  useOrgRealtime("stock_items", membership.organizationId, () => load());

  async function adjust(item: StockRow, delta: number) {
    setBusyId(item.id);
    setErrorMsg(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("adjust_stock", {
      p_organization_id: membership.organizationId,
      p_product_id: item.product_id,
      p_delta: delta,
      p_movement_type: "manuel regulering",
      p_expected_version: item.version
    });
    setBusyId(null);
    if (error) {
      setErrorMsg("Varen er blevet ændret af en anden bruger. Hent den nyeste version og prøv igen.");
      load();
      return;
    }
    load();
  }

  return (
    <div>
      {errorMsg && <div className="text-xs bg-red-bg text-red rounded-lg px-3 py-2 mb-3">{errorMsg}</div>}
      {items.map((item) => {
        const status = stockStatus(item);
        const weeksLeft = item.average_weekly_consumption > 0 ? Math.round((item.quantity / item.average_weekly_consumption) * 10) / 10 : null;
        return (
          <Card key={item.id}>
            <div className="flex justify-between items-start">
              <h3 className="font-serif text-base text-navy m-0">
                {item.products?.icon} {item.products?.name}
              </h3>
              <Pill color={status.color}>{status.label}</Pill>
            </div>
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-1.5 text-[13px] mt-2.5 mb-2.5">
              <div className="text-[#8A8A8A]">Antal</div>
              <div className="font-bold">{item.quantity}</div>
              <div className="text-[#8A8A8A]">Minimumslager</div>
              <div className="font-bold">{item.minimum_quantity}</div>
              {weeksLeft != null && (
                <>
                  <div className="text-[#8A8A8A]">Rækker cirka</div>
                  <div className="font-bold">{weeksLeft} uger</div>
                </>
              )}
              {item.expiry_date && (
                <>
                  <div className="text-[#8A8A8A]">Udløber</div>
                  <div className="font-bold">{new Date(item.expiry_date).toLocaleDateString("da-DK")}</div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                disabled={busyId === item.id}
                onClick={() => adjust(item, -1)}
                className="w-10 h-10 rounded-lg border-[1.5px] border-navy text-navy font-bold text-lg disabled:opacity-40"
              >
                –
              </button>
              <span className="font-bold text-lg min-w-[34px] text-center">{item.quantity}</span>
              <button
                disabled={busyId === item.id}
                onClick={() => adjust(item, 1)}
                className="w-10 h-10 rounded-lg border-[1.5px] border-navy text-navy font-bold text-lg disabled:opacity-40"
              >
                +
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function stockStatus(item: StockRow): { color: "green" | "yellow" | "red" | "blue"; label: string } {
  if (item.quantity <= 0 || item.quantity < item.minimum_quantity * 0.5) {
    return { color: "red", label: "Mangler / kritisk lav" };
  }
  if (item.quantity < item.minimum_quantity) {
    return { color: "yellow", label: "Bør snart købes" };
  }
  return { color: "green", label: "Nok på lager" };
}
