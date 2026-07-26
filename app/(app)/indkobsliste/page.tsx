"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrgRealtime } from "@/lib/supabase/useRealtimeTable";
import { useMembership } from "@/components/MembershipContext";
import { Card, Pill, EmptyState, GoldButton, OutlineButton } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";
import type { ListItemStatus } from "@/types/database";

interface ListItem {
  id: string;
  product_id: string;
  store_id: string | null;
  quantity: number;
  expected_price: number;
  status: ListItemStatus;
  reserved_by: string | null;
  purchased_by: string | null;
  purchased_at: string | null;
  products: { name: string; icon: string | null; unit_id: string | null } | null;
  stores: { name: string } | null;
}

interface ActiveReservation {
  id: string;
  shopping_list_item_id: string;
  reserved_by: string;
  reserved_at: string;
}

export default function IndkobslistePage() {
  const membership = useMembership();
  const router = useRouter();
  const [items, setItems] = useState<ListItem[]>([]);
  const [reservations, setReservations] = useState<ActiveReservation[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveNote, setLiveNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();

    const { data: itemRows } = await supabase
      .from("shopping_list_items")
      .select(
        "id, product_id, store_id, quantity, expected_price, status, reserved_by, purchased_by, purchased_at, products(name, icon, unit_id), stores(name)"
      )
      .eq("organization_id", membership.organizationId)
      .neq("status", "annulleret");
    setItems((itemRows ?? []) as unknown as ListItem[]);

    const { data: resRows } = await supabase
      .from("shopping_item_reservations")
      .select("id, shopping_list_item_id, reserved_by, reserved_at")
      .eq("organization_id", membership.organizationId)
      .eq("status", "aktiv");
    setReservations(resRows ?? []);

    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, profiles(full_name)")
      .eq("organization_id", membership.organizationId);
    const nameMap: Record<string, string> = {};
    (members ?? []).forEach((m: any) => {
      nameMap[m.user_id] = m.profiles?.full_name ?? "Ukendt";
    });
    setNames(nameMap);
  }, [membership.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  useOrgRealtime("shopping_list_items", membership.organizationId, () => load());
  useOrgRealtime("shopping_item_reservations", membership.organizationId, (payload) => {
    load();
    const newRow = payload.new as { reserved_by?: string } | undefined;
    if (payload.eventType === "INSERT" && newRow?.reserved_by && newRow.reserved_by !== membership.userId) {
      setLiveNote(`${names[newRow.reserved_by] ?? "En anden indkøber"} reserverede lige en vare.`);
      setTimeout(() => setLiveNote(null), 4000);
    }
  });

  async function handleReserve(itemId: string) {
    setBusyId(itemId);
    setErrorMsg(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("create_reservation", { p_shopping_list_item_id: itemId });
    setBusyId(null);
    if (error) {
      setErrorMsg(error.message);
      load();
      return;
    }
    load();
  }

  async function handleRelease(reservationId: string) {
    setBusyId(reservationId);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("release_reservation", { p_reservation_id: reservationId });
    setBusyId(null);
    if (error) setErrorMsg(error.message);
    load();
  }

  const groups = groupByStore(items);
  const total = items.filter((i) => i.status !== "købt").reduce((s, i) => s + Number(i.expected_price), 0);

  if (items.length === 0) {
    return <EmptyState icon="🛒" title="Indkøbslisten er tom" subtitle="Tilføj varer fra Mangler, Tilbud eller Indkøbsforslag." />;
  }

  return (
    <div>
      {liveNote && <div className="text-xs bg-sand-dark text-navy rounded-lg px-3 py-2 mb-3 inline-block">{liveNote}</div>}
      {errorMsg && <div className="text-xs bg-red-bg text-red rounded-lg px-3 py-2 mb-3">{errorMsg}</div>}

      {groups.map(([storeName, storeItems]) => (
        <div key={storeName}>
          <div className="flex justify-between items-center bg-navy text-white rounded-lg px-3.5 py-2 font-serif font-bold text-sm my-4">
            <span>{storeName}</span>
            <span>{storeItems.length} varer</span>
          </div>
          {storeItems.map((item) => {
            const reservation = reservations.find((r) => r.shopping_list_item_id === item.id);
            return (
              <div key={item.id} className="bg-white rounded-lg p-3 mb-2 shadow flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy text-[14.5px]">
                    {item.products?.icon} {item.quantity} {item.products?.name}
                  </div>
                  <Pill color={statusColor(item.status)}>{item.status}</Pill>
                  {item.status === "købt" && item.purchased_by && (
                    <div className="text-[11.5px] bg-sand-dark text-navy rounded-md px-2 py-1 mt-1.5 inline-block ml-1">
                      Købt af {names[item.purchased_by] ?? "?"} kl.{" "}
                      {item.purchased_at ? new Date(item.purchased_at).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </div>
                  )}
                  {reservation && item.status !== "købt" && (
                    <div className="text-[11.5px] bg-sand-dark text-navy rounded-md px-2 py-1 mt-1.5 inline-block ml-1">
                      {reservation.reserved_by === membership.userId ? "Du køber denne" : `${names[reservation.reserved_by] ?? "?"} køber denne`} · reserveret kl.{" "}
                      {new Date(reservation.reserved_at).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-[13.5px]">{formatCurrency(Number(item.expected_price))}</div>
                  <div className="mt-1.5">
                    {item.status === "købt" ? null : reservation ? (
                      reservation.reserved_by === membership.userId ? (
                        <OutlineButton disabled={busyId === reservation.id} onClick={() => handleRelease(reservation.id)}>
                          Frigiv
                        </OutlineButton>
                      ) : null
                    ) : (
                      <OutlineButton disabled={busyId === item.id} onClick={() => handleReserve(item.id)}>
                        Jeg køber denne
                      </OutlineButton>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <Card className="mt-4">
        <div className="grid grid-cols-2 gap-1.5 text-sm">
          <div className="text-[#8A8A8A]">Samlet forventet pris</div>
          <div className="font-bold text-right">{formatCurrency(total)}</div>
        </div>
        <div className="flex gap-2.5 mt-3">
          <OutlineButton onClick={() => window.print()}>🖨️ Print</OutlineButton>
          <OutlineButton onClick={() => exportCsv(items)}>⬇️ Eksportér</OutlineButton>
        </div>
        <GoldButton className="w-full mt-2.5" onClick={() => router.push("/kob")}>
          Start indkøbstur
        </GoldButton>
      </Card>
    </div>
  );
}

function groupByStore(items: ListItem[]): [string, ListItem[]][] {
  const map = new Map<string, ListItem[]>();
  for (const item of items) {
    const key = item.stores?.name ?? "Ingen butik valgt";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries());
}

function statusColor(status: ListItemStatus): "green" | "yellow" | "blue" | "red" | "grey" {
  const map: Record<ListItemStatus, "green" | "yellow" | "blue" | "red" | "grey"> = {
    behov: "grey",
    planlagt: "blue",
    reserveret: "yellow",
    "i kurv": "blue",
    købt: "green",
    "ikke fundet": "red",
    erstattet: "blue",
    annulleret: "grey"
  };
  return map[status];
}

function exportCsv(items: ListItem[]) {
  const rows = [
    ["Butik", "Vare", "Antal", "Pris", "Status"],
    ...items.map((i) => [
      i.stores?.name ?? "",
      i.products?.name ?? "",
      String(i.quantity),
      String(i.expected_price).replace(".", ","),
      i.status
    ])
  ];
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "marineindkob-indkobsliste.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
