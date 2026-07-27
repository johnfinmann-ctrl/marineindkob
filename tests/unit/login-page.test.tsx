// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const replaceMock = vi.fn();
const refreshMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock, push: pushMock })
}));

const setSessionMock = vi.fn();
const exchangeCodeForSessionMock = vi.fn();
const signInWithOtpMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      setSession: setSessionMock,
      exchangeCodeForSession: exchangeCodeForSessionMock,
      signInWithOtp: signInWithOtpMock
    }
  })
}));

// Importeres EFTER vi.mock-kaldene, så mocks er på plads, når komponenten indlæses.
const { default: LoginPage } = await import("@/app/(auth)/login/page");

function setUrl(pathAndQuery: string, hash: string = "") {
  window.history.replaceState(null, "", pathAndQuery + hash);
}

describe("Login-siden — PKCE code-flow (primært) og implicit hash-flow (fallback)", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    refreshMock.mockClear();
    pushMock.mockClear();
    setSessionMock.mockReset();
    exchangeCodeForSessionMock.mockReset();
    signInWithOtpMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("udveksler en gyldig PKCE-kode og redirecter til /forside", async () => {
    setUrl("/login?code=abc123");
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: { access_token: "abc" } }, error: null });

    render(<LoginPage />);

    await waitFor(() => {
      expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("abc123");
    });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/forside");
    });
  });

  it("fjerner ?code=... fra adresselinjen, når sessionen er oprettet", async () => {
    setUrl("/login?code=abc123");
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: { access_token: "abc" } }, error: null });

    render(<LoginPage />);

    await waitFor(() => {
      expect(window.location.search).toBe("");
    });
  });

  it("viser en tydelig fejl og redirecter ikke ved en ugyldig/udløbet kode", async () => {
    setUrl("/login?code=expired-code");
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid grant: code expired" }
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(window.location.search).toBe("");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("viser en tydelig fejl ved genbrug af samme kode (Supabase afviser anden udveksling)", async () => {
    setUrl("/login?code=already-used-code");
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid grant: code already used" }
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("viser fejlbeskeden fra /auth/callback, når serveren ikke kunne udveksle koden (?error=login_failed)", async () => {
    setUrl("/login?error=login_failed");

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText(/udløbet|allerede brugt|browser/i)).toBeInTheDocument();
    });
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("viser en tydelig besked, når brugeren er logget ind, men ikke har et aktivt medlemskab (?error=no_membership)", async () => {
    setUrl("/login?error=no_membership");

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/kontakt en administrator/i);
    });
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
  });

  it("prioriterer en PKCE-kode over et samtidigt hash-fragment", async () => {
    setUrl("/login?code=abc123", "#access_token=xxx&refresh_token=yyy");
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: { access_token: "abc" } }, error: null });

    render(<LoginPage />);

    await waitFor(() => {
      expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("abc123");
    });
    expect(setSessionMock).not.toHaveBeenCalled();
  });

  it("falder tilbage til implicit hash-flow, hvis der ikke er nogen kode (bagudkompatibilitet)", async () => {
    setUrl("/login", "#access_token=abc123&refresh_token=def456&expires_in=3600&token_type=bearer");
    setSessionMock.mockResolvedValue({ data: { session: { access_token: "abc123" } }, error: null });

    render(<LoginPage />);

    await waitFor(() => {
      expect(setSessionMock).toHaveBeenCalledWith({
        access_token: "abc123",
        refresh_token: "def456"
      });
    });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/forside");
    });
  });

  it("fjerner tokenfragmentet fra adresselinjen i hash-fallback-flowet", async () => {
    setUrl("/login", "#access_token=abc123&refresh_token=def456");
    setSessionMock.mockResolvedValue({ data: { session: { access_token: "abc123" } }, error: null });

    render(<LoginPage />);

    await waitFor(() => {
      expect(window.location.hash).toBe("");
    });
  });

  it("viser den almindelige login-formular uden at røre e-mailfeltet, når der hverken er kode, fejl eller fragment", async () => {
    setUrl("/login");

    render(<LoginPage />);

    const emailInput = await screen.findByLabelText("E-mail");
    expect(emailInput).toHaveValue("");
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(setSessionMock).not.toHaveBeenCalled();
  });

  it("sender magic link med emailRedirectTo peget på /auth/callback", async () => {
    setUrl("/login");
    signInWithOtpMock.mockResolvedValue({ error: null });

    render(<LoginPage />);
    await screen.findByLabelText("E-mail");

    const emailInput = screen.getByLabelText("E-mail");
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.type(emailInput, "john.finmann@gmail.com");
    await user.click(screen.getByRole("button", { name: /fortsæt/i }));

    await waitFor(() => {
      expect(signInWithOtpMock).toHaveBeenCalledWith({
        email: "john.finmann@gmail.com",
        options: { emailRedirectTo: expect.stringContaining("/auth/callback") }
      });
    });
  });
});
