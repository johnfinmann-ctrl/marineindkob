-- =============================================================
-- MarineIndkøb — Fase 3
-- Migration 001: Skema, tabeller og indekser
-- =============================================================
-- Kør migrationerne i rækkefølge (001, 002, 003, 004) via:
--   supabase db push
-- eller indsæt dem én ad gangen i Supabase Studio → SQL Editor.
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- Organisation og adgang
-- -------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Kun to roller i Fase 3 — se afsnit 7 i Fase 3-oplægget.
create table roles (
  id smallint primary key,
  code text not null unique check (code in ('indkober', 'administrator')),
  name text not null
);
insert into roles (id, code, name) values
  (1, 'indkober', 'Indkøber'),
  (2, 'administrator', 'Administrator');

-- Profiloplysninger, 1:1 med auth.users.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  initials text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Kobling mellem bruger, organisation og rolle. En bruger kan i Fase 3 kun
-- være medlem af én organisation, men modellen tillader flere organisationer
-- pr. bruger på sigt uden ændring af skemaet.
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id smallint not null references roles (id),
  active boolean not null default true,
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index idx_org_members_org on organization_members (organization_id);
create index idx_org_members_user on organization_members (user_id);

-- -------------------------------------------------------------
-- Produkter
-- -------------------------------------------------------------

create table product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz
);
create index idx_product_categories_org on product_categories (organization_id);

create table product_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_product_units_org on product_units (organization_id);

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  category_id uuid references product_categories (id),
  unit_id uuid references product_units (id),
  icon text,
  shelf_life text,
  default_weekly_use numeric(10, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz
);
create index idx_products_org on products (organization_id);

-- -------------------------------------------------------------
-- Butikker
-- -------------------------------------------------------------

create table stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  type text,
  distance_km numeric(6, 2),
  delivery boolean not null default false,
  delivery_price numeric(10, 2) not null default 0,
  min_order numeric(10, 2) not null default 0,
  hours text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz
);
create index idx_stores_org on stores (organization_id);

create table store_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  store_id uuid not null references stores (id) on delete cascade,
  address text,
  lat numeric(9, 6),
  lng numeric(9, 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_store_locations_store on store_locations (store_id);

create table delivery_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  store_id uuid not null references stores (id) on delete cascade,
  label text not null,
  price numeric(10, 2) not null default 0,
  min_order numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_delivery_options_store on delivery_options (store_id);

-- Én transportindstilling pr. organisation (kørselspris m.v.).
create table travel_cost_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations (id) on delete cascade,
  price_per_km numeric(10, 2) not null default 3.20,
  average_speed_kmh numeric(6, 2) not null default 50,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- -------------------------------------------------------------
-- Lager
-- -------------------------------------------------------------

create table stock_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  quantity numeric(10, 2) not null default 0,
  minimum_quantity numeric(10, 2) not null default 0,
  unit_id uuid references product_units (id),
  average_weekly_consumption numeric(10, 2) not null default 0,
  storage_location text,
  expiry_date date,
  last_counted_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  unique (organization_id, product_id)
);
create index idx_stock_items_org on stock_items (organization_id);
create index idx_stock_items_product on stock_items (product_id);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  product_id uuid not null references products (id),
  stock_item_id uuid not null references stock_items (id),
  movement_type text not null check (
    movement_type in ('køb', 'forbrug', 'manuel regulering', 'kassation', 'arrangement', 'korrektion')
  ),
  quantity_delta numeric(10, 2) not null,
  resulting_quantity numeric(10, 2) not null,
  reference_table text,
  reference_id uuid,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create index idx_stock_movements_org on stock_movements (organization_id);
create index idx_stock_movements_product on stock_movements (product_id);
create index idx_stock_movements_created_at on stock_movements (created_at);

-- -------------------------------------------------------------
-- Behov ("Hvad mangler vi?")
-- -------------------------------------------------------------

create table shopping_needs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  product_id uuid not null references products (id),
  current_stock numeric(10, 2) not null default 0,
  min_stock numeric(10, 2) not null default 0,
  typical_use numeric(10, 2) not null default 0,
  need_by_date date,
  priority text not null default 'Middel' check (priority in ('Høj', 'Middel', 'Lav')),
  comment text,
  status text not null default 'Snart' check (status in ('Kritisk', 'Snart', 'Tilbud')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz
);
create index idx_shopping_needs_org on shopping_needs (organization_id);
create index idx_shopping_needs_product on shopping_needs (product_id);
create index idx_shopping_needs_status on shopping_needs (status);

-- -------------------------------------------------------------
-- Tilbud og priser
-- -------------------------------------------------------------

create table offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  product_id uuid not null references products (id),
  store_id uuid not null references stores (id),
  offer_price numeric(10, 2) not null,
  normal_price numeric(10, 2) not null,
  qty numeric(10, 2) not null default 1,
  unit text not null default 'stk',
  start_date date not null,
  end_date date not null,
  max_per_customer integer,
  member_price numeric(10, 2),
  notes text,
  rating text,
  rating_level text check (rating_level in ('green', 'yellow', 'red', 'grey')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  deleted_at timestamptz
);
create index idx_offers_org on offers (organization_id);
create index idx_offers_product on offers (product_id);
create index idx_offers_store on offers (store_id);

create table offer_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  offer_id uuid not null references offers (id) on delete cascade,
  comparison_unit text not null,
  comparison_price numeric(10, 2) not null,
  created_at timestamptz not null default now()
);
create index idx_offer_prices_offer on offer_prices (offer_id);

create table price_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  product_id uuid not null references products (id),
  store_id uuid references stores (id),
  recorded_price numeric(10, 2) not null,
  source text not null check (source in ('offer', 'purchase')),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_price_history_org on price_history (organization_id);
create index idx_price_history_product on price_history (product_id);

-- -------------------------------------------------------------
-- Indkøbslister
-- -------------------------------------------------------------

create table shopping_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null default 'Aktiv indkøbsliste',
  status text not null default 'aktiv' check (status in ('aktiv', 'afsluttet')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create index idx_shopping_lists_org on shopping_lists (organization_id);

create table shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  shopping_list_id uuid not null references shopping_lists (id) on delete cascade,
  product_id uuid not null references products (id),
  store_id uuid references stores (id),
  quantity numeric(10, 2) not null default 1,
  unit_id uuid references product_units (id),
  expected_price numeric(10, 2) not null default 0,
  actual_price numeric(10, 2),
  status text not null default 'behov' check (
    status in ('behov', 'planlagt', 'reserveret', 'i kurv', 'købt', 'ikke fundet', 'erstattet', 'annulleret')
  ),
  priority text default 'Middel',
  reserved_by uuid references auth.users (id),
  purchased_by uuid references auth.users (id),
  purchased_at timestamptz,
  note text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id)
);
create index idx_sli_org on shopping_list_items (organization_id);
create index idx_sli_list on shopping_list_items (shopping_list_id);
create index idx_sli_product on shopping_list_items (product_id);
create index idx_sli_status on shopping_list_items (status);
create index idx_sli_reserved_by on shopping_list_items (reserved_by);

-- -------------------------------------------------------------
-- Reservationer
-- -------------------------------------------------------------

create table shopping_item_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  shopping_list_item_id uuid not null references shopping_list_items (id) on delete cascade,
  reserved_by uuid not null references auth.users (id),
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'aktiv' check (status in ('aktiv', 'frigivet', 'gennemført', 'udløbet')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_reservations_org on shopping_item_reservations (organization_id);
create index idx_reservations_item on shopping_item_reservations (shopping_list_item_id);
create index idx_reservations_reserved_by on shopping_item_reservations (reserved_by);

-- KRITISK: sikrer atomisk reservation på databaseniveau. Kun én aktiv
-- reservation ad gangen pr. vare — et andet forsøg fejler med en
-- unique-constraint-fejl, som appen viser som "allerede reserveret".
create unique index uniq_active_reservation_per_item
  on shopping_item_reservations (shopping_list_item_id)
  where (status = 'aktiv');

-- -------------------------------------------------------------
-- Køb
-- -------------------------------------------------------------

create table purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  store_id uuid references stores (id),
  purchased_by uuid not null references auth.users (id),
  purchased_at timestamptz not null default now(),
  total_price numeric(10, 2) not null default 0,
  saved_amount numeric(10, 2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index idx_purchases_org on purchases (organization_id);
create index idx_purchases_created_at on purchases (created_at);

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  purchase_id uuid not null references purchases (id) on delete cascade,
  product_id uuid not null references products (id),
  shopping_list_item_id uuid references shopping_list_items (id),
  quantity numeric(10, 2) not null,
  unit_price numeric(10, 2) not null,
  line_total numeric(10, 2) not null,
  created_at timestamptz not null default now()
);
create index idx_purchase_items_purchase on purchase_items (purchase_id);
create index idx_purchase_items_product on purchase_items (product_id);

-- -------------------------------------------------------------
-- Arrangementer
-- -------------------------------------------------------------

create table events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  date date not null,
  guests integer not null default 0,
  menu text,
  budget numeric(10, 2) not null default 0,
  prepared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  deleted_at timestamptz
);
create index idx_events_org on events (organization_id);

create table event_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  product_id uuid not null references products (id),
  qty_per_guest numeric(10, 3) not null default 0,
  safety_margin_pct numeric(5, 2) not null default 15,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_event_requirements_event on event_requirements (event_id);

create table consumption_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  event_id uuid references events (id),
  product_id uuid not null references products (id),
  actual_quantity_used numeric(10, 2) not null,
  recorded_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create index idx_consumption_history_org on consumption_history (organization_id);
create index idx_consumption_history_event on consumption_history (event_id);

-- -------------------------------------------------------------
-- System
-- -------------------------------------------------------------

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid references auth.users (id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_log_org on audit_log (organization_id);
create index idx_audit_log_created_at on audit_log (created_at);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid references auth.users (id),
  type text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_org on notifications (organization_id);
create index idx_notifications_user on notifications (user_id);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  related_table text not null,
  related_id uuid not null,
  storage_path text not null,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index idx_attachments_org on attachments (organization_id);
create index idx_attachments_related on attachments (related_table, related_id);
