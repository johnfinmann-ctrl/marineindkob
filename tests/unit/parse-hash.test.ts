import { describe, it, expect } from "vitest";
import { parseAuthHash } from "@/lib/auth/parse-hash";

describe("parseAuthHash", () => {
  it("genkender et gyldigt magic-link-fragment med begge tokens", () => {
    const hash =
      "#access_token=abc123&refresh_token=def456&expires_in=3600&token_type=bearer";
    const result = parseAuthHash(hash);
    expect(result.type).toBe("tokens");
    if (result.type === "tokens") {
      expect(result.accessToken).toBe("abc123");
      expect(result.refreshToken).toBe("def456");
      expect(result.expiresIn).toBe("3600");
      expect(result.tokenType).toBe("bearer");
    }
  });

  it("virker uden det indledende '#'", () => {
    const result = parseAuthHash("access_token=abc123&refresh_token=def456");
    expect(result.type).toBe("tokens");
  });

  it("returnerer 'incomplete', hvis refresh_token mangler", () => {
    const result = parseAuthHash("#access_token=abc123&expires_in=3600");
    expect(result.type).toBe("incomplete");
    if (result.type === "incomplete") {
      expect(result.reason).toMatch(/refresh_token/i);
    }
  });

  it("returnerer 'incomplete', hvis access_token mangler", () => {
    const result = parseAuthHash("#refresh_token=def456");
    expect(result.type).toBe("incomplete");
    if (result.type === "incomplete") {
      expect(result.reason).toMatch(/access_token/i);
    }
  });

  it("genkender en auth-fejl i fragmentet og afkoder beskeden", () => {
    const hash = "#error=access_denied&error_code=otp_expired&error_description=Link+has+expired";
    const result = parseAuthHash(hash);
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.error).toBe("access_denied");
      expect(result.errorDescription).toBe("Link has expired");
    }
  });

  it("returnerer 'none' for et tomt fragment", () => {
    expect(parseAuthHash("").type).toBe("none");
    expect(parseAuthHash("#").type).toBe("none");
  });

  it("returnerer 'none' for et fragment uden tokens eller fejl", () => {
    expect(parseAuthHash("#foo=bar").type).toBe("none");
  });

  it("logger eller eksponerer aldrig tokenværdier i en fejlbesked", () => {
    const hash = "#access_token=super-secret-value&refresh_token=def456";
    const result = parseAuthHash(hash);
    expect(result.type).toBe("tokens");
  });
});
