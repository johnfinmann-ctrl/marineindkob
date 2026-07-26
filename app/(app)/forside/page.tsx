"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOrgRealtime } from "@/lib/supabase/useRealtimeTable";
import { useMembership } from "@/components/MembershipContext";
import { Card, SectionTitle } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";

interface Overview {
  criticalCount: number;
  soonCount: number;
  onOfferCount: number;
  listItemCount: number;
  listTotal: number;
  nextEvent: { name: string; date: string } | null;
}

export default function ForsidePage() {
  const membership = useMembership();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [liveNote, setLiveNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();

    const { data: needs } = await supabase
      .from("shopping_needs")
      .select("status")
      .eq("organization_id", membership.organizationId)
      .is("deleted_at", null);

    const { data: items } = await supabase
      .from("shopping_list_items")
      .select("expected_price, status")
      .eq("organization_id", membership.organizationId)
      .neq("status", "købt");

    const { data: events } = await supabase
      .from("events")
      .select("name, date")
      .eq("organization_id", membership.organizationId)
      .is("deleted_at", null)
      .order("date", { ascending: true })
      .limit(1);

    const criticalCount = needs?.filter((n) => n.status === "Kritisk").length ?? 0;
    const snartCount = needs?.filter((n) => n.status === "Snart").length ?? 0;
    const onOfferCount = needs?.filter((n) => n.status === "Tilbud").length ?? 0;

    setOverview({
      criticalCount,
      soonCount: criticalCount + snartCount,
      onOfferCount,
      listItemCount: items?.length ?? 0,
      listTotal: (items ?? []).reduce((sum, i) => sum + Number(i.expected_price ?? 0), 0),
      nextEvent: events?.[0] ?? null
    });
  }, [membership.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: opdatér overblikket, når andre brugere ændrer behov, listen
  // eller lageret — og vis en diskret besked om hvad der skete.
  useOrgRealtime("shopping_needs", membership.organizationId, () => load());
  useOrgRealtime("shopping_list_items", membership.organizationId, () => load());
  useOrgRealtime("stock_items", membership.organizationId, () => {
    setLiveNote("Lageret blev lige opdateret af en anden indkøber.");
    setTimeout(() => setLiveNote(null), 4000);
  });

  return (
    <div>
      <div className="font-serif text-[26px] font-bold text-navy mt-1 mb-0.5">
        Godmorgen, {membership.fullName}
      </div>
      <div className="text-[#4a5a63] text-[14.5px] leading-relaxed mb-4">
        <b>{overview?.soonCount ?? "…"}</b> varer bør købes inden for de næste 10 dage.
        <br />
        <b>{overview?.onOfferCount ?? "…"}</b> af dem er registreret på tilbud lige nu.
      </div>

      {liveNote && (
        <div className="text-xs bg-sand-dark text-navy rounded-lg px-3 py-2 mb-3 inline-block">
          {liveNote}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-1">
        <ActionCard href="/mangler/ny" gold icon="📋" label="Registrér en mangel" meta="Sig eller skriv, hvad I mangler" />
        <ActionCard href="/forslag" icon="💡" label="Se indkøbsforslag" meta="Regelbaseret forslag" />
        <ActionCard
          href="/indkobsliste"
          icon="🛒"
          label="Åbn indkøbslisten"
          meta={overview ? `${overview.listItemCount} varer · ca. ${formatCurrency(overview.listTotal)}` : "…"}
        />
        <ActionCard href="/kob" icon="✅" label="Registrér køb" meta="Brug efter indkøbsturen" />
      </div>

      <SectionTitle>Overblik</SectionTitle>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        <StatChip
          num={overview?.nextEvent ? new Date(overview.nextEvent.date).toLocaleDateString("da-DK", { day: "numeric", month: "short" }) : "—"}
          label={`Næste arrangement${overview?.nextEvent ? " · " + overview.nextEvent.name : ""}`}
        />
        <StatChip num={overview ? formatCurrency(overview.listTotal) : "…"} label="Forventet samlet indkøb" />
        <StatChip num={String(overview?.criticalCount ?? "…")} label="Kritisk lav beholdning" danger />
      </div>

      <SectionTitle>Genveje</SectionTitle>
      <Card>
        <p className="text-sm text-[#4a5a63]">
          Du er logget ind som <b>{membership.fullName}</b> (
          {membership.role === "administrator" ? "Administrator" : "Indkøber"}). Alt du ser her,
          deles i realtid med de andre indkøbere i foreningen.
        </p>
        <div className="flex gap-3 mt-3 text-sm">
          <Link href="/tilbud" className="text-gold font-semibold">
            Ugens tilbud →
          </Link>
          <Link href="/arrangementer" className="text-gold font-semibold">
            Arrangementer →
          </Link>
        </div>
      </Card>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  label,
  meta,
  gold
}: {
  href: string;
  icon: string;
  label: string;
  meta: string;
  gold?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl p-4 flex flex-col gap-2 min-h-[108px] shadow ${
        gold ? "bg-gradient-to-br from-gold to-[#8f6f28] text-white" : "bg-navy text-warm-white"
      }`}
    >
      <div className="text-2xl">{icon}</div>
      <div className="font-serif font-bold text-base">{label}</div>
      <div className="text-xs opacity-85">{meta}</div>
    </Link>
  );
}

function StatChip({ num, label, danger }: { num: string; label: string; danger?: boolean }) {
  return (
    <div className="bg-warm-white rounded-xl px-3.5 py-2.5 shadow min-w-[130px] shrink-0">
      <div className={`font-serif text-lg font-bold ${danger ? "text-red" : "text-navy"}`}>{num}</div>
      <div className="text-[11px] text-[#8A8A8A] mt-0.5 leading-tight">{label}</div>
    </div>
  );
}
