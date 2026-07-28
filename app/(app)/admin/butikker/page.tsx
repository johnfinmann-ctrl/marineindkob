"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMembership } from "@/components/MembershipContext";
import { Card, Pill, GoldButton, OutlineButton } from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";
import { STORE_TYPES } from "@/lib/validation/schemas";

interface StoreRow {
  id: string;
  name: string;
  type: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  distance_km: number | null;
  delivery: boolean;
  delivery_price: number;
  min_order: number;
  hours: string | null;
  active: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  supermarked: "Supermarked",
  discount: "Discount",
  engros: "Engros",
  specialbutik: "Specialbutik",
  onlinebutik: "Onlinebutik"
};

export default function AdminButikkerPage() {
  const membership = useMembership();
  const isAdmin = membership.role === "administrator";

  const [stores, setStores] = useState<StoreRow[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("Alle");
  const [statusFilter, setStatusFilter] = useState<"Alle" | "Aktive" | "Inaktive">("Alle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    // Administrator ser alle butikker (aktive + inaktive) via RLS;
    // en indkøber, der skulle finde vej hertil, ser kun aktive — se
    // migration 006_store_admin.sql.
    const { data, error } = await supabase
      .from("stores")
      .select("id, name, type, address, postal_code, city, distance_km, delivery, delivery_price, min_order, hours, active")
      .eq("organization_id", membership.organizationId)
      .order("name");
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setStores(data ?? []);
  }, [membership.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.city ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (s.address ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "Alle" || s.type === typeFilter;
      const matchesStatus =
        statusFilter === "Alle" || (statusFilter === "Aktive" ? s.active : !s.active);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [stores, search, typeFilter, statusFilter]);

  async function toggleActive(store: StoreRow) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("stores")
      .update({ active: !store.active, updated_by: membership.userId })
      .eq("id", store.id);
    if (error) {
      setErrorMsg(
        error.code === "42501" ? "Kun administrator kan ændre butikker." : `Kunne ikke opdatere butikken: ${error.message}`
      );
      return;
    }
    load();
  }

  async function deleteStore(store: StoreRow) {
    if (!confirm(`Slet butikken "${store.name}"? Dette kan ikke fortrydes.`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("stores").delete().eq("id", store.id);
    if (error) {
      if (error.code === "23503") {
        setErrorMsg(
          `"${store.name}" er i brug (fx i tilbud, indkøbslister eller historiske køb) og kan derfor ikke slettes. Deaktivér butikken i stedet.`
        );
      } else if (error.code === "42501") {
        setErrorMsg("Kun administrator kan slette butikker.");
      } else {
        setErrorMsg(`Kunne ikke slette butikken: ${error.message}`);
      }
      return;
    }
    load();
  }

  if (!isAdmin) {
    return (
      <Card>
        <p className="text-sm text-[#4a5a63]">
          Denne side er kun tilgængelig for administratorer. Adgangen er tjekket både her og i
          databasen (Row Level Security).
        </p>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Link href="/admin" className="text-sm text-gold font-semibold">
          ← Admin
        </Link>
        <Link href="/admin/butikker/ny">
          <GoldButton>＋ Ny butik</GoldButton>
        </Link>
      </div>

      {errorMsg && (
        <div className="text-xs bg-red-bg text-red rounded-lg px-3 py-2 mb-3">{errorMsg}</div>
      )}

      <Card>
        <div className="flex flex-col gap-2.5 md:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søg på navn, adresse eller by…"
            className="flex-1 border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          >
            <option value="Alle">Alle typer</option>
            {STORE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="border border-[#DCD3C0] rounded-xl px-3 py-2.5"
          >
            <option value="Alle">Alle</option>
            <option value="Aktive">Kun aktive</option>
            <option value="Inaktive">Kun inaktive</option>
          </select>
        </div>
      </Card>

      {filtered.length === 0 && (
        <Card>
          <p className="text-sm text-[#8A8A8A]">Ingen butikker matcher søgningen/filtrene.</p>
        </Card>
      )}

      {filtered.map((s) => (
        <Card key={s.id}>
          <div className="flex justify-between items-start">
            <h3 className="font-serif text-navy m-0 text-base">{s.name}</h3>
            <div className="flex gap-1.5">
              <Pill color={s.active ? "green" : "grey"}>{s.active ? "Aktiv" : "Inaktiv"}</Pill>
              {s.type && <Pill color="blue">{TYPE_LABELS[s.type] ?? s.type}</Pill>}
            </div>
          </div>
          <div className="text-xs text-[#8A8A8A] mt-1">
            {[s.address, s.postal_code && s.city ? `${s.postal_code} ${s.city}` : s.city].filter(Boolean).join(", ") ||
              "Ingen adresse registreret"}
          </div>
          <div className="grid grid-cols-2 gap-x-3.5 gap-y-1.5 text-[13px] mt-2.5 mb-2.5">
            <div className="text-[#8A8A8A]">Afstand</div>
            <div className="font-bold">{s.distance_km != null ? `${s.distance_km} km` : "—"}</div>
            <div className="text-[#8A8A8A]">Levering</div>
            <div className="font-bold">{s.delivery ? "Ja" : "Nej"}</div>
            {s.delivery && (
              <>
                <div className="text-[#8A8A8A]">Leveringspris</div>
                <div className="font-bold">{formatCurrency(Number(s.delivery_price))}</div>
              </>
            )}
            <div className="text-[#8A8A8A]">Minimumskøb</div>
            <div className="font-bold">{formatCurrency(Number(s.min_order))}</div>
            <div className="text-[#8A8A8A]">Åbningstider</div>
            <div className="font-bold">{s.hours ?? "—"}</div>
          </div>
          <div className="flex gap-2.5">
            <Link href={`/admin/butikker/${s.id}`}>
              <OutlineButton>Redigér</OutlineButton>
            </Link>
            <OutlineButton onClick={() => toggleActive(s)}>{s.active ? "Deaktivér" : "Aktivér"}</OutlineButton>
            <OutlineButton className="!border-red !text-red" onClick={() => deleteStore(s)}>
              Slet
            </OutlineButton>
          </div>
        </Card>
      ))}
    </div>
  );
}
