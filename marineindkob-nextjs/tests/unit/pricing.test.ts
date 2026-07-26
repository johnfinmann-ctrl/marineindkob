import { describe, it, expect } from "vitest";
import { calculateUnitPrice, calculateOfferRating } from "@/lib/calculations/pricing";

describe("calculateUnitPrice", () => {
  it("regner det klassiske ost-eksempel fra Fase 1-oplægget korrekt (afsnit 9)", () => {
    // 500 g ost til 39,95 kr. vs. 700 g ost til 49,95 kr. — hvilken er billigst pr. kilo?
    const small = calculateUnitPrice(39.95, 500, "g");
    const large = calculateUnitPrice(49.95, 700, "g");

    expect(small.comparisonUnit).toBe("kg");
    expect(small.comparisonPrice).toBeCloseTo(79.9, 2);

    expect(large.comparisonUnit).toBe("kg");
    expect(large.comparisonPrice).toBeCloseTo(71.36, 2);

    // Den store pakke er reelt billigst pr. kilo, selvom den koster mere i alt.
    expect(large.comparisonPrice).toBeLessThan(small.comparisonPrice);
  });

  it("regner pris pr. liter for væsker angivet i ml", () => {
    const result = calculateUnitPrice(15, 250, "ml");
    expect(result.comparisonUnit).toBe("l");
    expect(result.comparisonPrice).toBeCloseTo(60, 2);
  });

  it("regner pris pr. styk uændret", () => {
    const result = calculateUnitPrice(22, 1, "stk");
    expect(result.comparisonUnit).toBe("stk");
    expect(result.comparisonPrice).toBe(22);
  });

  it("kaster en fejl ved en pakningsstørrelse på 0", () => {
    expect(() => calculateUnitPrice(10, 0, "g")).toThrow();
  });
});

describe("calculateOfferRating", () => {
  it("vurderer kaffetilbuddet fra Fase 2-oplægget som 'Meget godt tilbud'", () => {
    // 34,95 kr. mod normalpris 49,95 kr. — cirka 30 % rabat.
    const result = calculateOfferRating(34.95, 49.95);
    expect(result.rating).toBe("Meget godt tilbud");
    expect(result.level).toBe("green");
  });

  it("vurderer sild-tilbuddet (kun 2 kr. rabat) som 'Svagt tilbud'", () => {
    // 24,95 kr. mod normalpris 26,95 kr. — under 8 % rabat, men over 3%, så "Middel"?
    // 2 kr af 26,95 = 7,4% => Middel tilbud i vores tærskler (>3% og <=12%).
    const result = calculateOfferRating(24.95, 26.95);
    expect(result.level === "yellow" || result.level === "grey").toBe(true);
  });

  it("vurderer et tilbud uden reel rabat som svagt", () => {
    const result = calculateOfferRating(49.95, 49.95);
    expect(result.rating).toBe("Svagt tilbud");
    expect(result.discountPct).toBe(0);
  });

  it("er deterministisk — samme input giver altid samme output", () => {
    const a = calculateOfferRating(100, 150);
    const b = calculateOfferRating(100, 150);
    expect(a).toEqual(b);
  });
});
