"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validation/schemas";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const parsed = loginSchema.safeParse({ email });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? "Ugyldig e-mail.");
      return;
    }

    setStatus("sending");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      setStatus("error");
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

        {status === "sent" ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-2">📩</div>
            <p className="text-navy font-bold mb-1">Tjek din e-mail</p>
            <p className="text-sm text-[#4a5a63]">
              Vi har sendt et sikkert loginlink til <b>{email}</b>. Åbn det fra din telefon eller
              computer for at logge ind — der kræves ingen adgangskode.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
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
            {errorMsg && <p className="text-sm text-red mb-3">{errorMsg}</p>}
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
