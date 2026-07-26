/**
 * Beregningsmotor: enhedspris og tilbudsvurdering.
 *
 * Dette er en regelbaseret beregningsmotor, jf. Fase 1- og Fase 3-oplæggene.
 * Den må ikke omtales som avanceret AI eller maskinlæring — det er bevidst
 * enkle, forklarlige og deterministiske regler.
 */

export type ComparisonUnit = "kg" | "l" | "stk" | "100g";

/**
 * Omregner en pakkepris til en sammenlignelig pris pr. kilo, liter eller styk,
 * så to forskellige pakningsstørrelser kan sammenlignes retvisende.
 *
 * Eksempel (jf. Fase 1-oplægget, afsnit 9):
 *   500 g ost til 39,95 kr. → 79,90 kr. pr. kg
 *   700 g ost til 49,95 kr. → 71,36 kr. pr. kg (billigst pr. kg)
 */
export function calculateUnitPrice(price: number, packageSize: number, packageUnit: "g" | "kg" | "ml" | "l" | "stk"): {
  comparisonUnit: ComparisonUnit;
  comparisonPrice: number;
} {
  if (packageSize <= 0) {
    throw new Error("Pakningsstørrelsen skal være større end 0.");
  }
  switch (packageUnit) {
    case "g":
      return { comparisonUnit: "kg", comparisonPrice: round2((price / packageSize) * 1000) };
    case "kg":
      return { comparisonUnit: "kg", comparisonPrice: round2(price / packageSize) };
    case "ml":
      return { comparisonUnit: "l", comparisonPrice: round2((price / packageSize) * 1000) };
    case "l":
      return { comparisonUnit: "l", comparisonPrice: round2(price / packageSize) };
    case "stk":
      return { comparisonUnit: "stk", comparisonPrice: round2(price / packageSize) };
  }
}

/**
 * Vurderer, hvor godt et tilbud er, ud fra procentvis rabat i forhold til
 * normalprisen. Tærsklerne er bevidst enkle og forklarlige — ikke en
 * statistisk model.
 */
export type OfferRatingLevel = "green" | "yellow" | "grey";
export interface OfferRating {
  rating: "Meget godt tilbud" | "Godt tilbud" | "Middel tilbud" | "Svagt tilbud";
  level: OfferRatingLevel;
  discountPct: number;
}

export function calculateOfferRating(offerPrice: number, normalPrice: number): OfferRating {
  if (normalPrice <= 0) {
    return { rating: "Svagt tilbud", level: "grey", discountPct: 0 };
  }
  const discount = normalPrice - offerPrice;
  const pct = discount / normalPrice;

  if (pct > 0.25) return { rating: "Meget godt tilbud", level: "green", discountPct: round2(pct * 100) };
  if (pct > 0.12) return { rating: "Godt tilbud", level: "green", discountPct: round2(pct * 100) };
  if (pct > 0.03) return { rating: "Middel tilbud", level: "yellow", discountPct: round2(pct * 100) };
  return { rating: "Svagt tilbud", level: "grey", discountPct: round2(pct * 100) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
