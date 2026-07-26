import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Kør på alle ruter undtagen statiske filer og Next.js-interne assets,
     * så login-sessionen holdes opdateret i hele appen.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)"
  ]
};
