import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Supabase-klient til brug i server components, route handlers og server actions.
 * Læser og skriver auth-cookies via Next.js' cookies()-API, så login-status
 * følger med mellem server og klient.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as CookieOptions);
            });
          } catch {
            // Kaldes fra en Server Component uden skriveadgang til cookies —
            // det er uproblematisk, så længe middleware.ts opdaterer sessionen.
          }
        }
      }
    }
  );
}

/**
 * Administrator-klient med service-role-nøglen.
 * Bruges KUN i betroet server-kode (fx til at invitere brugere via Supabase Auth
 * Admin API). Denne klient omgår Row Level Security — brug den derfor aldrig
 * til at besvare almindelige forespørgsler fra brugerens browser.
 */
export function createSupabaseAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY mangler. Denne nøgle må kun bruges server-side og aldrig i klientkode."
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
