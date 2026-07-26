-- =============================================================
-- MarineIndkøb — Fase 3
-- Migration 002: Row Level Security
-- =============================================================
-- Grundregel (jf. Fase 3-oplægget, afsnit 13):
--   En bruger må kun læse og ændre data, hvis brugeren er aktivt
--   medlem af den samme organisation.
-- Administratorrettigheder verificeres i databasen via is_admin(),
-- ikke kun i brugerfladen.
-- =============================================================

-- -------------------------------------------------------------
-- Hjælpefunktioner
-- -------------------------------------------------------------

create or replace function is_org_member(check_org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from organization_members om
    where om.organization_id = check_org_id
      and om.user_id = auth.uid()
      and om.active = true
  );
$$;

create or replace function is_admin(check_org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from organization_members om
    join roles r on r.id = om.role_id
    where om.organization_id = check_org_id
      and om.user_id = auth.uid()
      and om.active = true
      and r.code = 'administrator'
  );
$$;

-- -------------------------------------------------------------
-- Aktivér RLS på alle organisationsejede tabeller
-- -------------------------------------------------------------

alter table organizations enable row level security;
alter table roles enable row level security;
alter table profiles enable row level security;
alter table organization_members enable row level security;
alter table product_categories enable row level security;
alter table product_units enable row level security;
alter table products enable row level security;
alter table stores enable row level security;
alter table store_locations enable row level security;
alter table delivery_options enable row level security;
alter table travel_cost_settings enable row level security;
alter table stock_items enable row level security;
alter table stock_movements enable row level security;
alter table shopping_needs enable row level security;
alter table offers enable row level security;
alter table offer_prices enable row level security;
alter table price_history enable row level security;
alter table shopping_lists enable row level security;
alter table shopping_list_items enable row level security;
alter table shopping_item_reservations enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table events enable row level security;
alter table event_requirements enable row level security;
alter table consumption_history enable row level security;
alter table audit_log enable row level security;
alter table notifications enable row level security;
alter table attachments enable row level security;

-- -------------------------------------------------------------
-- organizations — kun læsning for medlemmer, ingen klient-skrivning
-- -------------------------------------------------------------
create policy org_select on organizations
  for select using (is_org_member(id));

-- -------------------------------------------------------------
-- roles — offentlig opslagstabel, kun læsning
-- -------------------------------------------------------------
create policy roles_select on roles
  for select using (auth.role() = 'authenticated');

-- -------------------------------------------------------------
-- profiles — man kan altid se/opdatere sin egen profil, samt se
-- profiler for andre medlemmer i samme organisation(er).
-- -------------------------------------------------------------
create policy profiles_select_self on profiles
  for select using (id = auth.uid());

create policy profiles_select_org_members on profiles
  for select using (
    exists (
      select 1 from organization_members me
      join organization_members them on them.organization_id = me.organization_id
      where me.user_id = auth.uid() and me.active = true
        and them.user_id = profiles.id and them.active = true
    )
  );

create policy profiles_update_self on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_insert_self on profiles
  for insert with check (id = auth.uid());

-- -------------------------------------------------------------
-- organization_members — alle medlemmer kan se hinanden.
-- Kun administrator kan invitere, ændre rolle eller deaktivere.
-- -------------------------------------------------------------
create policy org_members_select on organization_members
  for select using (is_org_member(organization_id));

create policy org_members_admin_write on organization_members
  for all using (is_admin(organization_id)) with check (is_admin(organization_id));

-- -------------------------------------------------------------
-- Produkter, kategorier, enheder, butikker, transportindstillinger
-- — kun administrator må oprette/redigere/deaktivere. Alle
-- medlemmer må læse.
-- -------------------------------------------------------------
create policy product_categories_select on product_categories
  for select using (is_org_member(organization_id));
create policy product_categories_admin_write on product_categories
  for insert with check (is_admin(organization_id));
create policy product_categories_admin_update on product_categories
  for update using (is_admin(organization_id)) with check (is_admin(organization_id));
create policy product_categories_admin_delete on product_categories
  for delete using (is_admin(organization_id));

create policy product_units_select on product_units
  for select using (is_org_member(organization_id));
create policy product_units_admin_write on product_units
  for insert with check (is_admin(organization_id));
create policy product_units_admin_update on product_units
  for update using (is_admin(organization_id)) with check (is_admin(organization_id));
create policy product_units_admin_delete on product_units
  for delete using (is_admin(organization_id));

create policy products_select on products
  for select using (is_org_member(organization_id));
create policy products_admin_write on products
  for insert with check (is_admin(organization_id));
create policy products_admin_update on products
  for update using (is_admin(organization_id)) with check (is_admin(organization_id));
create policy products_admin_delete on products
  for delete using (is_admin(organization_id));

create policy stores_select on stores
  for select using (is_org_member(organization_id));
create policy stores_admin_write on stores
  for insert with check (is_admin(organization_id));
create policy stores_admin_update on stores
  for update using (is_admin(organization_id)) with check (is_admin(organization_id));
create policy stores_admin_delete on stores
  for delete using (is_admin(organization_id));

create policy store_locations_select on store_locations
  for select using (is_org_member(organization_id));
create policy store_locations_admin_write on store_locations
  for all using (is_admin(organization_id)) with check (is_admin(organization_id));

create policy delivery_options_select on delivery_options
  for select using (is_org_member(organization_id));
create policy delivery_options_admin_write on delivery_options
  for all using (is_admin(organization_id)) with check (is_admin(organization_id));

create policy travel_cost_settings_select on travel_cost_settings
  for select using (is_org_member(organization_id));
create policy travel_cost_settings_admin_write on travel_cost_settings
  for all using (is_admin(organization_id)) with check (is_admin(organization_id));

-- -------------------------------------------------------------
-- Lager — alle medlemmer må læse og opdatere (regulere lager),
-- men selve opdateringen bør ske via increment_stock()-funktionen
-- (migration 003), så der altid følger en lagerbevægelse med.
-- -------------------------------------------------------------
create policy stock_items_select on stock_items
  for select using (is_org_member(organization_id));
create policy stock_items_member_write on stock_items
  for insert with check (is_org_member(organization_id));
create policy stock_items_member_update on stock_items
  for update using (is_org_member(organization_id)) with check (is_org_member(organization_id));
-- Ingen delete-policy: lagerposter må ikke slettes af klienten.

-- stock_movements er et append-only ledger — kun insert, aldrig
-- update eller delete, så historikken ikke kan forfalskes.
create policy stock_movements_select on stock_movements
  for select using (is_org_member(organization_id));
create policy stock_movements_insert on stock_movements
  for insert with check (is_org_member(organization_id));

-- -------------------------------------------------------------
-- Behov, tilbud, priser — alle medlemmer må læse og skrive.
-- -------------------------------------------------------------
create policy shopping_needs_all on shopping_needs
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create policy offers_all on offers
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create policy offer_prices_all on offer_prices
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create policy price_history_select on price_history
  for select using (is_org_member(organization_id));
create policy price_history_insert on price_history
  for insert with check (is_org_member(organization_id));

-- -------------------------------------------------------------
-- Indkøbslister, reservationer
-- -------------------------------------------------------------
create policy shopping_lists_all on shopping_lists
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create policy shopping_list_items_all on shopping_list_items
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create policy reservations_select on shopping_item_reservations
  for select using (is_org_member(organization_id));
create policy reservations_insert on shopping_item_reservations
  for insert with check (is_org_member(organization_id));
-- Kun den der har reserveret, eller en administrator, må frigive/ændre reservationen.
create policy reservations_update on shopping_item_reservations
  for update using (
    is_org_member(organization_id)
    and (reserved_by = auth.uid() or is_admin(organization_id))
  ) with check (
    is_org_member(organization_id)
    and (reserved_by = auth.uid() or is_admin(organization_id))
  );

-- -------------------------------------------------------------
-- Køb — alle medlemmer må registrere og læse.
-- -------------------------------------------------------------
create policy purchases_select on purchases
  for select using (is_org_member(organization_id));
create policy purchases_insert on purchases
  for insert with check (is_org_member(organization_id));

create policy purchase_items_select on purchase_items
  for select using (is_org_member(organization_id));
create policy purchase_items_insert on purchase_items
  for insert with check (is_org_member(organization_id));

-- -------------------------------------------------------------
-- Arrangementer
-- -------------------------------------------------------------
create policy events_all on events
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy event_requirements_all on event_requirements
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy consumption_history_all on consumption_history
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- -------------------------------------------------------------
-- Ændringslog — kun administrator må læse. Indsættes udelukkende
-- via SECURITY DEFINER-funktioner (migration 003), aldrig direkte
-- fra klienten.
-- -------------------------------------------------------------
create policy audit_log_admin_select on audit_log
  for select using (is_admin(organization_id));

-- -------------------------------------------------------------
-- Notifikationer og vedhæftninger
-- -------------------------------------------------------------
create policy notifications_select on notifications
  for select using (is_org_member(organization_id) and (user_id = auth.uid() or user_id is null));
create policy notifications_insert on notifications
  for insert with check (is_org_member(organization_id));
create policy notifications_update on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy attachments_all on attachments
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
