# Realtime-test — dokumenteret manuel procedure

Denne test kan ikke automatiseres meningsfuldt uden to samtidige, ægte
browsersessioner, så den er dokumenteret her som en konkret, gentagelig
manuel test — jf. Fase 3-oplægget, afsnit 25 ("Realtime-test").

Testen kræver, at du har:
1. Et rigtigt Supabase-projekt med migrations og seed-data kørt.
2. De to rigtige brugere logget ind (John Finmann og Calle Pedersen, se README,
   afsnit "Seed-data og brugere").
3. Appen kørende (lokalt via `npm run dev`, eller på Vercel).

## Testprocedure

1. **John åbner appen** på sin telefon/computer og logger ind via magic link.
   Han går til **Indkøbsliste**.
2. **Calle åbner appen** på en anden enhed (eller en anden browser/inkognitovindue)
   og logger ind. Han går også til **Indkøbsliste**.
3. **John reserverer en vare** — fx "8 glas sild" — ved at trykke
   "Jeg køber denne".
4. **Forventet resultat:** Uden at Calle genindlæser siden, skal han inden for
   få sekunder se varen skifte til "John køber denne · reserveret kl. HH:MM".
   Knappen "Jeg køber denne" skal være forsvundet for Calle på netop den vare.
5. **Calle forsøger** at trykke "Jeg køber denne" på en ANDEN vare, som ikke er
   reserveret — det skal lykkes uden problemer (kun den specifikke vare er låst).
6. **John registrerer varen som købt** (via "Registrér køb" → "Købt" →
   "Afslut og opdatér lager").
7. **Forventet resultat:** Calle skal — uden at genindlæse — se:
   - Varens status skifte til "Købt af John kl. HH:MM" på indkøbslisten.
   - Lagerets antal for "Marinerede sild" stige tilsvarende på Lager-siden,
     hvis han har den åben, eller ved næste besøg på siden.
8. **John (administrator) tjekker** i en tredje fane/session **Admin →
   Ændringslog** og bekræfter, at både reservationen og købet fremgår med
   korrekt bruger og tidspunkt.

## Hvad der bekræfter, at realtime virker korrekt

- Ingen af browserfanerne skal kræve en manuel genindlæsning (F5) for at se
  de andres ændringer.
- Der må ikke opstå dubletter i indkøbslisten, selvom flere brugere er
  aktive samtidig (test ved at lade begge sider stå åbne i flere minutter).
- Luk en af browserfanerne midt i testen og bekræft i konsollen (DevTools),
  at der ikke logges gentagne fejlbeskeder fra et Realtime-abonnement, der
  ikke blev ryddet korrekt op (cleanup sker i `useOrgRealtime`, se
  `lib/supabase/useRealtimeTable.ts`).

## Kendt begrænsning

Denne test er ikke kørt i praksis i forbindelse med denne leverance, da der
ikke er tilknyttet noget Supabase-projekt i det miljø, koden er udviklet i.
Testen skal gennemføres af jer, første gang I har et Supabase-projekt kørende
— gerne som en fast del af godkendelsen af Fase 3, før I går videre til Fase 4.
