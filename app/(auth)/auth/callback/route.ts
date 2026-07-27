import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Det ene, kanoniske mål for magic-link-redirects (PKCE code-flow).
 * Udveksler koden server-side, så sessionscookien er sat, FØR brugeren
 * ser noget — dette er den anbefalede Supabase/Next.js App Router-metode
 * og undgår enhver klient-side race mellem cookie-skrivning og middleware.
 *
 * Koden og sessionen logges aldrig — hverken her eller andre steder.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/forside";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=login_failed`);
}
