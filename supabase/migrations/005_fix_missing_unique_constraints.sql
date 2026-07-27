-- =============================================================
-- MarineIndkøb — Fase 3
-- Migration 005: manglende unique constraints (rettelse)
-- =============================================================
-- BAGGRUND
-- Seed-scriptet (supabase/seed/run-seed.mjs) forsøger at "upserte"
-- product_categories og product_units med:
--   onConflict: "organization_id,name"   (product_categories)
--   onConflict: "organization_id,code"   (product_units)
--
-- Migration 001 oprettede aldrig en unik constraint på disse
-- kolonnepar — kun primary key på id. Uden en matchende unique/
-- exclusion constraint afviser Postgres ON CONFLICT-klausulen med
-- fejlen "there is no unique or exclusion constraint matching the
-- ON CONFLICT specification". Det fik seed-scriptet til at fejle med
-- "Cannot read properties of null (reading 'id')", fordi den
-- efterfølgende fallback-SELECT heller ikke fandt nogen række (der
-- var jo aldrig indsat en).
--
-- Denne migration tilføjer de manglende constraints. Den er skrevet,
-- så den er sikker at køre igen (og sikker at køre, selvom en
-- tidligere delvis kørsel af seed-scriptet allerede har indsat nogle
-- kategorier/enheder uden constraint'en).
-- =============================================================

-- Hvis der mod forventning skulle være opstået dubletter af samme
-- organisation+navn, før constraint'en fandtes, fjernes de her (kun
-- den nyeste bevares), så "add constraint" nedenfor ikke fejler.
delete from product_categories a
using product_categories b
where a.organization_id = b.organization_id
  and a.name = b.name
  and a.id < b.id;

delete from product_units a
using product_units b
where a.organization_id = b.organization_id
  and a.code = b.code
  and a.id < b.id;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_categories_org_name_key'
  ) then
    alter table product_categories
      add constraint product_categories_org_name_key unique (organization_id, name);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_units_org_code_key'
  ) then
    alter table product_units
      add constraint product_units_org_code_key unique (organization_id, code);
  end if;
end $$;
