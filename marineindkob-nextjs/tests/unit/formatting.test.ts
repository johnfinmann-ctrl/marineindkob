import { describe, it, expect } from "vitest";
import { formatCurrency, formatDateDMY } from "@/lib/calculations/formatting";

describe("formatCurrency", () => {
  it("formatterer heltal med to decimaler og dansk tusindtalspunktum", () => {
    expect(formatCurrency(1285)).toBe("1.285,00 kr.");
  });

  it("formatterer decimaltal med komma som decimalseparator", () => {
    expect(formatCurrency(34.95)).toBe("34,95 kr.");
  });

  it("runder til to decimaler", () => {
    expect(formatCurrency(19.999)).toBe("20,00 kr.");
  });

  it("håndterer 0 kr. korrekt", () => {
    expect(formatCurrency(0)).toBe("0,00 kr.");
  });
});

describe("formatDateDMY", () => {
  it("formatterer en ISO-dato som dd-MM-yyyy", () => {
    expect(formatDateDMY("2026-08-14")).toBe("14-08-2026");
  });

  it("nulstiller enkeltcifrede dage og måneder korrekt", () => {
    expect(formatDateDMY("2026-01-05")).toBe("05-01-2026");
  });
});
