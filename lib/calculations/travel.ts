import { round2 } from "./pricing";

/**
 * Beregner kørselsomkostning for en tur-retur til en lokal butik.
 * distanceKm angives som afstand til butikken (ikke tur-retur).
 */
export function calculateTravelCost(distanceKm: number, pricePerKm: number): number {
  if (distanceKm < 0 || pricePerKm < 0) {
    throw new Error("Afstand og pris pr. km skal være 0 eller derover.");
  }
  return round2(distanceKm * 2 * pricePerKm);
}

/**
 * Beregner leveringsomkostning. Hvis ordren er under minimumskøbet, oplyses
 * det tydeligt, så appen kan vise en advarsel frem for en forkert lav pris.
 */
export interface DeliveryCostResult {
  deliveryPrice: number;
  meetsMinimumOrder: boolean;
  shortfall: number;
}

export function calculateDeliveryCost(
  orderTotal: number,
  deliveryPrice: number,
  minOrder: number
): DeliveryCostResult {
  const meetsMinimumOrder = orderTotal >= minOrder;
  return {
    deliveryPrice,
    meetsMinimumOrder,
    shortfall: meetsMinimumOrder ? 0 : round2(minOrder - orderTotal)
  };
}

/**
 * Den reelle totalpris for en indkøbsmulighed: vareprisen plus enten
 * kørsel eller levering — aldrig kun vareprisen alene.
 * Jf. Fase 1-oplægget, afsnit 10: "En vare er ikke billigst, hvis
 * transporten gør det samlede køb dyrere."
 */
export function calculateRealTotalPrice(itemsTotal: number, travelOrDeliveryCost: number): number {
  return round2(itemsTotal + travelOrDeliveryCost);
}

export interface StoreEconomicsInput {
  itemsTotal: number;
  store: {
    delivery: boolean;
    distanceKm: number | null;
    deliveryPrice: number;
    minOrder: number;
  };
  pricePerKm: number;
}

export interface StoreEconomicsResult {
  mode: "afhentning" | "levering";
  transportCost: number;
  totalPrice: number;
  meetsMinimumOrder: boolean;
  shortfall: number;
}

/**
 * Beregner den samlede økonomi for at handle en given vare-total hos en
 * bestemt butik — varepris plus enten kørsel eller levering, og om
 * butikkens minimumskøb er nået. Bruges af indkøbsforslag, jf.
 * Fase 4-oplægget, afsnit 6, så anbefalinger altid viser den reelle
 * totalpris og ikke kun vareprisen.
 */
export function calculateStoreOptionEconomics(input: StoreEconomicsInput): StoreEconomicsResult {
  if (input.store.delivery) {
    const delivery = calculateDeliveryCost(input.itemsTotal, input.store.deliveryPrice, input.store.minOrder);
    return {
      mode: "levering",
      transportCost: delivery.deliveryPrice,
      totalPrice: calculateRealTotalPrice(input.itemsTotal, delivery.deliveryPrice),
      meetsMinimumOrder: delivery.meetsMinimumOrder,
      shortfall: delivery.shortfall
    };
  }

  const transportCost = calculateTravelCost(input.store.distanceKm ?? 0, input.pricePerKm);
  const meetsMinimumOrder = input.itemsTotal >= input.store.minOrder;
  return {
    mode: "afhentning",
    transportCost,
    totalPrice: calculateRealTotalPrice(input.itemsTotal, transportCost),
    meetsMinimumOrder,
    shortfall: meetsMinimumOrder ? 0 : round2(input.store.minOrder - input.itemsTotal)
  };
}
export interface PurchaseOption {
  key: string;
  label: string;
  itemsTotal: number;
  travelOrDeliveryCost: number;
  timeMinutes: number;
}
export interface RankedPurchaseOption extends PurchaseOption {
  total: number;
}

/**
 * Rangerer flere indkøbsmuligheder (fx "lokal butik" vs. "levering") efter
 * reel totalpris og finder billigste, hurtigste og anbefalede løsning.
 * Anbefalingen vægter en lav merpris op mod sparet tid — jf. eksemplet i
 * Fase 2-oplægget, afsnit 11 ("Mulighed A anbefales …").
 */
export function rankPurchaseOptions(options: PurchaseOption[]): {
  ranked: RankedPurchaseOption[];
  cheapestKey: string;
  fastestKey: string;
  recommendedKey: string;
} {
  if (options.length === 0) {
    throw new Error("Der skal angives mindst én indkøbsmulighed.");
  }

  const ranked = options
    .map((o) => ({ ...o, total: calculateRealTotalPrice(o.itemsTotal, o.travelOrDeliveryCost) }))
    .sort((a, b) => a.total - b.total);

  const cheapest = ranked[0]!;
  const fastest = [...ranked].sort((a, b) => a.timeMinutes - b.timeMinutes)[0]!;

  // Anbefaling: vælg den billigste, medmindre en anden mulighed sparer
  // markant tid for en beskeden merpris (under 60 kr. og over 20 minutter sparet).
  let recommended = cheapest;
  for (const opt of ranked) {
    const extraCost = opt.total - cheapest.total;
    const timeSaved = cheapest.timeMinutes - opt.timeMinutes;
    if (opt.key !== cheapest.key && extraCost <= 60 && timeSaved >= 20) {
      recommended = opt;
      break;
    }
  }

  return {
    ranked,
    cheapestKey: cheapest.key,
    fastestKey: fastest.key,
    recommendedKey: recommended.key
  };
}
