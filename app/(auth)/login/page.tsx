"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validation/schemas";
import { parseAuthHash } from "@/lib/auth/parse-hash";

type PageStatus =
  | "checking_link" // tjekker URL-fragmentet ved indlæsning
  | "authenticating" // gyldige tokens fundet, opretter session
  | "idle" // almindelig login-formular
  | "sending"
  | "sent"
  | "form_error" // fejl i selve login-formularen (fx ugyldig e-mail)
  | "link_error"; // fejl fra magic-link-fragmentet (udløbet, ugyldigt, setSession fejlede)

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<PageStatus>("checking_link");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sikrer at fragment-håndteringen kun kører én gang, uanset gen-renders,
  // så vi aldrig risikerer at kalde setSession flere gange eller ende i et
  // redirect-loop tilbage til /login.
  const hasHandledHash = useRef(false);

  useEffect(() => {
    if (hasHandledHash.current) return;
    hasHandledHash.current = true;

    const parsed = parseAuthHash(window.location.hash);

    if (parsed.type === "none") {
      // Almindelig sideindlæsning uden magic-link-fragment — vis den
      // normale login-formular. Rører IKKE ved e-mailfeltet her, så en
      // eventuel browser-autofill i formularen nedenfor forbliver uændret.
      setStatus("idle");
      return;
    }

    if (parsed.type === "error") {
      // Fjern det følsomme fragment fra adresselinjen med det samme, også
      // ved fejl, så det ikke ligger synligt eller kan genindlæses/deles.
      clearHashFromUrl();
      setStatus("link_error");
      setErrorMsg(
        parsed.errorDescription || "Loginlinket er ugyldigt eller udløbet. Anmod om et nyt loginlink nedenfor."
      );
      return;
    }

    if (parsed.type === "incomplete") {
      clearHashFromUrl();
      setStatus("link_error");
      setErrorMsg("Loginlinket er ufuldstændigt. Anmod om et nyt loginlink nedenfor.");
      return;
    }

    // parsed.type === "tokens" — gyldigt magic-link-fragment fundet.
    setStatus("authenticating");

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken
      });

      // Fjern tokenfragmentet fra adresselinjen uanset udfald — det må
      // aldrig blive stående synligt eller havne i browserhistorik/deling.
      clearHashFromUrl();

      if (error || !data.session) {
        setStatus("link_error");
        setErrorMsg("Kunne ikke oprette en session ud fra loginlinket. Anmod om et nyt loginlink nedenfor.");
        return;
      }

      // Sessionen er bekræftet oprettet — send brugeren til app-forsiden.
      router.replace("/forside");
      router.refresh();
    })();
  }, [router]);

  function clearHashFromUrl() {
    if (typeof window === "undefined") return;
    const url = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", url);
  }

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
        emailRedirectTo: `${window.location.origin}/login`
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
              Vi har sendt et sikkert loginlink til <b>{email}</b>. Åbn det fra din telefon eller
              computer for at logge ind — der kræves ingen adgangskode.
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
