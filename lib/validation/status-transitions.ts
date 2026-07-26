import type { ListItemStatus } from "@/types/database";

/**
 * Gyldige statusovergange for en indkøbslistevare — jf. Fase 3-oplægget,
 * afsnit 17: "En vare må ikke gå direkte fra behov til købt uden at
 * registrere de nødvendige købsoplysninger, medmindre brugeren aktivt
 * vælger et hurtigt køb-flow."
 *
 * "quickBuy" tillader netop dette bevidste hurtige flow (fx når en bruger
 * straks markerer en vare som købt uden at gå via reservation).
 */
const ALLOWED_TRANSITIONS: Record<ListItemStatus, ListItemStatus[]> = {
  behov: ["planlagt", "reserveret", "købt", "annulleret"],
  planlagt: ["reserveret", "i kurv", "købt", "behov", "annulleret"],
  reserveret: ["i kurv", "købt", "ikke fundet", "erstattet", "behov", "annulleret"],
  "i kurv": ["købt", "ikke fundet", "erstattet", "behov"],
  købt: ["behov"], // "Fortryd" i Fase 2-prototypen
  "ikke fundet": ["behov", "erstattet", "annulleret"],
  erstattet: ["behov"],
  annulleret: ["behov"]
};

export interface StatusTransitionCheck {
  allowed: boolean;
  reason?: string;
}

export function canTransitionStatus(
  from: ListItemStatus,
  to: ListItemStatus,
  opts?: { quickBuy?: boolean; hasPurchaseInfo?: boolean }
): StatusTransitionCheck {
  if (from === to) return { allowed: true };

  if (to === "købt" && from === "behov" && !opts?.quickBuy) {
    return {
      allowed: false,
      reason:
        "En vare kan ikke markeres som købt direkte fra 'behov' uden butik og pris, medmindre hurtigt køb bruges bevidst."
    };
  }

  if (to === "købt" && !opts?.hasPurchaseInfo && !opts?.quickBuy) {
    return { allowed: false, reason: "Angiv butik og pris, før varen markeres som købt." };
  }

  const allowedTargets = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowedTargets.includes(to)) {
    return { allowed: false, reason: `Kan ikke skifte status fra "${from}" til "${to}".` };
  }

  return { allowed: true };
}
