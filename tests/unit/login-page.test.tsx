// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const replaceMock = vi.fn();
const refreshMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock, push: pushMock })
}));

const setSessionMock = vi.fn();
const signInWithOtpMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      setSession: setSessionMock,
      signInWithOtp: signInWithOtpMock
    }
  })
}));

// Importeres EFTER vi.mock-kaldene, så mocks er på plads, når komponenten indlæses.
const { default: LoginPage } = await import("@/app/(auth)/login/page");

function setHash(hash: string) {
  window.history.replaceState(null, "", "/login" + hash);
}

describe("Login-siden — implicit flow (magic link i URL-fragment)", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    refreshMock.mockClear();
    pushMock.mockClear();
    setSessionMock.mockReset();
    signInWithOtpMock.mockReset();
  });

  it("opretter en session og redirecter til /forside ved gyldige tokens", async () => {
    setHash("#access_token=abc123&refresh_token=def456&expires_in=3600&token_type=bearer");
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

  it("fjerner tokenfragmentet fra adresselinjen, når sessionen er oprettet", async () => {
    setHash("#access_token=abc123&refresh_token=def456");
    setSessionMock.mockResolvedValue({ data: { session: { access_token: "abc123" } }, error: null });

    render(<LoginPage />);

    await waitFor(() => {
      expect(window.location.hash).toBe("");
    });
  });

  it("viser en tydelig fejl og fjerner fragmentet, hvis setSession fejler, uden at redirecte", async () => {
    setHash("#access_token=abc123&refresh_token=def456");
    setSessionMock.mockResolvedValue({ data: { session: null }, error: { message: "invalid token" } });

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(window.location.hash).toBe("");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("viser en fejlbesked ved et auth-fejl-fragment uden at kalde setSession", async () => {
    setHash("#error=access_denied&error_description=Link+has+expired");

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText(/Link has expired/i)).toBeInTheDocument();
    });
    expect(setSessionMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("viser den almindelige login-formular uden at røre e-mailfeltet, når der ikke er noget fragment", async () => {
    setHash("");

    render(<LoginPage />);

    const emailInput = await screen.findByLabelText("E-mail");
    expect(emailInput).toHaveValue("");
    expect(setSessionMock).not.toHaveBeenCalled();
  });
});
