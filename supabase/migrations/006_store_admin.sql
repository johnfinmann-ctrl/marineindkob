-- =============================================================
-- MarineIndkøb — Fase 4
-- Migration 006: Butiksadministration
-- =============================================================
-- Udvider "stores" med adresse-felter og en fast liste af butikstyper,
-- tilføjer valideringsregler mod negative priser/afstande, og strammer
-- Row Level Security, så indkøbere kun kan læse AKTIVE butikker, mens
-- administrator fortsat kan se og administrere alle (også deaktiverede).
-- =============================================================

-- -------------------------------------------------------------
-- Nye kolonner
-- -------------------------------------------------------------
alter table stores add column if not exists address text;
alter table stores add column if not exists postal_code text;
alter table stores add column if not exists city text;

-- -------------------------------------------------------------
-- Normalisér eksisterende data, FØR vi tilføjer den faste liste af
-- butikstyper nedenfor. Tidligere versioner af seed-scriptet brugte fri
-- dansk tekst (fx "Supermarked", "Drikkevarer", "Netbutik") — uden dette
-- trin ville ALTER TABLE ... ADD CONSTRAINT fejle på allerede seedede
-- rækker, der ikke matcher den nye, faste liste.
-- -------------------------------------------------------------
update stores set type = lower(type) where type is not null;

update stores set type = case
  when type in ('supermarked') then 'supermarked'
  when type in ('discount') then 'discount'
  when type in ('engros', 'grossist') then 'engros'
  when type in ('specialbutik', 'drikkevarer', 'fiskehandler', 'bager', 'slagter') then 'specialbutik'
  when type in ('onlinebutik', 'netbutik', 'online') then 'onlinebutik'
  else type
end
where type is not null;

-- Sikkerhedsnet: alt, der stadig ikke matcher de fem gyldige typer efter
-- normaliseringen ovenfor, sættes til "specialbutik" i stedet for at
-- blokere migrationen. Administrator kan rette den enkelte butiks type
-- bagefter i Admin → Butikker.
update stores
set type = 'specialbutik'
where type is not null
  and type not in ('supermarked', 'discount', 'engros', 'specialbutik', 'onlinebutik');

-- -------------------------------------------------------------
-- Butikstyper — fast liste, jf. Fase 4-oplægget, afsnit 4.
-- -------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stores_type_check'
  ) then
    alter table stores add constraint stores_type_check
      check (type is null or type in ('supermarked', 'discount', 'engros', 'specialbutik', 'onlinebutik'));
  end if;
end $$;

-- -------------------------------------------------------------
-- Validering: ingen negative priser, afstande eller minimumskøb.
-- -------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stores_distance_km_check'
  ) then
    alter table stores add constraint stores_distance_km_check check (distance_km is null or distance_km >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stores_delivery_price_check'
  ) then
    alter table stores add constraint stores_delivery_price_check check (delivery_price >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stores_min_order_check'
  ) then
    alter table stores add constraint stores_min_order_check check (min_order >= 0);
  end if;
end $$;

-- Praktisk indeks til søgning/filtrering i admin-oversigten.
create index if not exists idx_stores_active on stores (organization_id, active);
create index if not exists idx_stores_type on stores (organization_id, type);

-- -------------------------------------------------------------
-- RLS: indkøbere må kun læse AKTIVE butikker. Administrator kan
-- fortsat se og administrere alle butikker, aktive som inaktive.
-- (Skriverettigheder — insert/update/delete — er uændrede og var
-- allerede administrator-kun, se migration 002_rls.sql.)
-- -------------------------------------------------------------
drop policy if exists stores_select on stores;
create policy stores_select on stores
  for select using (
    is_org_member(organization_id)
    and (active = true or is_admin(organization_id))
  );
