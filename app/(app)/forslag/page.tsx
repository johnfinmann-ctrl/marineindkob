"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMembership } from "@/components/MembershipContext";
import { Card, Pill, GoldButton, OutlineButton, SectionTitle } from "@/components/ui";
import { calculateRecommendedQuantity, type RecommendationResult } from "@/lib/calculations/recommendations";

interface ProductWithStock {
  id: string;
  name: string;
  icon: string | null;
  default_weekly_use: number;
  stock: { quantity: number; minimum_quantity: number } | null;
  offer: { id: string; offer_price: number; normal_price: number; store_id: string } | null;
}

interface Recommendation {
  product: ProductWithStock;
  result: RecommendationResult;
}

export default function ForslagPage() {
  const membership = useMembership();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();

    const { data: needs } = await supabase
      .from("shopping_needs")
      .select("product_id")
      .eq("organization_id", membership.organizationId)
      .is("deleted_at", null);
    const productIds = (needs ?? []).map((n) => n.product_id);
    if (productIds.length === 0) {
      setRecs([]);
      setLoading(false);
      return;
    }

    const { data: products } = await supabase
      .from("products")
      .select("id, name, icon, default_weekly_use")
      .in("id", productIds);

    const { data: stockRows } = await supabase
      .from("stock_items")
      .select("product_id, quantity, minimum_quantity")
      .in("product_id", productIds);

    const { data: offerRows } = await supabase
      .from("offers")
      .select("id, product_id, offer_price, normal_price, store_id")
      .in("product_id", productIds)
      .is("deleted_at", null);

    const results: Recommendation[] = (products ?? []).map((p) => {
      const stock = stockRows?.find((s) => s.product_id === p.id) ?? null;
      const offer = offerRows?.find((o) => o.product_id === p.id) ?? null;
      const result = calculateRecommendedQuantity({
        currentStock: stock?.quantity ?? 0,
        minStock: stock?.minimum_quantity ?? 0,
        weeklyUse: p.default_weekly_use,
        offerPrice: offer?.offer_price,
        normalPrice: offer?.normal_price,
        typicalWeeksBetweenOffers: 5,
        isLongLasting: p.default_weekly_use < 2.5
      });
      return { product: { ...p, stock, offer }, result };
    });
    setRecs(results);
    setLoading(false);
  }, [membership.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addToList(rec: Recommendation) {
    const supabase = createSupabaseBrowserClient();
    const { data: list } = await supabase
      .from("shopping_lists")
      .select("id")
      .eq("organization_id", membership.organizationId)
      .eq("status", "aktiv")
      .maybeSingle();
    let listId = list?.id;
    if (!listId) {
      const { data: newList } = await supabase
        .from("shopping_lists")
        .insert({ organization_id: membership.organizationId, created_by: membership.userId })
        .select("id")
        .single();
      listId = newList?.id;
    }
    const unitPrice = rec.product.offer?.offer_price ?? 20;
    await supabase.from("shopping_list_items").insert({
      organization_id: membership.organizationId,
      shopping_list_id: listId,
      product_id: rec.product.id,
      store_id: rec.product.offer?.store_id ?? null,
      quantity: rec.result.recommendedQty || 1,
      expected_price: unitPrice * (rec.result.recommendedQty || 1),
      created_by: membership.userId,
      updated_by: membership.userId
    });
    alert(`${rec.product.name} tilføjet til indkøbslisten.`);
  }

  if (loading) return null;

  const groups: [RecommendationResult["type"], string][] = [
    ["kob_nu", "Køb nu"],
    ["kob_kun_nodvendigt", "Køb kun det nødvendige"],
    ["vent", "Vent"]
  ];

  return (
    <div>
      {groups.map(([type, title]) => {
        const items = recs.filter((r) => r.result.type === type);
        if (items.length === 0) return null;
        return (
          <div key={type}>
            <SectionTitle>{title}</SectionTitle>
            {items.map((r) => (
              <Card key={r.product.id} className={recBg(type)}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-extrabold text-[13px]" style={{ color: recColor(type) }}>
                    {title.toUpperCase()}
                  </span>
                  <Pill color="grey">Sikkerhed: {r.result.certainty}</Pill>
                </div>
                <div className="font-serif font-bold text-navy text-[17px] mb-1">{r.product.icon} {r.product.name}</div>
                <div className="text-[13.5px] text-[#3a4a53] leading-relaxed mb-2.5">
                  {r.result.reasonKeyFacts.join(" ")}
                  {r.result.recommendedQty > 0 && (
                    <>
                      <br />
                      <b>Anbefaling: Køb {r.result.recommendedQty} stk.</b>
                    </>
                  )}
                </div>
                {r.result.recommendedQty > 0 && (
                  <OutlineButton onClick={() => addToList(r)}>Tilføj til indkøbsliste</OutlineButton>
                )}
              </Card>
            ))}
          </div>
        );
      })}
      {recs.length === 0 && (
        <Card>
          <p className="text-sm text-[#4a5a63]">
            Der er ingen registrerede behov endnu. Gå til Mangler og registrér, hvad I mangler, for at få forslag her.
          </p>
        </Card>
      )}
    </div>
  );
}

function recColor(type: RecommendationResult["type"]) {
  if (type === "kob_nu") return "#2E7D4F";
  if (type === "kob_kun_nodvendigt") return "#C9971C";
  return "#3E6B8A";
}
function recBg(type: RecommendationResult["type"]) {
  if (type === "kob_nu") return "!bg-green-bg";
  if (type === "kob_kun_nodvendigt") return "!bg-yellow-bg";
  return "!bg-blue-bg";
}
