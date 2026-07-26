"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMembership } from "@/components/MembershipContext";
import { Card, Pill, GoldButton, OutlineButton, PrimaryButton, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";

interface ListItem {
  id: string;
  product_id: string;
  store_id: string | null;
  quantity: number;
  expected_price: number;
  status: string;
  products: { name: string; icon: string | null } | null;
  stores: { name: string } | null;
}

export default function KobPage() {
  const membership = useMembership();
  const router = useRouter();
  const [items, setItems] = useState<ListItem[]>([]);
  const [marks, setMarks] = useState<Record<string, "købt" | "ikke fundet" | "erstattet">>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("shopping_list_items")
      .select("id, product_id, store_id, quantity, expected_price, status, products(name, icon), stores(name)")
      .eq("organization_id", membership.organizationId)
      .neq("status", "annulleret")
      .neq("status", "købt");
    setItems((data ?? []) as unknown as ListItem[]);
  }, [membership.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  function setMark(id: string, mark: "købt" | "ikke fundet" | "erstattet") {
    setMarks((m) => ({ ...m, [id]: mark }));
  }

  async function handleFinish() {
    const boughtItems = items.filter((i) => marks[i.id] === "købt");
    setSubmitting(true);
    setErrorMsg(null);
    const supabase = createSupabaseBrowserClient();

    // Marker "ikke fundet"/"erstattet" direkte (kræver ikke transaktionen).
    const otherMarks = items.filter((i) => marks[i.id] && marks[i.id] !== "købt");
    for (const item of otherMarks) {
      await supabase.from("shopping_list_items").update({ status: marks[item.id] }).eq("id", item.id);
    }

    if (boughtItems.length > 0) {
      const storeId = boughtItems[0]?.store_id ?? null;
      const payload = boughtItems.map((i) => ({
        shopping_list_item_id: i.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: Number(i.expected_price) / i.quantity
      }));

      const { error } = await supabase.rpc("record_purchase", {
        p_organization_id: membership.organizationId,
        p_store_id: storeId,
        p_items: payload
      });

      if (error) {
        setSubmitting(false);
        setErrorMsg(
          "Købet kunne ikke gennemføres, så lageret er IKKE opdateret. " +
            "Ingen falsk kvittering vises. Prøv igen, eller kontakt en administrator. (" +
            error.message +
            ")"
        );
        return;
      }
    }

    setSubmitting(false);
    router.push("/forside");
    router.refresh();
  }

  if (items.length === 0) {
    return <EmptyState icon="✅" title="Indkøbslisten er tom" subtitle="Der er ingen varer at registrere som købt." />;
  }

  return (
    <div>
      <p className="text-sm text-[#4a5a63] mb-3">
        Bekræft hvad der faktisk blev købt. Lageret opdateres først, når du trykker "Afslut og opdatér lager" —
        hele registreringen sker som én samlet, transaktionssikker handling.
      </p>
      {errorMsg && <div className="text-xs bg-red-bg text-red rounded-lg px-3 py-2 mb-3">{errorMsg}</div>}
      {items.map((item) => (
        <Card key={item.id}>
          <div className="flex justify-between items-center">
            <h3 className="font-serif text-navy m-0 text-base">
              {item.products?.icon} {item.quantity} {item.products?.name}
            </h3>
            <Pill color="grey">{item.stores?.name ?? "Ingen butik"}</Pill>
          </div>
          {marks[item.id] ? (
            <Pill color={marks[item.id] === "købt" ? "green" : "yellow"}>{marks[item.id]}</Pill>
          ) : (
            <div className="flex gap-2.5 mt-2.5">
              <OutlineButton onClick={() => setMark(item.id, "ikke fundet")}>Ikke fundet</OutlineButton>
              <OutlineButton onClick={() => setMark(item.id, "erstattet")}>Erstattet</OutlineButton>
              <PrimaryButton onClick={() => setMark(item.id, "købt")} className="!py-2 !px-3.5 text-sm">
                Købt
              </PrimaryButton>
            </div>
          )}
        </Card>
      ))}
      <GoldButton className="w-full" disabled={submitting} onClick={handleFinish}>
        {submitting ? "Registrerer…" : "Afslut og opdatér lager"}
      </GoldButton>
    </div>
  );
}
