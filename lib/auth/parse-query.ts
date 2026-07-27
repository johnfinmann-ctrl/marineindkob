/**
 * Parser query-strengen ("?code=...", eller "?error=...") som Supabase Auth
 * returnerer ved PKCE code-flow, samt de fejlparametre, som
 * /auth/callback-routen selv tilføjer, hvis code-udvekslingen fejlede
 * server-side. Ren funktion uden DOM-afhængigheder, så den er let at teste.
 *
 * Bemærk: koden er et engangs-token og må ALDRIG logges. Denne funktion
 * returnerer den kun til kalderen, som er ansvarlig for at bruge den med
 * det samme og aldrig skrive den til konsol eller andre logs.
 */

export interface AuthQueryCode {
  type: "code";
  code: string;
}

export interface AuthQueryError {
  type: "error";
  error: string;
  errorDescription: string;
}

export interface AuthQueryNone {
  type: "none";
}

export type ParsedAuthQuery = AuthQueryCode | AuthQueryError | AuthQueryNone;

/**
 * @param search Den rå window.location.search, inklusive det indledende "?" (må også kaldes uden "?").
 */
export function parseAuthQuery(search: string): ParsedAuthQuery {
  const clean = search.startsWith("?") ? search.slice(1) : search;
  if (!clean) {
    return { type: "none" };
  }

  const params = new URLSearchParams(clean);

  const error = params.get("error");
  if (error) {
    const description =
      params.get("error_description") ?? describeKnownError(error);
    return {
      type: "error",
      error,
      errorDescription: decodeURIComponent(description.replace(/\+/g, " "))
    };
  }

  const code = params.get("code");
  if (code) {
    return { type: "code", code };
  }

  return { type: "none" };
}

/**
 * /auth/callback-routen kan videresende en kort fejlkode (fx
 * "login_failed" eller "no_membership") uden en fuld error_description.
 * Her oversættes de kendte koder til en dansk, brugervenlig besked.
 */
function describeKnownError(error: string): string {
  switch (error) {
    case "login_failed":
      return "Loginlinket kunne ikke bekræftes. Det kan være udløbet, allerede brugt, eller åbnet i en anden browser end den, du anmodede fra.";
    case "no_membership":
      return "Din konto er endnu ikke koblet til Ebeltoft Marineforening. Kontakt en administrator for at blive tilføjet.";
    default:
      return "";
  }
}
