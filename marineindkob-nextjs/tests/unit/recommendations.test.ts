import { describe, it, expect } from "vitest";
import { calculateRecommendedQuantity, calculateSavings } from "@/lib/calculations/recommendations";

describe("calculateRecommendedQuantity", () => {
  it("anbefaler 'Køb nu' for kaffe-eksemplet (godt tilbud, holder længe)", () => {
    const result = calculateRecommendedQuantity({
      currentStock: 3,
      minStock: 4,
      weeklyUse: 2,
      offerPrice: 34.95,
      normalPrice: 49.95,
      typicalWeeksBetweenOffers: 8,
      isLongLasting: true
    });
    expect(result.type).toBe("kob_nu");
    expect(result.recommendedQty).toBeGreaterThan(0);
    expect(result.certainty).toBe("høj");
  });

  it("anbefaler 'Vent' for karrysild-eksemplet (svagt tilbud, rigeligt lager)", () => {
    const result = calculateRecommendedQuantity({
      currentStock: 5,
      minStock: 4,
      weeklyUse: 1,
      offerPrice: 25.95,
      normalPrice: 26.95,
      typicalWeeksBetweenOffers: 5
    });
    expect(result.type).toBe("vent");
    expect(result.recommendedQty).toBe(0);
  });

  it("anbefaler 'Køb kun det nødvendige' for sild-eksemplet (moderat tilbud, lavt lager)", () => {
    const result = calculateRecommendedQuantity({
      currentStock: 4,
      minStock: 6,
      weeklyUse: 3,
      offerPrice: 24.95,
      normalPrice: 26.95,
      typicalWeeksBetweenOffers: 5
    });
    expect(result.type).toBe("kob_kun_nodvendigt");
    expect(result.recommendedQty).toBeGreaterThan(0);
  });

  it("er deterministisk for samme input", () => {
    const input = { currentStock: 2, minStock: 3, weeklyUse: 1, typicalWeeksBetweenOffers: 4 };
    expect(calculateRecommendedQuantity(input)).toEqual(calculateRecommendedQuantity(input));
  });
});

describe("calculateSavings", () => {
  it("summerer besparelsen for flere købte linjer", () => {
    const savings = calculateSavings([
      { quantity: 8, offerPrice: 34.95, normalPrice: 49.95 },
      { quantity: 4, offerPrice: 24.95, normalPrice: 26.95 }
    ]);
    // (49.95-34.95)*8 + (26.95-24.95)*4 = 120 + 8 = 128
    expect(savings).toBeCloseTo(128, 2);
  });

  it("giver 0 kr. i besparelse, hvis der ikke er nogen rabat", () => {
    expect(calculateSavings([{ quantity: 2, offerPrice: 10, normalPrice: 10 }])).toBe(0);
  });
});
