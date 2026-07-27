/**
 * Parser URL-fragmentet ("#access_token=...&refresh_token=...") som Supabase
 * Auth returnerer ved implicit flow (magic link). Ren funktion uden DOM- eller
 * Supabase-afhængigheder, så den er let at teste isoleret.
 *
 * Bemærk: fragmentet kan indeholde adgangstokens. Denne funktion logger
 * ALDRIG værdierne — den returnerer dem kun til kalderen, som er ansvarlig
 * for at bruge dem med det samme og aldrig skrive dem til konsol, state, der
 * persisteres, eller andre steder, der kan havne i logs.
 */

export interface AuthHashTokens {
  type: "tokens";
  accessToken: string;
  refreshToken: string;
  expiresIn: string | null;
  tokenType: string | null;
}

export interface AuthHashError {
  type: "error";
  error: string;
  errorDescription: string;
}

export interface AuthHashIncomplete {
  type: "incomplete";
  reason: string;
}

export interface AuthHashNone {
  type: "none";
}

export type ParsedAuthHash = AuthHashTokens | AuthHashError | AuthHashIncomplete | AuthHashNone;

/**
 * @param hash Den rå window.location.hash, inklusive det indledende "#" (må også kaldes uden "#").
 */
export function parseAuthHash(hash: string): ParsedAuthHash {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return { type: "none" };
  }

  const params = new URLSearchParams(clean);

  const error = params.get("error");
  if (error) {
    const description = params.get("error_description") ?? "";
    return {
      type: "error",
      error,
      errorDescription: decodeURIComponent(description.replace(/\+/g, " "))
    };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const expiresIn = params.get("expires_in");
  const tokenType = params.get("token_type");

  if (!accessToken && !refreshToken) {
    // Intet relevant i fragmentet — fx bare en almindelig sideindlæsning.
    return { type: "none" };
  }

  if (!accessToken) {
    return { type: "incomplete", reason: "Loginlinket mangler et adgangstoken (access_token)." };
  }
  if (!refreshToken) {
    return { type: "incomplete", reason: "Loginlinket mangler et fornyelsestoken (refresh_token)." };
  }

  return {
    type: "tokens",
    accessToken,
    refreshToken,
    expiresIn: expiresIn,
    tokenType: tokenType
  };
}
