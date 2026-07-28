/**
 * Håndskrevne typer for de tabeller, appen bruger aktivt.
 *
 * Når projektet er koblet til et rigtigt Supabase-projekt, anbefales det at
 * erstatte denne fil med autogenererede typer:
 *
 *   npx supabase gen types typescript --project-id <dit-projekt-id> > types/database.ts
 *
 * Indtil da dækker denne fil de tabeller og felter, som frontend-koden i
 * dette projekt rent faktisk læser og skriver.
 */

export type Priority = "Høj" | "Middel" | "Lav";
export type NeedStatus = "Kritisk" | "Snart" | "Tilbud";
export type ListItemStatus =
  | "behov"
  | "planlagt"
  | "reserveret"
  | "i kurv"
  | "købt"
  | "ikke fundet"
  | "erstattet"
  | "annulleret";
export type ReservationStatus = "aktiv" | "frigivet" | "gennemført" | "udløbet";
export type MovementType = "køb" | "forbrug" | "manuel regulering" | "kassation" | "arrangement" | "korrektion";
export type RoleCode = "indkober" | "administrator";
export type StoreType = "supermarked" | "discount" | "engros" | "specialbutik" | "onlinebutik";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string };
        Update: Partial<{ name: string }>;
      };
      roles: {
        Row: { id: number; code: RoleCode; name: string };
        Insert: never;
        Update: never;
      };
      profiles: {
        Row: { id: string; full_name: string; initials: string; created_at: string; updated_at: string };
        Insert: { id: string; full_name: string; initials: string };
        Update: Partial<{ full_name: string; initials: string }>;
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role_id: number;
          active: boolean;
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          role_id: number;
          active?: boolean;
          invited_by?: string | null;
        };
        Update: Partial<{ role_id: number; active: boolean }>;
      };
      product_categories: {
        Row: { id: string; organization_id: string; name: string; deleted_at: string | null };
        Insert: { organization_id: string; name: string; created_by?: string };
        Update: Partial<{ name: string; deleted_at: string | null }>;
      };
      product_units: {
        Row: { id: string; organization_id: string; code: string; name: string };
        Insert: { organization_id: string; code: string; name: string };
        Update: Partial<{ code: string; name: string }>;
      };
      products: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          category_id: string | null;
          unit_id: string | null;
          icon: string | null;
          shelf_life: string | null;
          default_weekly_use: number;
          active: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          name: string;
          category_id?: string | null;
          unit_id?: string | null;
          icon?: string | null;
          shelf_life?: string | null;
          default_weekly_use?: number;
          created_by?: string;
          updated_by?: string;
        };
        Update: Partial<{
          name: string;
          category_id: string | null;
          unit_id: string | null;
          icon: string | null;
          shelf_life: string | null;
          default_weekly_use: number;
          active: boolean;
          deleted_at: string | null;
        }>;
      };
      stores: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          type: StoreType | null;
          address: string | null;
          postal_code: string | null;
          city: string | null;
          distance_km: number | null;
          delivery: boolean;
          delivery_price: number;
          min_order: number;
          hours: string | null;
          active: boolean;
          deleted_at: string | null;
        };
        Insert: {
          organization_id: string;
          name: string;
          type?: StoreType | null;
          address?: string | null;
          postal_code?: string | null;
          city?: string | null;
          distance_km?: number | null;
          delivery?: boolean;
          delivery_price?: number;
          min_order?: number;
          hours?: string | null;
          created_by?: string;
          updated_by?: string;
        };
        Update: Partial<{
          name: string;
          type: StoreType | null;
          address: string | null;
          postal_code: string | null;
          city: string | null;
          distance_km: number | null;
          delivery: boolean;
          delivery_price: number;
          min_order: number;
          hours: string | null;
          active: boolean;
          deleted_at: string | null;
        }>;
      };
      travel_cost_settings: {
        Row: { id: string; organization_id: string; price_per_km: number; average_speed_kmh: number };
        Insert: { organization_id: string; price_per_km?: number; average_speed_kmh?: number };
        Update: Partial<{ price_per_km: number; average_speed_kmh: number }>;
      };
      stock_items: {
        Row: {
          id: string;
          organization_id: string;
          product_id: string;
          quantity: number;
          minimum_quantity: number;
          unit_id: string | null;
          average_weekly_consumption: number;
          storage_location: string | null;
          expiry_date: string | null;
          last_counted_at: string | null;
          version: number;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          product_id: string;
          quantity?: number;
          minimum_quantity?: number;
          unit_id?: string | null;
          average_weekly_consumption?: number;
          updated_by?: string;
        };
        Update: Partial<{
          quantity: number;
          minimum_quantity: number;
          average_weekly_consumption: number;
          storage_location: string | null;
          expiry_date: string | null;
          version: number;
        }>;
      };
      stock_movements: {
        Row: {
          id: string;
          organization_id: string;
          product_id: string;
          stock_item_id: string;
          movement_type: MovementType;
          quantity_delta: number;
          resulting_quantity: number;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          organization_id: string;
          product_id: string;
          stock_item_id: string;
          movement_type: MovementType;
          quantity_delta: number;
          resulting_quantity: number;
          note?: string | null;
          created_by?: string;
        };
        Update: never;
      };
      shopping_needs: {
        Row: {
          id: string;
          organization_id: string;
          product_id: string;
          current_stock: number;
          min_stock: number;
          typical_use: number;
          need_by_date: string | null;
          priority: Priority;
          comment: string | null;
          status: NeedStatus;
          deleted_at: string | null;
        };
        Insert: {
          organization_id: string;
          product_id: string;
          current_stock?: number;
          min_stock?: number;
          typical_use?: number;
          need_by_date?: string | null;
          priority?: Priority;
          comment?: string | null;
          status?: NeedStatus;
          created_by?: string;
          updated_by?: string;
        };
        Update: Partial<{
          current_stock: number;
          min_stock: number;
          typical_use: number;
          need_by_date: string | null;
          priority: Priority;
          comment: string | null;
          status: NeedStatus;
          deleted_at: string | null;
        }>;
      };
      offers: {
        Row: {
          id: string;
          organization_id: string;
          product_id: string;
          store_id: string;
          offer_price: number;
          normal_price: number;
          qty: number;
          unit: string;
          start_date: string;
          end_date: string;
          max_per_customer: number | null;
          member_price: number | null;
          notes: string | null;
          rating: string | null;
          rating_level: "green" | "yellow" | "red" | "grey" | null;
        };
        Insert: {
          organization_id: string;
          product_id: string;
          store_id: string;
          offer_price: number;
          normal_price: number;
          qty?: number;
          unit?: string;
          start_date: string;
          end_date: string;
          max_per_customer?: number | null;
          member_price?: number | null;
          notes?: string | null;
          rating?: string | null;
          rating_level?: "green" | "yellow" | "red" | "grey" | null;
          created_by?: string;
        };
        Update: Partial<{ notes: string | null; deleted_at: string | null }>;
      };
      shopping_lists: {
        Row: { id: string; organization_id: string; name: string; status: "aktiv" | "afsluttet" };
        Insert: { organization_id: string; name?: string; created_by?: string };
        Update: Partial<{ name: string; status: "aktiv" | "afsluttet" }>;
      };
      shopping_list_items: {
        Row: {
          id: string;
          organization_id: string;
          shopping_list_id: string;
          product_id: string;
          store_id: string | null;
          quantity: number;
          expected_price: number;
          actual_price: number | null;
          status: ListItemStatus;
          priority: string | null;
          reserved_by: string | null;
          purchased_by: string | null;
          purchased_at: string | null;
          note: string | null;
          version: number;
        };
        Insert: {
          organization_id: string;
          shopping_list_id: string;
          product_id: string;
          store_id?: string | null;
          quantity?: number;
          expected_price?: number;
          status?: ListItemStatus;
          created_by?: string;
          updated_by?: string;
        };
        Update: Partial<{
          quantity: number;
          store_id: string | null;
          expected_price: number;
          actual_price: number | null;
          status: ListItemStatus;
          reserved_by: string | null;
          purchased_by: string | null;
          purchased_at: string | null;
          note: string | null;
          version: number;
        }>;
      };
      shopping_item_reservations: {
        Row: {
          id: string;
          organization_id: string;
          shopping_list_item_id: string;
          reserved_by: string;
          reserved_at: string;
          expires_at: string;
          status: ReservationStatus;
        };
        Insert: never; // oprettes udelukkende via create_reservation()
        Update: never;
      };
      purchases: {
        Row: {
          id: string;
          organization_id: string;
          store_id: string | null;
          purchased_by: string;
          purchased_at: string;
          total_price: number;
          saved_amount: number;
          note: string | null;
        };
        Insert: never; // oprettes udelukkende via record_purchase()
        Update: never;
      };
      purchase_items: {
        Row: {
          id: string;
          organization_id: string;
          purchase_id: string;
          product_id: string;
          shopping_list_item_id: string | null;
          quantity: number;
          unit_price: number;
          line_total: number;
        };
        Insert: never;
        Update: never;
      };
      events: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          date: string;
          guests: number;
          menu: string | null;
          budget: number;
          prepared: boolean;
          deleted_at: string | null;
        };
        Insert: {
          organization_id: string;
          name: string;
          date: string;
          guests?: number;
          menu?: string | null;
          budget?: number;
          created_by?: string;
          updated_by?: string;
        };
        Update: Partial<{ name: string; date: string; guests: number; menu: string | null; budget: number; prepared: boolean }>;
      };
      audit_log: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          action: string;
          table_name: string;
          record_id: string | null;
          old_values: Record<string, unknown> | null;
          new_values: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: never; // oprettes udelukkende via log_audit()
        Update: never;
      };
    };
    Functions: {
      create_reservation: {
        Args: { p_shopping_list_item_id: string; p_expiry_hours?: number };
        Returns: Database["public"]["Tables"]["shopping_item_reservations"]["Row"];
      };
      release_reservation: {
        Args: { p_reservation_id: string };
        Returns: void;
      };
      adjust_stock: {
        Args: {
          p_organization_id: string;
          p_product_id: string;
          p_delta: number;
          p_movement_type: MovementType;
          p_expected_version?: number;
          p_note?: string;
        };
        Returns: Database["public"]["Tables"]["stock_items"]["Row"];
      };
      record_purchase: {
        Args: { p_organization_id: string; p_store_id: string; p_items: unknown };
        Returns: Database["public"]["Tables"]["purchases"]["Row"];
      };
      deactivate_member: { Args: { p_member_id: string }; Returns: void };
      set_member_role: { Args: { p_member_id: string; p_role_code: RoleCode }; Returns: void };
      is_admin: { Args: { check_org_id: string }; Returns: boolean };
      is_org_member: { Args: { check_org_id: string }; Returns: boolean };
    };
  };
}
