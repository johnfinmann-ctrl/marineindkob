import type { RoleCode } from "@/types/database";

/**
 * Rettigheder pr. rolle — jf. Fase 3-oplægget, afsnit 7.
 * Dette er en frontend-bekvemmelighed til at vise/skjule knapper.
 * Den egentlige sikkerhed håndhæves i databasen via Row Level Security
 * og de "security definer"-funktioner, der tjekker rollen selv
 * (se supabase/migrations/002_rls.sql og 003_functions.sql).
 * Denne fil erstatter ALDRIG databasens kontrol — den er kun for UX.
 */

export interface Permissions {
  canManageUsers: boolean;
  canManageProducts: boolean;
  canManageStores: boolean;
  canManageSettings: boolean;
  canResetDemoData: boolean;
  canViewAuditLog: boolean;
  canExportBackup: boolean;
  canDeleteOthersReservation: boolean;
}

export function getPermissions(role: RoleCode): Permissions {
  const isAdmin = role === "administrator";
  return {
    canManageUsers: isAdmin,
    canManageProducts: isAdmin,
    canManageStores: isAdmin,
    canManageSettings: isAdmin,
    canResetDemoData: isAdmin,
    canViewAuditLog: isAdmin,
    canExportBackup: isAdmin,
    canDeleteOthersReservation: isAdmin
  };
}

export function isAdministrator(role: RoleCode): boolean {
  return role === "administrator";
}
