import { describe, it, expect } from "vitest";
import { canTransitionStatus } from "@/lib/validation/status-transitions";

describe("canTransitionStatus", () => {
  it("tillader et almindeligt flow: behov → reserveret → i kurv → købt", () => {
    expect(canTransitionStatus("behov", "reserveret").allowed).toBe(true);
    expect(canTransitionStatus("reserveret", "i kurv").allowed).toBe(true);
    expect(canTransitionStatus("i kurv", "købt", { hasPurchaseInfo: true }).allowed).toBe(true);
  });

  it("afviser at gå direkte fra 'behov' til 'købt' uden hurtigt køb", () => {
    const result = canTransitionStatus("behov", "købt");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("tillader 'behov' → 'købt', hvis brugeren aktivt vælger hurtigt køb", () => {
    const result = canTransitionStatus("behov", "købt", { quickBuy: true, hasPurchaseInfo: true });
    expect(result.allowed).toBe(true);
  });

  it("tillader 'Fortryd' fra 'købt' tilbage til 'behov'", () => {
    expect(canTransitionStatus("købt", "behov").allowed).toBe(true);
  });

  it("afviser en ugyldig overgang fra 'annulleret' til 'i kurv'", () => {
    const result = canTransitionStatus("annulleret", "i kurv");
    expect(result.allowed).toBe(false);
  });

  it("tillader samme status til samme status (no-op)", () => {
    expect(canTransitionStatus("behov", "behov").allowed).toBe(true);
  });
});
