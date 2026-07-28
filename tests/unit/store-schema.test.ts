import { describe, it, expect } from "vitest";
import { storeSchema } from "@/lib/validation/schemas";

const validBase = {
  name: "Lokal Dagligvare Ebeltoft",
  type: "supermarked" as const,
  address: "Havnevej 12",
  postal_code: "8400",
  city: "Ebeltoft",
  distance_km: 2.4,
  delivery: false,
  delivery_price: 0,
  min_order: 0,
  hours: "08–20"
};

describe("storeSchema", () => {
  it("accepterer en gyldig butik", () => {
    const result = storeSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("afviser et for kort navn", () => {
    const result = storeSchema.safeParse({ ...validBase, name: "A" });
    expect(result.success).toBe(false);
  });

  it("afviser en ukendt butikstype", () => {
    const result = storeSchema.safeParse({ ...validBase, type: "købmand" });
    expect(result.success).toBe(false);
  });

  it("accepterer alle fem gyldige butikstyper", () => {
    for (const type of ["supermarked", "discount", "engros", "specialbutik", "onlinebutik"]) {
      const result = storeSchema.safeParse({ ...validBase, type });
      expect(result.success).toBe(true);
    }
  });

  it("afviser negativ afstand", () => {
    const result = storeSchema.safeParse({ ...validBase, distance_km: -5 });
    expect(result.success).toBe(false);
  });

  it("afviser negativ leveringspris", () => {
    const result = storeSchema.safeParse({ ...validBase, delivery_price: -1 });
    expect(result.success).toBe(false);
  });

  it("afviser negativt minimumskøb", () => {
    const result = storeSchema.safeParse({ ...validBase, min_order: -100 });
    expect(result.success).toBe(false);
  });

  it("afviser en urealistisk høj afstand", () => {
    const result = storeSchema.safeParse({ ...validBase, distance_km: 50000 });
    expect(result.success).toBe(false);
  });

  it("afviser et postnummer, der ikke er 4 cifre", () => {
    const result = storeSchema.safeParse({ ...validBase, postal_code: "84" });
    expect(result.success).toBe(false);
  });

  it("tillader at afstand, adresse, postnummer, by og åbningstider udelades (fx en netbutik)", () => {
    const result = storeSchema.safeParse({
      name: "Aarhus Catering Online",
      type: "onlinebutik",
      delivery: true,
      delivery_price: 99,
      min_order: 500
    });
    expect(result.success).toBe(true);
  });

  it("accepterer 0 som gyldig leveringspris og minimumskøb", () => {
    const result = storeSchema.safeParse({ ...validBase, delivery_price: 0, min_order: 0 });
    expect(result.success).toBe(true);
  });
});
