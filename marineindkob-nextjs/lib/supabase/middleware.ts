import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Opdaterer Supabase-sessionen på hvert request og beskytter /(app)-ruterne.
 * Kaldes fra middleware.ts i projektroden.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isAppRoute = request.nextUrl.pathname.startsWith("/forside") ||
    request.nextUrl.pathname.startsWith("/mangler") ||
    request.nextUrl.pathname.startsWith("/indkobsliste") ||
    request.nextUrl.pathname.startsWith("/lager") ||
    request.nextUrl.pathname.startsWith("/tilbud") ||
    request.nextUrl.pathname.startsWith("/forslag") ||
    request.nextUrl.pathname.startsWith("/arrangementer") ||
    request.nextUrl.pathname.startsWith("/historik") ||
    request.nextUrl.pathname.startsWith("/admin");

  if (!user && isAppRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
