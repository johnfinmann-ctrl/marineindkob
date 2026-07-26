import { calculateOfferRating } from "./pricing";
import { round2 } from "./pricing";

/**
 * Regelbaseret "Køb nu / Køb kun det nødvendige / Vent"-motor.
 * Jf. Fase 2-oplægget, afsnit 5 og 10 — dette er bevidst enkle,
 * forklarlige regler og ikke en statistisk prognose eller AI-model.
 */
export type RecommendationType = "kob_nu" | "kob_kun_nodvendigt" | "vent";
export type Certainty = "lav" | "middel" | "høj";

export interface RecommendationInput {
  currentStock: number;
  minStock: number;
  weeklyUse: number;
  offerPrice?: number;
  normalPrice?: number;
  typicalWeeksBetweenOffers?: number;
  isLongLasting?: boolean; // holder varen længe (fx tørvarer, spiritus)
}

export interface RecommendationResult {
  type: RecommendationType;
  recommendedQty: number;
  certainty: Certainty;
  reasonKeyFacts: string[];
}

/**
 * Beregner anbefalet indkøbsmængde og en "køb nu / køb kun det nødvendige /
 * vent"-anbefaling ud fra lager, forbrug og tilbudsstyrke.
 *
 * Eksempel (jf. Fase 2-oplægget):
 *   Der er 4 glas sild på lager, minimum er 6, forbrug er 3/uge, og tilbud
 *   plejer at komme hver 4.-6. uge → "Køb kun det nødvendige", ca. 4 glas.
 */
export function calculateRecommendedQuantity(input: RecommendationInput): RecommendationResult {
  const weeksOfStockLeft = input.weeklyUse > 0 ? input.currentStock / input.weeklyUse : Infinity;
  const weeksUntilNextOffer = input.typicalWeeksBetweenOffers ?? 5;

  let discountPct = 0;
  if (input.offerPrice != null && input.normalPrice != null) {
    discountPct = calculateOfferRating(input.offerPrice, input.normalPrice).discountPct;
  }

  // Svagt tilbud (under 5% rabat) og rimeligt lager tilbage → vent på et bedre tilbud.
  if (discountPct > 0 && discountPct < 5 && weeksOfStockLeft >= weeksUntilNextOffer * 0.5) {
    return {
      type: "vent",
      recommendedQty: 0,
      certainty: "middel",
      reasonKeyFacts: [
        `Tilbuddet er kun ${discountPct.toFixed(1).replace(".", ",")} % under normalprisen.`,
        `Lageret rækker cirka ${Math.round(weeksOfStockLeft)} uger.`
      ]
    };
  }

  // Godt tilbud og varen holder længe → køb nu, dæk et helt tilbudsinterval.
  if (discountPct >= 20 && input.isLongLasting) {
    const qty = Math.max(1, Math.round((weeksUntilNextOffer - weeksOfStockLeft) * input.weeklyUse + input.minStock));
    return {
      type: "kob_nu",
      recommendedQty: qty,
      certainty: "høj",
      reasonKeyFacts: [
        "Prisen er blandt de billigste registrerede.",
        `Lageret rækker cirka ${Math.max(0, Math.round(weeksOfStockLeft))} uger.`,
        "Varen holder længe."
      ]
    };
  }

  // Standardtilfælde: køb kun det nødvendige frem til minimum eller næste
  // sandsynlige tilbud, alt efter hvad der kommer først.
  const weeksToCover = Math.min(weeksUntilNextOffer, Math.max(1, weeksUntilNextOffer - weeksOfStockLeft));
  const qty = Math.max(1, Math.round(input.minStock - input.currentStock + weeksToCover * input.weeklyUse * 0.5));
  return {
    type: "kob_kun_nodvendigt",
    recommendedQty: qty,
    certainty: input.typicalWeeksBetweenOffers ? "middel" : "lav",
    reasonKeyFacts: [
      input.typicalWeeksBetweenOffers
        ? `Varen plejer at komme på tilbud hver ${Math.max(1, weeksUntilNextOffer - 1)}.–${weeksUntilNextOffer} uge.`
        : "Der er ikke nok historik til en sikker vurdering endnu.",
      `Lageret rækker cirka ${Math.max(0, Math.round(weeksOfStockLeft))} uger.`
    ]
  };
}

export interface PurchasedLine {
  quantity: number;
  offerPrice: number;
  normalPrice: number;
}

/** Summerer den faktiske besparelse for en liste af købte varer. */
export function calculateSavings(lines: PurchasedLine[]): number {
  return round2(lines.reduce((sum, l) => sum + (l.normalPrice - l.offerPrice) * l.quantity, 0));
}
