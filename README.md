# MarineIndkøb — Fase 3: teknisk fundament og ægte flerbrugersynkronisering

Dette er den funktionelle Next.js + Supabase-version af MarineIndkøb til Ebeltoft
Marineforening. Fase 3 erstatter Fase 2-prototypens simulerede localStorage-deling
med en rigtig database, login og realtidssynkronisering mellem 1–3 indkøbere.

GitHub Pages-prototypen fra Fase 2 må gerne bevares som demo, men denne kode er den
funktionelle version, som skal køre på Vercel.

## Indhold

1. [Teknisk stack](#teknisk-stack)
2. [Projektstruktur](#projektstruktur)
3. [Kom i gang lokalt](#kom-i-gang-lokalt)
4. [Oprettelse af Supabase-projekt](#oprettelse-af-supabase-projekt)
5. [Kørsel af migrations](#kørsel-af-migrations)
6. [Miljøvariabler](#miljøvariabler)
7. [Seed-data og testbrugere](#seed-data-og-testbrugere)
8. [Oprettelse af første administrator](#oprettelse-af-første-administrator)
9. [Deployment til Vercel](#deployment-til-vercel)
10. [Test af login](#test-af-login)
11. [Test af realtime](#test-af-realtime)
12. [Tests (unit + integration)](#tests)
13. [Backup og eksport](#backup-og-eksport)
14. [Sikkerhedsgennemgang](#sikkerhedsgennemgang)
15. [Kendte begrænsninger](#kendte-begrænsninger)
16. [Hvad der hører til Fase 4](#hvad-der-hører-til-fase-4)
17. [Overdragelse til kunden](#overdragelse-til-kunden)

---

## Teknisk stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase
(PostgreSQL, Auth, Realtime, Row Level Security) · Zod · Vitest.

## Projektstruktur

```
/app
  /(auth)/login          Loginside (magic link)
  /(auth)/auth/callback  Modtager magic link-koden og opretter en session
  /(app)/...              Alle skærme bag login (Forside, Mangler, Indkøbsliste, …)
  /api/invite             Server-route til at invitere nye brugere
/components               Delte UI-komponenter og AppShell (navigation)
/lib
  /supabase                Klienter til browser, server og middleware/proxy
  /auth                     Opslag af organisation + rolle for den aktuelle bruger
  /validation               Zod-skemaer og statusovergangs-regler
  /calculations             Den regelbaserede beregningsmotor (se nedenfor)
  /permissions              Rolle → rettigheder (UX-lag, ikke sikkerhed i sig selv)
/types                     Håndskrevne databasetyper (se note i types/database.ts)
/supabase
  /migrations              4 SQL-migrationer: skema, RLS, funktioner, realtime
  /seed                    Node-script der opretter organisation, brugere og demodata
/tests
  /unit                    32 automatiske enhedstests (kører uden database)
  /integration             Tests der kræver et rigtigt Supabase-projekt
  /realtime                Dokumenteret manuel realtime-test
/public                    PWA-manifest og ikon
```

## Kom i gang lokalt

```bash
npm install
cp .env.example .env.local   # udfyld med dine egne Supabase-nøgler, se nedenfor
npm run dev
```

Appen kører herefter på http://localhost:3000 og sender dig til login-siden.

**Verificeret i forbindelse med denne leverance:** `npm install`, `npx tsc --noEmit`,
`npm run test` (32 enhedstests) og `npm run build` (produktionsbuild) er alle kørt
og bestået i det miljø, koden er udviklet i. Der er ikke tilknyttet noget Supabase-
projekt i det miljø, så alt, der kræver en database (login, RLS, realtime), er
verificeret gennem kodegennemgang og de dokumenterede test-procedurer i stedet —
se afsnittene "Test af login" og "Test af realtime" nedenfor for hvad I selv skal
udføre, første gang I har et rigtigt Supabase-projekt kørende.

## Oprettelse af Supabase-projekt

1. Opret en konto på [supabase.com](https://supabase.com), hvis I ikke allerede har én.
2. Klik **New project**.
3. Vælg en **EU-region** (fx Frankfurt), jf. Fase 3-oplæggets krav om EU-hosting.
4. Vælg et databasekodeord, og gem det et sikkert sted (I får ikke brug for det i
   det daglige, men det bruges til direkte databaseadgang, hvis det bliver nødvendigt).
5. Vent til projektet er klar (et par minutter).

## Kørsel af migrations

Migrationerne ligger i `supabase/migrations/` og skal køres i rækkefølge:

**Med Supabase CLI (anbefalet):**
```bash
npx supabase login
npx supabase link --project-ref <dit-projekt-ref>
npx supabase db push
```

**Uden CLI:** Åbn hver fil i rækkefølge (001, 002, 003, 004) og indsæt indholdet i
Supabase Studio → **SQL Editor** → **New query** → kør (Run). Kør dem én ad gangen,
i den nævnte rækkefølge, da senere migrationer bygger videre på tidligere.

## Miljøvariabler

Kopiér `.env.example` til `.env.local` og udfyld fra Supabase Studio → **Settings → API**:

| Variabel | Hvor den findes | Bemærkning |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL | Offentlig, må gerne stå i klientkode |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon public | Offentlig, beskyttes af RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role | **Hemmelig.** Kun server-side. Aldrig i Git. |
| `NEXT_PUBLIC_DEFAULT_ORG_ID` | Output fra seed-scriptet | Sættes efter kørsel af seed |
| `RESERVATION_EXPIRY_HOURS` | Selv valgt | Standard: 12 timer |

`.env.local` er allerede i `.gitignore` og bliver derfor aldrig committet. Kontrollér
altid `git status`, før I committer, hvis I er i tvivl.

## Seed-data og testbrugere

Seed-scriptet opretter organisationen, tre testbrugere, de 18 produkter, de fem
butikker og den øvrige demodata fra Fase 2.

```bash
npm run seed
```

Testbrugerne (rediger e-mails i `supabase/seed/run-seed.mjs`, før I bruger appen i
praksis — de er IKKE rigtige postkasser):

| Navn | E-mail (demo) | Rolle |
|---|---|---|
| Jens | jens@marineindkob-demo.dk | Indkøber |
| Anna | anna@marineindkob-demo.dk | Indkøber |
| Bo | bo.admin@marineindkob-demo.dk | Administrator |

Testbrugerne har ingen adgangskode — de logger ind med magic link på deres e-mail
(se "Test af login" nedenfor).

Scriptet er skrevet, så det roligt kan køres igen — det springer allerede
oprettede organisationer, produkter og butikker over.

**Nulstil demonstrationsdata:** Kør `npm run seed` igen. Det opretter ikke
dubletter af organisation, produkter eller butikker, men indkøbsliste- og
behovsposter oprettes kun, hvis de ikke allerede findes. For en fuldstændig
nulstilling af transaktionsdata (indkøbsliste, tilbud, arrangementer) i en
testperiode kan I køre:
```sql
delete from shopping_list_items where organization_id = '<jeres-org-id>';
delete from shopping_needs where organization_id = '<jeres-org-id>';
```
og derefter køre `npm run seed` igen.

## Oprettelse af første administrator

Seed-scriptet gør automatisk "Bo" til administrator. Skal I gøre en anden bruger
til administrator (fx jer selv med jeres rigtige e-mail):

1. Ret e-mailen for "Bo" i `supabase/seed/run-seed.mjs`, eller opret brugeren
   manuelt via Supabase Studio → **Authentication → Users → Invite user**.
2. Kør `npm run seed` igen — scriptet opretter/opdaterer profil og medlemskab.
3. Alternativt: log ind som en eksisterende administrator og brug **Admin →
   Invitér ny bruger** i selve appen.

## Deployment til Vercel

1. Opret et nyt GitHub-repository (anbefalet navn: `marineindkob`, eller en ny
   branch i det eksisterende repository fra Fase 2 — GitHub Pages-prototypen kan
   ligge i en separat mappe/branch, så de ikke forstyrrer hinanden).
2. Push dette projekts indhold til repositoryet.
3. Gå til [vercel.com](https://vercel.com) → **Add New → Project** → importér
   GitHub-repositoryet.
4. Under **Environment Variables**, tilføj de samme variabler som i `.env.local`
   (undtagen at `NEXT_PUBLIC_DEFAULT_ORG_ID` og `RESERVATION_EXPIRY_HOURS` er
   valgfrie, hvis I ikke bruger dem direkte i koden endnu).
5. Klik **Deploy**. Build-kommandoen er `next build` (sat automatisk af Vercel).
6. Når deployment er færdig, får I en adresse som `marineindkob.vercel.app` —
   tilføj evt. et eget domæne under **Settings → Domains**.

## Test af login

1. Åbn appen (lokalt eller på Vercel) og gå til login-siden.
2. Indtast en af testbrugernes e-mails (se ovenfor).
3. Tjek **Supabase Studio → Authentication → Logs**, eller testbrugerens
   postkasse (hvis det er en rigtig e-mail), for magic link-mailen.
   *(I test/udvikling kan I også finde linket direkte i Supabase Studios logs,
   hvis I ikke har konfigureret en rigtig e-mail-udbyder endnu.)*
4. Klik linket — I bliver sendt til `/auth/callback` og herefter til `/forside`.
5. Bekræft, at navnet i topbaren/sidemenuen matcher den bruger, I loggede ind som.

## Test af realtime

Se den fulde, trin-for-trin dokumenterede procedure i
[`tests/realtime/REALTIME-TEST.md`](tests/realtime/REALTIME-TEST.md). Kort fortalt:
Jens og Anna logger ind samtidig i hver sin browser, Jens reserverer og køber en
vare, og Anna skal se ændringerne uden at genindlæse siden.

## Tests

```bash
npm run test              # 32 enhedstests — kører uden database, altid grønne
npm run test:integration  # Kræver et rigtigt Supabase-projekt, se testfilerne
npx tsc --noEmit          # Typecheck
npm run build             # Produktionsbuild
```

Enhedstests dækker: enhedspris (herunder ost-eksemplet fra Fase 1-oplægget),
tilbudsvurdering, kørselspris, leveringspris, anbefalet mængde ("Køb nu / Køb kun
det nødvendige / Vent" for hhv. kaffe-, sild- og karrysild-eksemplerne), besparelse,
dansk valutaformat og statusovergange for indkøbslistevarer. Alle 32 er kørt og
bestået i forbindelse med denne leverance.

Integrationstests og realtime-testen kræver et Supabase-projekt og er dokumenteret
til, at I selv kører dem, første gang I har et projekt sat op — se kommentarerne
øverst i hver testfil under `tests/integration/`.

## Backup og eksport

- **CSV-eksport** af indkøbsliste og historik er implementeret direkte i appen
  (knapperne "Eksportér" på hhv. Indkøbsliste- og Historik-siderne) og virker uden
  server — det er en ren browser-download.
- **JSON-backup:** Supabase har indbygget automatisk backup (Point-in-Time Recovery
  på betalte planer, daglige snapshots på gratis-planen) under **Settings →
  Database → Backups**. Der er ikke bygget en selvstændig "eksportér alt til JSON"-
  knap i Fase 3 — det er en oplagt, lille Fase 4-opgave, hvis I ønsker en
  supplerende, menneskeligt læsbar backup ved siden af Supabase's egen.
- Dokumentér selv jeres foretrukne rutine (fx månedlig download af en CSV-eksport
  til foreningens drev) som et simpelt supplement, indtil en egentlig
  backup-knap eventuelt bygges.

## Sikkerhedsgennemgang

- **Login:** magic link via Supabase Auth — ingen adgangskoder at glemme eller lække.
- **Organisationsadskillelse:** hver række i hver forretningstabel har en
  `organization_id`, og Row Level Security håndhæver, at en bruger kun kan se og
  ændre data i organisationer, hvor vedkommende er aktivt medlem (se
  `supabase/migrations/002_rls.sql`).
- **To roller:** Indkøber og Administrator. Administratorrettigheder er
  verificeret i databasen via `is_admin()`, ikke kun i brugerfladen — se
  `lib/permissions/roles.ts`s kommentar, der eksplicit siger, at UI-tjek aldrig
  erstatter RLS.
- **Atomisk reservation:** et unikt, delvist databaseindeks
  (`uniq_active_reservation_per_item`) forhindrer dobbeltreservation, selv ved
  to samtidige klik — dette er en databasegaranti, ikke kun en frontend-kontrol.
- **Transaktionssikkert køb:** `record_purchase()` kører som én PL/pgSQL-funktion;
  fejler ét trin (fx manglende lagerpost), ruller hele købet tilbage, og intet
  fremstår som gennemført.
- **Ændringslog:** skrives udelukkende via `security definer`-funktioner
  (aldrig direkte fra klienten), og kun administrator kan læse den.
- **Soft delete:** produkter, butikker, behov og arrangementer bruger
  `deleted_at`/`active` frem for fysisk sletning, så historik bevares.
- **Hemmelige nøgler:** `SUPABASE_SERVICE_ROLE_KEY` bruges udelukkende i
  `lib/supabase/server.ts` (server-only-fil) og i `/api/invite`-routen — aldrig i
  en fil, der importeres af en "use client"-komponent. `.env.local` er i
  `.gitignore`, og `.env.example` indeholder kun eksempelværdier.
- **Ikke bygget (bevidst, jf. afsnit 26):** enterprise identity management, SSO,
  hardwaretokens, fem-ti roller, eller et tungt compliance-dashboard. Det ville
  være overbygget til en forenings indkøbsdata.

## Kendte begrænsninger

- Koden i dette projekt er udviklet og verificeret (typecheck, enhedstests,
  produktionsbuild) i et miljø **uden** forbindelse til et rigtigt Supabase-
  projekt. Alt, der kræver en levende database — login, RLS-håndhævelse i praksis,
  realtidssynkronisering, det fulde købsflow — er bygget efter Supabase's
  dokumenterede mønstre og gennemgået i kode, men er **ikke afprøvet mod en
  faktisk database** som en del af denne leverance. I skal selv gennemføre
  "Test af login" og "Test af realtime" ovenfor, første gang I har et projekt kørende.
- `types/database.ts` er håndskrevet og bevidst løst koblet til Supabase-
  klienterne (se kommentaren i `lib/supabase/client.ts`) for at undgå
  TypeScript-fejl, der opstod, fordi hånd-typerne ikke matchede
  @supabase/supabase-js' generiske krav 1:1. Kør `supabase gen types typescript`
  mod jeres rigtige projekt og genindsæt generic'en for fuld typesikkerhed.
- Admin-sidens "Nulstil demonstrationsdata"-knap peger i denne version på, at I
  kører `npm run seed` fra en server med adgang til service-role-nøglen — der er
  ikke bygget en et-klik-nulstilling direkte i browseren, da det ville kræve at
  eksponere destruktive handlinger med den hemmelige nøgle til klienten, hvilket
  ville være et sikkerhedsproblem.
- PWA-ikonet er en simpel pladsholder-SVG (`public/icons/icon.svg`) — udskift med
  et rigtigt ikon, før I installerer appen i praksis.
- Automatisk udløb af reservationer (`expire_stale_reservations()`) er bygget som
  en databasefunktion, men der er ikke opsat et skemalagt job (pg_cron eller
  Supabase Cron) til at køre den automatisk — det skal I selv slå til under
  **Supabase Studio → Database → Cron**, eller kalde funktionen fra en
  Vercel Cron Job.
- E-mail-invitationer via `/api/invite` kræver, at der er sat en e-mail-udbyder op
  i Supabase (SMTP-indstillinger under **Authentication → Email Templates**),
  ellers bliver invitationsmails ikke sendt i praksis, selvom API-kaldet lykkes.

## Hvad der hører til Fase 4

- OCR og automatisk aflæsning af tilbudsaviser.
- Integration til eksterne pris-API'er eller leverandørfeeds.
- Stregkodescanning.
- Push-notifikationer.
- Automatisk oprettelse af online indkøbskurve.
- Integration til regnskab/Kassero.
- Mere avancerede prognoser (stadig ikke maskinlæring, men mere historik-drevet).
- En selvstændig "eksportér alt til JSON"-knap til administrator (supplement til
  Supabase's indbyggede backup).
- Skemalagt automatisk udløb af reservationer (pg_cron/Vercel Cron).

## Overdragelse til kunden

Når Fase 3 er godkendt, skal følgende overdrages til Ebeltoft Marineforening:

1. Ejerskab af GitHub-repositoryet (eller tilføjelse som administrator/collaborator).
2. Ejerskab af (eller administratoradgang til) Supabase-projektet.
3. Ejerskab af (eller administratoradgang til) Vercel-projektet.
4. Denne README samt en kort mundtlig eller skriftlig gennemgang af, hvordan man
   inviterer nye brugere, nulstiller demodata, og hvor man ser ændringsloggen.
5. En liste over, hvem der har administratorrolle i appen (bør stemme overens med
   bestyrelsens ønsker om, hvem der kan invitere/deaktivere brugere).
