import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase-klient til brug i client components ("use client").
 * Bruger kun de offentlige nøgler (URL + anon key), som må være synlige i browseren.
 * Row Level Security i databasen sikrer, at brugeren kun kan se egen organisations data.
 *
 * Bemærk: klienten er bevidst ikke strengt typet med Database-generic'en i types/database.ts,
 * da den fil er håndskrevet og ikke matcher @supabase/supabase-js' generiske typekrav 1:1.
 * Når projektet er koblet til et rigtigt Supabase-projekt, kør:
 *   npx supabase gen types typescript --project-id <dit-projekt-id> > types/database.ts
 * og tilføj generic'en tilbage her for fuld typesikkerhed.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
