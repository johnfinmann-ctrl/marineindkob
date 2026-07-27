import { describe, it, expect } from "vitest";
import { parseAuthQuery } from "@/lib/auth/parse-query";

describe("parseAuthQuery", () => {
  it("genkender en gyldig PKCE-kode i query-strengen", () => {
    const result = parseAuthQuery("?code=abc123");
    expect(result.type).toBe("code");
    if (result.type === "code") {
      expect(result.code).toBe("abc123");
    }
  });

  it("virker uden det indledende '?'", () => {
    const result = parseAuthQuery("code=xyz789");
    expect(result.type).toBe("code");
  });

  it("genkender error=login_failed og giver en dansk, brugervenlig besked", () => {
    const result = parseAuthQuery("?error=login_failed");
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.error).toBe("login_failed");
      expect(result.errorDescription).toMatch(/udløbet|allerede brugt|browser/i);
    }
  });

  it("genkender error=no_membership og giver en dansk, brugervenlig besked", () => {
    const result = parseAuthQuery("?error=no_membership");
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.errorDescription).toMatch(/Ebeltoft Marineforening/i);
    }
  });

  it("bruger error_description fra query-strengen, hvis den findes", () => {
    const result = parseAuthQuery("?error=access_denied&error_description=Code+has+expired");
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.errorDescription).toBe("Code has expired");
    }
  });

  it("returnerer 'none' for en tom query-streng", () => {
    expect(parseAuthQuery("").type).toBe("none");
    expect(parseAuthQuery("?").type).toBe("none");
  });

  it("returnerer 'none' for en query-streng uden code eller error", () => {
    expect(parseAuthQuery("?next=/forside").type).toBe("none");
  });

  it("prioriterer 'error' over 'code', hvis begge mod forventning skulle være til stede", () => {
    const result = parseAuthQuery("?code=abc123&error=login_failed");
    expect(result.type).toBe("error");
  });
});
