-- =============================================================
-- MarineIndkøb — Fase 3
-- Migration 003: Funktioner (reservation, køb, lager, audit-log)
-- =============================================================
-- Disse funktioner er "security definer", så de kan skrive til
-- audit_log (som klienten ellers ikke må skrive til direkte) og
-- garantere, at hele forretningsflows er transaktionssikre.
-- De tjekker selv organisationsmedlemskab/rolle, så de er lige så
-- sikre at kalde, som RLS-politikkerne i migration 002.
-- =============================================================

-- -------------------------------------------------------------
-- Intern hjælpefunktion: skriv én linje i ændringsloggen.
-- -------------------------------------------------------------
create or replace function log_audit(
  p_organization_id uuid,
  p_action text,
  p_table_name text,
  p_record_id uuid,
  p_old_values jsonb default null,
  p_new_values jsonb default null
) returns void
language plpgsql
security definer
as $$
begin
  insert into audit_log (organization_id, user_id, action, table_name, record_id, old_values, new_values)
  values (p_organization_id, auth.uid(), p_action, p_table_name, p_record_id, p_old_values, p_new_values);
end;
$$;

-- -------------------------------------------------------------
-- Reservation: "Jeg køber denne"
-- Atomisk pga. det unikke, delvise indeks fra migration 001
-- (uniq_active_reservation_per_item). Et samtidigt andet forsøg
-- fejler med en unique_violation, som vi fanger og oversætter til
-- en tydelig fejlbesked.
-- -------------------------------------------------------------
create or replace function create_reservation(
  p_shopping_list_item_id uuid,
  p_expiry_hours int default 12
) returns shopping_item_reservations
language plpgsql
security definer
as $$
declare
  v_org_id uuid;
  v_reservation shopping_item_reservations;
begin
  select organization_id into v_org_id
  from shopping_list_items
  where id = p_shopping_list_item_id;

  if v_org_id is null then
    raise exception 'Varen findes ikke på indkøbslisten.';
  end if;

  if not is_org_member(v_org_id) then
    raise exception 'Du har ikke adgang til denne organisation.';
  end if;

  begin
    insert into shopping_item_reservations (
      organization_id, shopping_list_item_id, reserved_by, expires_at, status
    ) values (
      v_org_id, p_shopping_list_item_id, auth.uid(), now() + make_interval(hours => p_expiry_hours), 'aktiv'
    )
    returning * into v_reservation;
  exception
    when unique_violation then
      raise exception 'Varen er allerede reserveret af en anden indkøber. Prøv en anden vare, eller vent til reservationen frigives.';
  end;

  update shopping_list_items
  set status = 'reserveret', reserved_by = auth.uid(), updated_at = now(), version = version + 1
  where id = p_shopping_list_item_id;

  perform log_audit(v_org_id, 'vare reserveret', 'shopping_list_items', p_shopping_list_item_id, null,
    jsonb_build_object('reserved_by', auth.uid(), 'reservation_id', v_reservation.id));

  return v_reservation;
end;
$$;

-- -------------------------------------------------------------
-- Frigiv reservation — brugeren selv eller administrator.
-- -------------------------------------------------------------
create or replace function release_reservation(
  p_reservation_id uuid
) returns void
language plpgsql
security definer
as $$
declare
  v_res shopping_item_reservations;
begin
  select * into v_res from shopping_item_reservations where id = p_reservation_id;

  if v_res is null then
    raise exception 'Reservationen findes ikke.';
  end if;

  if not (v_res.reserved_by = auth.uid() or is_admin(v_res.organization_id)) then
    raise exception 'Kun den, der har reserveret varen, eller en administrator, kan frigive den.';
  end if;

  update shopping_item_reservations
  set status = 'frigivet', updated_at = now()
  where id = p_reservation_id;

  update shopping_list_items
  set status = 'behov', reserved_by = null, updated_at = now(), version = version + 1
  where id = v_res.shopping_list_item_id;

  perform log_audit(v_res.organization_id, 'reservation frigivet', 'shopping_list_items',
    v_res.shopping_list_item_id, null, jsonb_build_object('reservation_id', p_reservation_id));
end;
$$;

-- -------------------------------------------------------------
-- Manuel lagerregulering (fx +/- knapperne på Lager-skærmen).
-- Enhver lagerændring registreres samtidig som en stock_movement,
-- så det aktuelle lager aldrig kan ændres "usporet".
-- Optimistisk concurrency: kald med den version, klienten sidst så.
-- Hvis den ikke matcher, er data ændret af en anden bruger imens.
-- -------------------------------------------------------------
create or replace function adjust_stock(
  p_organization_id uuid,
  p_product_id uuid,
  p_delta numeric,
  p_movement_type text,
  p_expected_version int default null,
  p_note text default null
) returns stock_items
language plpgsql
security definer
as $$
declare
  v_item stock_items;
  v_new_qty numeric;
begin
  if not is_org_member(p_organization_id) then
    raise exception 'Du har ikke adgang til denne organisation.';
  end if;

  select * into v_item from stock_items
  where organization_id = p_organization_id and product_id = p_product_id
  for update;

  if v_item is null then
    raise exception 'Produktet har ingen lagerpost endnu.';
  end if;

  if p_expected_version is not null and v_item.version <> p_expected_version then
    raise exception 'Varen er blevet ændret af en anden bruger. Hent den nyeste version og prøv igen.';
  end if;

  v_new_qty := greatest(0, v_item.quantity + p_delta);

  update stock_items
  set quantity = v_new_qty, version = version + 1, updated_at = now(), updated_by = auth.uid()
  where id = v_item.id;

  insert into stock_movements (
    organization_id, product_id, stock_item_id, movement_type, quantity_delta, resulting_quantity, note, created_by
  ) values (
    p_organization_id, p_product_id, v_item.id, p_movement_type, p_delta, v_new_qty, p_note, auth.uid()
  );

  perform log_audit(p_organization_id, 'lager reguleret', 'stock_items', v_item.id,
    jsonb_build_object('quantity', v_item.quantity),
    jsonb_build_object('quantity', v_new_qty, 'movement_type', p_movement_type));

  select * into v_item from stock_items where id = v_item.id;
  return v_item;
end;
$$;

-- -------------------------------------------------------------
-- Registrér gennemført køb — hele "Fase 3, afsnit 16"-flowet i én
-- transaktion. Fejler ét trin, ruller hele købet tilbage, så et
-- køb aldrig fremstår som gennemført, hvis lageret ikke kunne
-- opdateres.
--
-- p_items er en JSON-liste, fx:
-- [{"shopping_list_item_id": "...", "product_id": "...",
--   "quantity": 4, "unit_price": 24.95}, ...]
-- -------------------------------------------------------------
create or replace function record_purchase(
  p_organization_id uuid,
  p_store_id uuid,
  p_items jsonb
) returns purchases
language plpgsql
security definer
as $$
declare
  v_purchase purchases;
  v_item jsonb;
  v_stock_item stock_items;
  v_new_qty numeric;
  v_total numeric := 0;
  v_line_total numeric;
  v_reservation shopping_item_reservations;
begin
  if not is_org_member(p_organization_id) then
    raise exception 'Du har ikke adgang til denne organisation.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Der er ingen varer at registrere som købt.';
  end if;

  insert into purchases (organization_id, store_id, purchased_by, total_price, saved_amount)
  values (p_organization_id, p_store_id, auth.uid(), 0, 0)
  returning * into v_purchase;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_line_total := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric;
    v_total := v_total + v_line_total;

    insert into purchase_items (
      organization_id, purchase_id, product_id, shopping_list_item_id, quantity, unit_price, line_total
    ) values (
      p_organization_id, v_purchase.id, (v_item->>'product_id')::uuid,
      (v_item->>'shopping_list_item_id')::uuid, (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric, v_line_total
    );

    -- Opdatér lager + registrér lagerbevægelse
    select * into v_stock_item from stock_items
    where organization_id = p_organization_id and product_id = (v_item->>'product_id')::uuid
    for update;

    if v_stock_item is null then
      raise exception 'Produkt % har ingen lagerpost. Køb kan ikke gennemføres.', (v_item->>'product_id');
    end if;

    v_new_qty := v_stock_item.quantity + (v_item->>'quantity')::numeric;

    update stock_items
    set quantity = v_new_qty, version = version + 1, updated_at = now(), updated_by = auth.uid()
    where id = v_stock_item.id;

    insert into stock_movements (
      organization_id, product_id, stock_item_id, movement_type, quantity_delta, resulting_quantity,
      reference_table, reference_id, created_by
    ) values (
      p_organization_id, (v_item->>'product_id')::uuid, v_stock_item.id, 'køb',
      (v_item->>'quantity')::numeric, v_new_qty, 'purchases', v_purchase.id, auth.uid()
    );

    -- Marker indkøbslistevaren som købt
    update shopping_list_items
    set status = 'købt', purchased_by = auth.uid(), purchased_at = now(),
        actual_price = (v_item->>'unit_price')::numeric, updated_at = now(), version = version + 1
    where id = (v_item->>'shopping_list_item_id')::uuid;

    -- Marker en evt. aktiv reservation som gennemført
    select * into v_reservation from shopping_item_reservations
    where shopping_list_item_id = (v_item->>'shopping_list_item_id')::uuid and status = 'aktiv';

    if v_reservation is not null then
      update shopping_item_reservations
      set status = 'gennemført', updated_at = now()
      where id = v_reservation.id;
    end if;

    perform log_audit(p_organization_id, 'køb registreret', 'shopping_list_items',
      (v_item->>'shopping_list_item_id')::uuid, null,
      jsonb_build_object('purchase_id', v_purchase.id, 'quantity', v_item->>'quantity'));
  end loop;

  update purchases set total_price = v_total where id = v_purchase.id;

  perform log_audit(p_organization_id, 'købstur afsluttet', 'purchases', v_purchase.id, null,
    jsonb_build_object('total_price', v_total, 'item_count', jsonb_array_length(p_items)));

  select * into v_purchase from purchases where id = v_purchase.id;
  return v_purchase;
end;
$$;

-- -------------------------------------------------------------
-- Administrator: deaktivér en bruger. Verificeres i databasen,
-- ikke kun i brugerfladen.
-- -------------------------------------------------------------
create or replace function deactivate_member(
  p_member_id uuid
) returns void
language plpgsql
security definer
as $$
declare
  v_member organization_members;
begin
  select * into v_member from organization_members where id = p_member_id;
  if v_member is null then
    raise exception 'Medlemmet findes ikke.';
  end if;

  if not is_admin(v_member.organization_id) then
    raise exception 'Kun en administrator kan deaktivere en bruger.';
  end if;

  update organization_members set active = false, updated_at = now() where id = p_member_id;

  perform log_audit(v_member.organization_id, 'bruger deaktiveret', 'organization_members', p_member_id,
    jsonb_build_object('active', true), jsonb_build_object('active', false));
end;
$$;

-- -------------------------------------------------------------
-- Administrator: skift rolle for et medlem.
-- -------------------------------------------------------------
create or replace function set_member_role(
  p_member_id uuid,
  p_role_code text
) returns void
language plpgsql
security definer
as $$
declare
  v_member organization_members;
  v_role_id smallint;
begin
  select * into v_member from organization_members where id = p_member_id;
  if v_member is null then
    raise exception 'Medlemmet findes ikke.';
  end if;

  if not is_admin(v_member.organization_id) then
    raise exception 'Kun en administrator kan ændre en brugers rolle.';
  end if;

  select id into v_role_id from roles where code = p_role_code;
  if v_role_id is null then
    raise exception 'Ukendt rolle: %', p_role_code;
  end if;

  update organization_members set role_id = v_role_id, updated_at = now() where id = p_member_id;

  perform log_audit(v_member.organization_id, 'rolle ændret', 'organization_members', p_member_id,
    jsonb_build_object('role_id', v_member.role_id), jsonb_build_object('role_id', v_role_id));
end;
$$;

-- -------------------------------------------------------------
-- Planlagt job (kør via Supabase Cron / pg_cron eller manuelt):
-- markér udløbne reservationer og frigiv varen igen.
-- -------------------------------------------------------------
create or replace function expire_stale_reservations() returns integer
language plpgsql
security definer
as $$
declare
  v_count integer := 0;
  v_res record;
begin
  for v_res in
    select * from shopping_item_reservations
    where status = 'aktiv' and expires_at < now()
  loop
    update shopping_item_reservations set status = 'udløbet', updated_at = now() where id = v_res.id;
    update shopping_list_items set status = 'behov', reserved_by = null, updated_at = now(), version = version + 1
    where id = v_res.shopping_list_item_id;
    perform log_audit(v_res.organization_id, 'reservation udløbet', 'shopping_list_items',
      v_res.shopping_list_item_id, null, jsonb_build_object('reservation_id', v_res.id));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
