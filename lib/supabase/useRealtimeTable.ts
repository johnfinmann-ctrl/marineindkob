"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "./client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

/**
 * Abonnerer på ændringer i en given tabel for den aktuelle organisation og
 * kalder onChange, når andre brugere opretter, opdaterer eller sletter
 * rækker. Rydder selv abonnementet op ved unmount (jf. Fase 3-oplægget,
 * afsnit 12: "Implementér korrekt subscription cleanup").
 */
export function useOrgRealtime(
  table: string,
  organizationId: string | undefined,
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
) {
  useEffect(() => {
    if (!organizationId) return;
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`realtime:${table}:${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `organization_id=eq.${organizationId}`
        },
        onChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, organizationId]);
}
