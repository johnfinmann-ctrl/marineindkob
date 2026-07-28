import { describe, it, expect } from "vitest";
import { calculateStoreOptionEconomics } from "@/lib/calculations/travel";

describe("calculateStoreOptionEconomics", () => {
  it("beregner afhentning: varepris + kørsel, og tjekker minimumskøb", () => {
    const result = calculateStoreOptionEconomics({
      itemsTotal: 200,
      store: { delivery: false, distanceKm: 5, deliveryPrice: 0, minOrder: 0 },
      pricePerKm: 3.2
    });
    expect(result.mode).toBe("afhentning");
    expect(result.transportCost).toBeCloseTo(32, 2); // 5 km * 2 * 3.2
    expect(result.totalPrice).toBeCloseTo(232, 2);
    expect(result.meetsMinimumOrder).toBe(true);
  });

  it("beregner levering: varepris + leveringspris, og flager når minimumskøb ikke er nået", () => {
    const result = calculateStoreOptionEconomics({
      itemsTotal: 300,
      store: { delivery: true, distanceKm: null, deliveryPrice: 99, minOrder: 500 },
      pricePerKm: 3.2
    });
    expect(result.mode).toBe("levering");
    expect(result.transportCost).toBe(99);
    expect(result.totalPrice).toBeCloseTo(399, 2);
    expect(result.meetsMinimumOrder).toBe(false);
    expect(result.shortfall).toBeCloseTo(200, 2);
  });

  it("markerer minimumskøb som opfyldt for afhentning, når varetotalen når det", () => {
    const result = calculateStoreOptionEconomics({
      itemsTotal: 300,
      store: { delivery: false, distanceKm: 6.5, deliveryPrice: 0, minOrder: 300 },
      pricePerKm: 3.2
    });
    expect(result.meetsMinimumOrder).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  it("bruger 0 km, hvis en leveringsbutik mod forventning ikke har en afstand sat", () => {
    const result = calculateStoreOptionEconomics({
      itemsTotal: 100,
      store: { delivery: false, distanceKm: null, deliveryPrice: 0, minOrder: 0 },
      pricePerKm: 3.2
    });
    expect(result.transportCost).toBe(0);
    expect(result.totalPrice).toBe(100);
  });

  it("er deterministisk for samme input", () => {
    const input = {
      itemsTotal: 250,
      store: { delivery: true, distanceKm: null, deliveryPrice: 49, minOrder: 300 },
      pricePerKm: 3.2
    };
    expect(calculateStoreOptionEconomics(input)).toEqual(calculateStoreOptionEconomics(input));
  });
});
