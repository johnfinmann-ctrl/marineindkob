"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMembership } from "@/components/MembershipContext";
import { Card, Pill, GoldButton, OutlineButton } from "@/components/ui";
import { formatCurrency, calculateOfferRating } from "@/lib/calculations";

interface OfferRow {
  id: string;
  product_id: string;
  store_id: string;
  offer_price: number;
  normal_price: number;
  qty: number;
  unit: string;
  end_date: string;
  products: { name: string; icon: string | null } | null;
  stores: { name: string; distance_km: number | null } | null;
}

export default function TilbudPage() {
  const membership = useMembership();
  const [offers, setOffers] = useState<OfferRow[]>([]);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("offers")
      .select("id, product_id, store_id, offer_price, normal_price, qty, unit, end_date, products(name, icon), stores(name, distance_km)")
      .eq("organization_id", membership.organizationId)
      .is("deleted_at", null)
      .order("end_date", { ascending: true });
    setOffers((data ?? []) as unknown as OfferRow[]);
  }, [membership.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addToList(offer: OfferRow) {
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

    await supabase.from("shopping_list_items").insert({
      organization_id: membership.organizationId,
      shopping_list_id: listId,
      product_id: offer.product_id,
      store_id: offer.store_id,
      quantity: 1,
      expected_price: offer.offer_price,
      created_by: membership.userId,
      updated_by: membership.userId
    });
    alert(`${offer.products?.name} tilføjet til indkøbslisten.`);
  }

  return (
    <div>
      <Link href="/tilbud/ny">
        <GoldButton className="w-full mb-4">＋ Registrér nyt tilbud</GoldButton>
      </Link>
      {offers.map((o) => {
        const rating = calculateOfferRating(Number(o.offer_price), Number(o.normal_price));
        return (
          <Card key={o.id} className="relative">
            <div className="absolute top-4 right-4">
              <Pill color={rating.level === "green" ? "green" : rating.level === "yellow" ? "yellow" : "grey"}>
                {rating.rating}
              </Pill>
            </div>
            <h3 className="font-serif text-base text-navy m-0 mb-0.5">
              {o.products?.icon} {o.products?.name}
            </h3>
            <div className="text-xs text-[#8A8A8A]">
              {o.stores?.name}
              {o.stores?.distance_km != null ? ` · ${o.stores.distance_km} km` : " · Levering"}
            </div>
            <div className="flex items-baseline gap-2.5 my-2">
              <span className="font-serif text-2xl font-bold text-green">{formatCurrency(Number(o.offer_price))}</span>
              <span className="text-sm text-[#8A8A8A] line-through">{formatCurrency(Number(o.normal_price))}</span>
            </div>
            <div className="text-xs text-[#8A8A8A]">
              Gælder til {new Date(o.end_date).toLocaleDateString("da-DK")}
            </div>
            <div className="flex gap-2.5 mt-2.5">
              <OutlineButton onClick={() => addToList(o)}>Tilføj til indkøbsliste</OutlineButton>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
