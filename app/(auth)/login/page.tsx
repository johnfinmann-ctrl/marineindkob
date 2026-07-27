"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validation/schemas";
import { parseAuthHash } from "@/lib/auth/parse-hash";
import { parseAuthQuery } from "@/lib/auth/parse-query";

type PageStatus =
  | "checking_link" // tjekker URL for kode/fragment/fejl ved indlæsning
  | "authenticating" // gyldig kode eller tokens fundet, opretter session
  | "idle" // almindelig login-formular
  | "sending"
  | "sent"
  | "form_error" // fejl i selve login-formularen (fx ugyldig e-mail)
  | "link_error"; // fejl fra magic-linket (udløbet, ugyldigt, allerede brugt, ingen medlemskab, …)

/**
 * MarineIndkøb bruger PKCE code-flow som det ENE, kanoniske loginflow:
 * signInWithOtp sender brugeren til /auth/callback, som udveksler koden
 * server-side og redirecter til /forside (se
 * app/(auth)/auth/callback/route.ts). Det er den flow, der aktivt bruges.
 *
 * Denne side håndterer derudover — som et sikkerhedsnet, ikke som et andet
 * konkurrerende flow — to situationer, hvor brugeren alligevel kan lande
 * her med login-data i selve URL'en:
 *   1) Et "code" i query-strengen (fx fra et ældre magic-link, sendt før
 *      emailRedirectTo blev sat til /auth/callback, eller hvis nogen
 *      linker direkte til /login?code=...). Prioriteres højest.
 *   2) Et access_token/refresh_token i URL-fragmentet (implicit flow),
 *      hvis Supabase-projektet på noget tidspunkt skulle være sat til det.
 * Findes hverken kode eller fragment, vises den almindelige formular.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<PageStatus>("checking_link");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sikrer at URL-håndteringen kun kører én gang, uanset gen-renders, så vi
  // aldrig kalder exchangeCodeForSession/setSession flere gange eller ender
  // i et redirect-loop tilbage til /login.
  const hasHandledUrl = useRef(false);

  useEffect(() => {
    if (hasHandledUrl.current) return;
    hasHandledUrl.current = true;

    function clearUrlParams() {
      if (typeof window === "undefined") return;
      window.history.replaceState(null, "", window.location.pathname);
    }

    // 1) Fejl videresendt fra /auth/callback (fx ?error=login_failed eller
    //    ?error=no_membership) — vis den med det samme, uden at forsøge
    //    nogen udveksling.
    const query = parseAuthQuery(window.location.search);
    if (query.type === "error") {
      clearUrlParams();
      setStatus("link_error");
      setErrorMsg(query.errorDescription || "Loginlinket kunne ikke bekræftes. Anmod om et nyt loginlink nedenfor.");
      return;
    }

    // 2) PKCE code i query-strengen — prioriteres over et evt. hash-fragment.
    if (query.type === "code") {
      setStatus("authenticating");
      (async () => {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(query.code);
        clearUrlParams();

        if (error || !data.session) {
          setStatus("link_error");
          setErrorMsg(
            "Loginlinket kunne ikke bekræftes. Det kan være udløbet, allerede brugt, eller åbnet i en anden browser end den, du anmodede fra. Anmod om et nyt loginlink nedenfor."
          );
          return;
        }

        router.replace("/forside");
        router.refresh();
      })();
      return;
    }

    // 3) Intet code — tjek for et implicit-flow hash-fragment (bevaret for
    //    bagudkompatibilitet, men er ikke det flow, appen selv bruger).
    const hash = parseAuthHash(window.location.hash);

    if (hash.type === "none") {
      setStatus("idle");
      return;
    }

    if (hash.type === "error") {
      clearUrlParams();
      setStatus("link_error");
      setErrorMsg(
        hash.errorDescription || "Loginlinket er ugyldigt eller udløbet. Anmod om et nyt loginlink nedenfor."
      );
      return;
    }

    if (hash.type === "incomplete") {
      clearUrlParams();
      setStatus("link_error");
      setErrorMsg("Loginlinket er ufuldstændigt. Anmod om et nyt loginlink nedenfor.");
      return;
    }

    // hash.type === "tokens"
    setStatus("authenticating");
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.setSession({
        access_token: hash.accessToken,
        refresh_token: hash.refreshToken
      });
      clearUrlParams();

      if (error || !data.session) {
        setStatus("link_error");
        setErrorMsg("Kunne ikke oprette en session ud fra loginlinket. Anmod om et nyt loginlink nedenfor.");
        return;
      }

      router.replace("/forside");
      router.refresh();
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const parsed = loginSchema.safeParse({ email });
    if (!parsed.success) {
      setStatus("form_error");
      setErrorMsg(parsed.error.issues[0]?.message ?? "Ugyldig e-mail.");
      return;
    }

    setStatus("sending");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Det ene, kanoniske redirect-mål: en server-route, der udveksler
        // PKCE-koden og sætter sessionscookien, før brugeren ser noget.
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      setStatus("form_error");
      setErrorMsg("Der opstod en fejl. Kontrollér e-mailadressen, og prøv igen.");
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-sand px-4">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="font-serif text-2xl font-bold text-navy">MarineIndkøb</div>
          <div className="text-xs tracking-widest uppercase text-gold-light mt-1">
            Ebeltoft Marineforening
          </div>
          <div className="wave-rule mt-4" />
        </div>

        {(status === "checking_link" || status === "authenticating") && (
          <div className="text-center py-8" data-testid="authenticating-state">
            <div className="text-3xl mb-2">⚓</div>
            <p className="text-navy font-bold">Logger ind…</p>
            <p className="text-sm text-[#4a5a63] mt-1">Et øjeblik, vi bekræfter dit loginlink.</p>
          </div>
        )}

        {status === "sent" && (
          <div className="text-center py-6">
            <div className="text-3xl mb-2">📩</div>
            <p className="text-navy font-bold mb-1">Tjek din e-mail</p>
            <p className="text-sm text-[#4a5a63]">
              Vi har sendt et sikkert loginlink til <b>{email}</b>. Åbn det fra samme browser og
              enhed, som du anmodede fra, for at logge ind — der kræves ingen adgangskode.
            </p>
          </div>
        )}

        {(status === "idle" || status === "sending" || status === "form_error" || status === "link_error") && (
          <form onSubmit={handleSubmit}>
            {status === "link_error" && errorMsg && (
              <p className="text-sm text-red mb-3" role="alert">
                {errorMsg}
              </p>
            )}
            <label className="block text-xs font-bold text-navy mb-1" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dig@ebeltoftmarineforening.dk"
              className="w-full border border-[#DCD3C0] rounded-xl px-3 py-3 text-base mb-2"
            />
            <p className="text-xs text-[#8A8A8A] mb-4">
              Indtast din e-mail. Du modtager et sikkert loginlink — ingen adgangskode nødvendig.
            </p>
            {status === "form_error" && errorMsg && (
              <p className="text-sm text-red mb-3">{errorMsg}</p>
            )}
            <button
              type="submit"
              disabled={status === "sending"}
              className="btn-primary w-full rounded-xl py-3 font-bold text-base disabled:opacity-50"
            >
              {status === "sending" ? "Sender…" : "Fortsæt"}
            </button>
          </form>
        )}

        <p className="text-xs text-center text-[#8A8A8A] mt-6">
          Nye brugere skal inviteres af en administrator. Kontakt din bestyrelse, hvis du ikke har
          fået en invitation.
        </p>
      </div>
    </main>
  );
}
