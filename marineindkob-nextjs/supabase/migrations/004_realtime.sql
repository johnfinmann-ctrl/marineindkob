-- =============================================================
-- MarineIndkøb — Fase 3
-- Migration 004: Realtime
-- =============================================================
-- Aktiverer Supabase Realtime (Postgres logical replication) på de
-- tabeller, hvor flere indkøbere skal se hinandens ændringer med
-- det samme — jf. Fase 3-oplægget, afsnit 12.
-- =============================================================

alter publication supabase_realtime add table shopping_needs;
alter publication supabase_realtime add table shopping_lists;
alter publication supabase_realtime add table shopping_list_items;
alter publication supabase_realtime add table shopping_item_reservations;
alter publication supabase_realtime add table stock_items;
alter publication supabase_realtime add table purchases;
alter publication supabase_realtime add table purchase_items;
alter publication supabase_realtime add table events;

-- Bemærk: hvis "supabase_realtime"-publikationen ikke findes endnu i dit
-- projekt (den oprettes normalt automatisk), kan den oprettes manuelt:
--   create publication supabase_realtime;
-- og herefter tilføjes tabellerne som ovenfor. Du kan også slå Realtime
-- til pr. tabel under Supabase Studio → Database → Replication.
