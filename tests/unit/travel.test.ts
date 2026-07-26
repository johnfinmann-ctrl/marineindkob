import { describe, it, expect } from "vitest";
import { calculateTravelCost, calculateDeliveryCost, calculateRealTotalPrice, rankPurchaseOptions } from "@/lib/calculations/travel";

describe("calculateTravelCost", () => {
  it("beregner tur-retur kørsel til den lokale butik", () => {
    // Fase 1-eksemplet: 1.250 kr. i varer + 35 kr. i kørsel.
    expect(calculateTravelCost(5.47, 3.2)).toBeCloseTo(35, 0);
  });

  it("kaster en fejl ved negativ afstand", () => {
    expect(() => calculateTravelCost(-1, 3.2)).toThrow();
  });
});

describe("calculateDeliveryCost", () => {
  it("markerer ordren som opfyldt, når minimumskøbet er nået", () => {
    const result = calculateDeliveryCost(600, 99, 500);
    expect(result.meetsMinimumOrder).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  it("beregner manglende beløb, når minimumskøbet ikke er nået", () => {
    const result = calculateDeliveryCost(420, 99, 500);
    expect(result.meetsMinimumOrder).toBe(false);
    expect(result.shortfall).toBe(80);
  });
});

describe("calculateRealTotalPrice + rankPurchaseOptions", () => {
  it("gengiver eksemplet fra Fase 2-oplægget (Mulighed A/B/C, afsnit 11)", () => {
    const options = [
      { key: "A", label: "Lokal butik", itemsTotal: 1250, travelOrDeliveryCost: 35, timeMinutes: 35 },
      { key: "B", label: "Levering fra Aarhus", itemsTotal: 1190, travelOrDeliveryCost: 99, timeMinutes: 0 },
      { key: "C", label: "To lokale butikker", itemsTotal: 1170, travelOrDeliveryCost: 75, timeMinutes: 70 }
    ];

    expect(calculateRealTotalPrice(1250, 35)).toBe(1285);
    expect(calculateRealTotalPrice(1190, 99)).toBe(1289);
    expect(calculateRealTotalPrice(1170, 75)).toBe(1245);

    const { cheapestKey, ranked } = rankPurchaseOptions(options);
    expect(cheapestKey).toBe("C");
    expect(ranked[0]?.total).toBe(1245);
  });

  it("anbefaler ikke automatisk den billigste, hvis en anden sparer markant tid billigt", () => {
    const options = [
      { key: "cheap", label: "Billigst men langsom", itemsTotal: 1000, travelOrDeliveryCost: 0, timeMinutes: 90 },
      { key: "fast", label: "Lidt dyrere men hurtig", itemsTotal: 1020, travelOrDeliveryCost: 0, timeMinutes: 10 }
    ];
    const { recommendedKey } = rankPurchaseOptions(options);
    expect(recommendedKey).toBe("fast");
  });
});
