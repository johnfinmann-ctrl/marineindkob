// =============================================================
// MarineIndkøb — Fase 3
// Seed-script: opretter organisation, de rigtige brugere og demodata
// (produkter, butikker, tilbud, indkøbsliste, arrangementer).
// =============================================================
// Kør med:  npm run seed
// Kræver .env.local med NEXT_PUBLIC_SUPABASE_URL og
// SUPABASE_SERVICE_ROLE_KEY (se README, afsnit "Seed-data").
// SUPABASE_SERVICE_ROLE_KEY læses UDELUKKENDE fra .env.local via dotenv
// nedenfor — den er aldrig hardcodet og logges aldrig af dette script.
//
// Scriptet er idempotent: kør det roligt igen, så mange gange I vil.
// Organisationen, brugerne, medlemskaberne, produkterne og butikkerne
// genbruges eller opdateres — der oprettes aldrig dubletter.
// =============================================================

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env.local. Se README."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * Kaster en tydelig, kontekstbærende fejl, hvis Supabase har returneret en
 * fejl. Bruges efter ethvert select/insert/upsert, så scriptet aldrig
 * fortsætter stille videre med `data === null` og senere crasher med en
 * uigennemskuelig "Cannot read properties of null"-fejl.
 */
function assertNoError(context, error) {
  if (error) {
    throw new Error(`${context} fejlede i Supabase: ${error.message}${error.code ? ` (kode: ${error.code})` : ""}`);
  }
}

/**
 * Finder én række, der matcher `match`-kolonnerne, eller opretter den, hvis
 * den ikke findes. Bruges i stedet for `.upsert(..., { onConflict })`, da
 * onConflict kræver en unik/eksklusions-constraint i databasen, som ikke
 * nødvendigvis findes (se migration 005_fix_missing_unique_constraints.sql).
 * Denne funktion virker uanset om en sådan constraint findes, og tjekker
 * eksplicit for fejl og manglende data ved hvert trin.
 */
async function findOrCreateSingle({ table, match, insertPayload, selectCols = "id" }) {
  const matchDescription = `${table} (${Object.entries(match)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")})`;

  const { data: existing, error: selectError } = await supabase
    .from(table)
    .select(selectCols)
    .match(match)
    .maybeSingle();
  assertNoError(`Opslag på ${matchDescription}`, selectError);
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from(table)
    .insert(insertPayload)
    .select(selectCols)
    .single();
  assertNoError(`Oprettelse af ${matchDescription}`, insertError);
  if (!created) {
    throw new Error(
      `Oprettelse af ${matchDescription} gav intet resultat, selvom Supabase ikke returnerede nogen fejl.`
    );
  }
  return created;
}

const ORG_NAME = "Ebeltoft Marineforening";

// De rigtige brugere for Ebeltoft Marineforening. Ingen demo-/testbrugere
// (Jens, Anna, Bo) oprettes længere — kun de personer, foreningen faktisk
// skal bruge appen med.
const TEST_USERS = [
  {
    email: "john.finmann@gmail.com",
    full_name: "John Finmann",
    initials: "JF",
    role: "administrator"
  },
  {
    email: "callepetersen@gmail.com",
    full_name: "Calle Pedersen",
    initials: "CP",
    role: "indkober"
  }
];

async function upsertOrganization() {
  const { data: existing, error: selectError } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", ORG_NAME)
    .maybeSingle();
  assertNoError(`Opslag på organisation "${ORG_NAME}"`, selectError);
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: ORG_NAME })
    .select("id")
    .single();
  assertNoError(`Oprettelse af organisation "${ORG_NAME}"`, error);
  return data.id;
}

async function findUserByEmail(email) {
  const target = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  // Slår op på tværs af sider, så vi finder brugeren, uanset hvor mange
  // andre brugere der allerede findes i Supabase-projektet.
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < perPage) return null; // sidste side er nået
    page += 1;
  }
}

async function upsertUser(email, full_name, initials) {
  // Genbrug en eksisterende Supabase-bruger, hvis e-mailen allerede findes —
  // både John og Calle kan sagtens allerede være oprettet fra en tidligere
  // kørsel, eller fordi en administrator har inviteret dem via appen.
  const existingUser = await findUserByEmail(email);

  let userId;
  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Opret bruger via Auth Admin API. E-mailen bekræftes automatisk,
    // og der sættes IKKE en adgangskode, da login foregår med magic link.
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (error) {
      // Håndterer et sjældent kapløb, hvor brugeren blev oprettet af en
      // anden proces mellem vores opslag og vores create-kald ovenfor.
      if (error.message?.toLowerCase().includes("already been registered")) {
        const foundAfterAll = await findUserByEmail(email);
        if (!foundAfterAll) throw error;
        userId = foundAfterAll.id;
      } else {
        throw error;
      }
    } else {
      userId = created.user.id;
    }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: userId, full_name, initials }, { onConflict: "id" });
  assertNoError(`Oprettelse/opdatering af profil for ${email}`, profileError);

  return userId;
}

async function upsertMembership(orgId, userId, roleCode, invitedBy) {
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("code", roleCode)
    .maybeSingle();
  assertNoError(`Opslag på rollen "${roleCode}"`, roleError);
  if (!role) {
    throw new Error(
      `Rollen "${roleCode}" findes ikke i "roles"-tabellen. Kør migration 001_schema.sql (den seeder rollerne "indkober" og "administrator"), før du kører seed-scriptet.`
    );
  }

  const { error: membershipError } = await supabase.from("organization_members").upsert(
    {
      organization_id: orgId,
      user_id: userId,
      role_id: role.id,
      active: true,
      invited_by: invitedBy ?? null
    },
    { onConflict: "organization_id,user_id" }
  );
  assertNoError(`Oprettelse/opdatering af medlemskab (organisation ${orgId}, bruger ${userId})`, membershipError);
}

async function seedCategoriesAndUnits(orgId) {
  const categories = ["Bagværk", "Kølevarer", "Fisk", "Pålæg", "Kolonial", "Drikkevarer", "Forbrugsvarer"];
  const catMap = {};
  for (const name of categories) {
    const row = await findOrCreateSingle({
      table: "product_categories",
      match: { organization_id: orgId, name },
      insertPayload: { organization_id: orgId, name },
      selectCols: "id, name"
    });
    catMap[name] = row.id;
  }

  const units = [
    ["stk", "styk"], ["bakker", "bakker"], ["glas", "glas"], ["kg", "kilogram"],
    ["dåser", "dåser"], ["flasker", "flasker"], ["pakker", "pakker"], ["kasser", "kasser"]
  ];
  const unitMap = {};
  for (const [code, name] of units) {
    const row = await findOrCreateSingle({
      table: "product_units",
      match: { organization_id: orgId, code },
      insertPayload: { organization_id: orgId, code, name },
      selectCols: "id, code"
    });
    unitMap[code] = row.id;
  }
  return { catMap, unitMap };
}

// De 18 produkter og fem butikker fra Fase 2-prototypen.
const PRODUCTS = [
  { name: "Rugbrød", category: "Bagværk", unit: "stk", icon: "🍞", stock: 6, min: 4, weeklyUse: 5, shelfLife: "3–4 dage" },
  { name: "Æg", category: "Kølevarer", unit: "bakker", icon: "🥚", stock: 2, min: 3, weeklyUse: 2, shelfLife: "3 uger" },
  { name: "Marinerede sild", category: "Fisk", unit: "glas", icon: "🐟", stock: 4, min: 6, weeklyUse: 3, shelfLife: "6 mdr. uåbnet" },
  { name: "Karrysild", category: "Fisk", unit: "glas", icon: "🐟", stock: 5, min: 4, weeklyUse: 2, shelfLife: "6 mdr. uåbnet" },
  { name: "Ost", category: "Kølevarer", unit: "kg", icon: "🧀", stock: 3, min: 2, weeklyUse: 1.5, shelfLife: "3 uger" },
  { name: "Leverpostej", category: "Pålæg", unit: "dåser", icon: "🥫", stock: 4, min: 3, weeklyUse: 2, shelfLife: "1 år" },
  { name: "Ketchup", category: "Kolonial", unit: "flasker", icon: "🍅", stock: 2, min: 3, weeklyUse: 1, shelfLife: "1 år" },
  { name: "Sennep", category: "Kolonial", unit: "flasker", icon: "🧴", stock: 3, min: 2, weeklyUse: 0.5, shelfLife: "1 år" },
  { name: "Remoulade", category: "Kolonial", unit: "flasker", icon: "🧴", stock: 2, min: 2, weeklyUse: 0.5, shelfLife: "8 mdr." },
  { name: "Kaffe", category: "Kolonial", unit: "pakker", icon: "☕", stock: 3, min: 4, weeklyUse: 2, shelfLife: "1 år" },
  { name: "Øl", category: "Drikkevarer", unit: "kasser", icon: "🍺", stock: 6, min: 8, weeklyUse: 3, shelfLife: "6 mdr." },
  { name: "Sodavand", category: "Drikkevarer", unit: "kasser", icon: "🥤", stock: 4, min: 6, weeklyUse: 2, shelfLife: "9 mdr." },
  { name: "Vand", category: "Drikkevarer", unit: "kasser", icon: "💧", stock: 5, min: 4, weeklyUse: 1, shelfLife: "1 år" },
  { name: "Snaps", category: "Drikkevarer", unit: "flasker", icon: "🥃", stock: 3, min: 4, weeklyUse: 0.5, shelfLife: "Ubegrænset" },
  { name: "Servietter", category: "Forbrugsvarer", unit: "pakker", icon: "🧻", stock: 8, min: 6, weeklyUse: 1, shelfLife: "Ubegrænset" },
  { name: "Køkkenrulle", category: "Forbrugsvarer", unit: "pakker", icon: "🧻", stock: 5, min: 6, weeklyUse: 1.5, shelfLife: "Ubegrænset" },
  { name: "Toiletpapir", category: "Forbrugsvarer", unit: "pakker", icon: "🧻", stock: 10, min: 8, weeklyUse: 2, shelfLife: "Ubegrænset" },
  { name: "Opvasketabs", category: "Forbrugsvarer", unit: "pakker", icon: "🧽", stock: 2, min: 3, weeklyUse: 0.5, shelfLife: "Ubegrænset" }
];

const STORES = [
  { name: "Lokal Dagligvare Ebeltoft", type: "supermarked", address: "Adelgade 12", postal_code: "8400", city: "Ebeltoft", distance_km: 2.4, delivery: false, delivery_price: 0, min_order: 0, hours: "08–20" },
  { name: "Ebeltoft Discount", type: "discount", address: "Strandvejen 4", postal_code: "8400", city: "Ebeltoft", distance_km: 3.1, delivery: false, delivery_price: 0, min_order: 0, hours: "08–20" },
  { name: "Djurs Drikkevarer", type: "specialbutik", address: "Industrivej 7", postal_code: "8410", city: "Rønde", distance_km: 6.5, delivery: true, delivery_price: 49, min_order: 300, hours: "10–17:30" },
  { name: "Aarhus Catering Online", type: "onlinebutik", address: null, postal_code: null, city: "Aarhus", distance_km: null, delivery: true, delivery_price: 99, min_order: 500, hours: "Online — altid åben" },
  { name: "Mols Specialiteter", type: "specialbutik", address: "Havnevej 3", postal_code: "8420", city: "Knebel", distance_km: 12, delivery: false, delivery_price: 0, min_order: 0, hours: "10–17" }
];

async function seedProducts(orgId, catMap, unitMap, adminUserId) {
  const productIds = {};
  for (const p of PRODUCTS) {
    const { data: existing, error: existingError } = await supabase
      .from("products")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", p.name)
      .maybeSingle();
    assertNoError(`Opslag på produkt "${p.name}"`, existingError);

    let id;
    if (existing) {
      id = existing.id;
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert({
          organization_id: orgId,
          name: p.name,
          category_id: catMap[p.category],
          unit_id: unitMap[p.unit],
          icon: p.icon,
          shelf_life: p.shelfLife,
          default_weekly_use: p.weeklyUse,
          created_by: adminUserId,
          updated_by: adminUserId
        })
        .select("id")
        .single();
      assertNoError(`Oprettelse af produkt "${p.name}"`, error);
      id = data.id;
    }
    productIds[p.name] = id;

    const { data: stockExisting, error: stockSelectError } = await supabase
      .from("stock_items")
      .select("id")
      .eq("organization_id", orgId)
      .eq("product_id", id)
      .maybeSingle();
    assertNoError(`Opslag på lagerpost for "${p.name}"`, stockSelectError);

    if (!stockExisting) {
      const { error: stockInsertError } = await supabase.from("stock_items").insert({
        organization_id: orgId,
        product_id: id,
        quantity: p.stock,
        minimum_quantity: p.min,
        unit_id: unitMap[p.unit],
        average_weekly_consumption: p.weeklyUse,
        updated_by: adminUserId
      });
      assertNoError(`Oprettelse af lagerpost for "${p.name}"`, stockInsertError);
    }
  }
  return productIds;
}

async function seedStores(orgId, adminUserId) {
  const storeIds = {};
  for (const s of STORES) {
    const { data: existing, error: existingError } = await supabase
      .from("stores")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", s.name)
      .maybeSingle();
    assertNoError(`Opslag på butik "${s.name}"`, existingError);
    if (existing) {
      storeIds[s.name] = existing.id;
      continue;
    }
    const { data, error } = await supabase
      .from("stores")
      .insert({ organization_id: orgId, ...s, created_by: adminUserId, updated_by: adminUserId })
      .select("id")
      .single();
    assertNoError(`Oprettelse af butik "${s.name}"`, error);
    storeIds[s.name] = data.id;
  }
  return storeIds;
}

async function seedTravelSettings(orgId, adminUserId) {
  const { data: existing, error: existingError } = await supabase
    .from("travel_cost_settings")
    .select("id")
    .eq("organization_id", orgId)
    .maybeSingle();
  assertNoError("Opslag på transportindstillinger", existingError);
  if (existing) return;
  const { error: insertError } = await supabase.from("travel_cost_settings").insert({
    organization_id: orgId,
    price_per_km: 3.2,
    average_speed_kmh: 45,
    updated_by: adminUserId
  });
  assertNoError("Oprettelse af transportindstillinger", insertError);
}

async function seedShoppingListAndNeeds(orgId, productIds, storeIds, adminUserId) {
  const { data: existingList, error: existingListError } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("organization_id", orgId)
    .eq("status", "aktiv")
    .maybeSingle();
  assertNoError("Opslag på aktiv indkøbsliste", existingListError);

  let listId = existingList?.id;
  if (!listId) {
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ organization_id: orgId, name: "Aktiv indkøbsliste", created_by: adminUserId })
      .select("id")
      .single();
    assertNoError("Oprettelse af aktiv indkøbsliste", error);
    listId = data.id;
  }

  const needs = [
    { product: "Marinerede sild", current: 4, min: 6, use: 3, needBy: "2026-08-14", priority: "Høj", comment: "Skal bruges til medlemsaften", status: "Kritisk" },
    { product: "Æg", current: 2, min: 3, use: 2, needBy: "2026-08-02", priority: "Middel", comment: "", status: "Snart" },
    { product: "Ketchup", current: 2, min: 3, use: 1, needBy: "2026-08-05", priority: "Lav", comment: "", status: "Snart" },
    { product: "Kaffe", current: 3, min: 4, use: 2, needBy: "2026-08-01", priority: "Middel", comment: "På godt tilbud lige nu", status: "Tilbud" },
    { product: "Øl", current: 6, min: 8, use: 3, needBy: "2026-08-03", priority: "Middel", comment: "Til medlemsaften", status: "Snart" },
    { product: "Opvasketabs", current: 2, min: 3, use: 0.5, needBy: "2026-08-06", priority: "Lav", comment: "", status: "Kritisk" }
  ];
  for (const n of needs) {
    const { data: exists, error: existsError } = await supabase
      .from("shopping_needs")
      .select("id")
      .eq("organization_id", orgId)
      .eq("product_id", productIds[n.product])
      .maybeSingle();
    assertNoError(`Opslag på behov for "${n.product}"`, existsError);
    if (exists) continue;
    const { error: insertError } = await supabase.from("shopping_needs").insert({
      organization_id: orgId,
      product_id: productIds[n.product],
      current_stock: n.current,
      min_stock: n.min,
      typical_use: n.use,
      need_by_date: n.needBy,
      priority: n.priority,
      comment: n.comment,
      status: n.status,
      created_by: adminUserId,
      updated_by: adminUserId
    });
    assertNoError(`Oprettelse af behov for "${n.product}"`, insertError);
  }

  const listItems = [
    { product: "Marinerede sild", store: "Lokal Dagligvare Ebeltoft", qty: 8, price: 24.95 },
    { product: "Æg", store: "Lokal Dagligvare Ebeltoft", qty: 4, price: 22.5 },
    { product: "Rugbrød", store: "Lokal Dagligvare Ebeltoft", qty: 6, price: 15 },
    { product: "Ketchup", store: "Lokal Dagligvare Ebeltoft", qty: 3, price: 14.95 },
    { product: "Øl", store: "Djurs Drikkevarer", qty: 4, price: 149 },
    { product: "Sodavand", store: "Djurs Drikkevarer", qty: 2, price: 89 },
    { product: "Snaps", store: "Djurs Drikkevarer", qty: 6, price: 179 }
  ];
  for (const li of listItems) {
    const { data: exists, error: existsError } = await supabase
      .from("shopping_list_items")
      .select("id")
      .eq("shopping_list_id", listId)
      .eq("product_id", productIds[li.product])
      .maybeSingle();
    assertNoError(`Opslag på indkøbslistevare "${li.product}"`, existsError);
    if (exists) continue;
    const { error: insertError } = await supabase.from("shopping_list_items").insert({
      organization_id: orgId,
      shopping_list_id: listId,
      product_id: productIds[li.product],
      store_id: storeIds[li.store],
      quantity: li.qty,
      expected_price: li.price * li.qty,
      status: "behov",
      created_by: adminUserId,
      updated_by: adminUserId
    });
    assertNoError(`Oprettelse af indkøbslistevare "${li.product}"`, insertError);
  }
}

async function seedOffersAndEvents(orgId, productIds, storeIds, adminUserId) {
  const offers = [
    { product: "Kaffe", store: "Lokal Dagligvare Ebeltoft", offer: 34.95, normal: 49.95, qty: 500, unit: "g", start: "2026-07-20", end: "2026-08-01", rating: "Meget godt tilbud", level: "green" },
    { product: "Marinerede sild", store: "Ebeltoft Discount", offer: 24.95, normal: 26.95, qty: 1, unit: "glas", start: "2026-07-22", end: "2026-07-29", rating: "Svagt tilbud", level: "yellow" },
    { product: "Øl", store: "Djurs Drikkevarer", offer: 149, normal: 179, qty: 1, unit: "kasse", start: "2026-07-18", end: "2026-08-03", rating: "Godt tilbud", level: "green" },
    { product: "Rugbrød", store: "Lokal Dagligvare Ebeltoft", offer: 15, normal: 22, qty: 1, unit: "stk", start: "2026-07-24", end: "2026-07-31", rating: "Godt tilbud", level: "green" },
    { product: "Servietter", store: "Ebeltoft Discount", offer: 12, normal: 18, qty: 1, unit: "pakke", start: "2026-07-21", end: "2026-08-05", rating: "Godt tilbud", level: "green" }
  ];
  for (const o of offers) {
    const { data: exists, error: existsError } = await supabase
      .from("offers")
      .select("id")
      .eq("organization_id", orgId)
      .eq("product_id", productIds[o.product])
      .eq("store_id", storeIds[o.store])
      .maybeSingle();
    assertNoError(`Opslag på tilbud "${o.product}"`, existsError);
    if (exists) continue;
    const { error: insertError } = await supabase.from("offers").insert({
      organization_id: orgId,
      product_id: productIds[o.product],
      store_id: storeIds[o.store],
      offer_price: o.offer,
      normal_price: o.normal,
      qty: o.qty,
      unit: o.unit,
      start_date: o.start,
      end_date: o.end,
      rating: o.rating,
      rating_level: o.level,
      created_by: adminUserId
    });
    assertNoError(`Oprettelse af tilbud "${o.product}"`, insertError);
  }

  const events = [
    { name: "Medlemsaften", date: "2026-08-05", guests: 25, menu: "Let anretning, øl og vand", budget: 1500 },
    { name: "Julefrokost", date: "2026-12-05", guests: 40, menu: "Traditionel julefrokost", budget: 8000 },
    { name: "Generalforsamling", date: "2026-09-20", guests: 30, menu: "Kaffe, kage og en øl", budget: 1200 }
  ];
  for (const e of events) {
    const { data: exists, error: existsError } = await supabase
      .from("events")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", e.name)
      .maybeSingle();
    assertNoError(`Opslag på arrangement "${e.name}"`, existsError);
    if (exists) continue;
    const { error: insertError } = await supabase
      .from("events")
      .insert({ organization_id: orgId, ...e, created_by: adminUserId, updated_by: adminUserId });
    assertNoError(`Oprettelse af arrangement "${e.name}"`, insertError);
  }
}

async function main() {
  console.log("Opretter organisation …");
  const orgId = await upsertOrganization();
  console.log("Organisation:", orgId);

  console.log("Opretter brugere …");
  const userIds = {};
  let adminUserId = null;
  for (const u of TEST_USERS) {
    const id = await upsertUser(u.email, u.full_name, u.initials);
    userIds[u.full_name] = id;
    if (u.role === "administrator") adminUserId = id;
  }
  for (const u of TEST_USERS) {
    const isAdminSelf = u.role === "administrator";
    await upsertMembership(orgId, userIds[u.full_name], u.role, isAdminSelf ? null : adminUserId);
  }
  console.log("Brugere klar:", TEST_USERS.map((u) => `${u.full_name} <${u.email}> (${u.role})`).join(", "));

  console.log("Opretter kategorier og enheder …");
  const { catMap, unitMap } = await seedCategoriesAndUnits(orgId);

  console.log("Opretter produkter og lager …");
  const productIds = await seedProducts(orgId, catMap, unitMap, adminUserId);

  console.log("Opretter butikker og transportindstillinger …");
  const storeIds = await seedStores(orgId, adminUserId);
  await seedTravelSettings(orgId, adminUserId);

  console.log("Opretter indkøbsliste, behov, tilbud og arrangementer …");
  await seedShoppingListAndNeeds(orgId, productIds, storeIds, adminUserId);
  await seedOffersAndEvents(orgId, productIds, storeIds, adminUserId);

  console.log("\nFærdig!");
  console.log("----------------------------------------------------------------");
  console.log("Organisationens UUID (kopiér linjen nedenfor ind i .env.local):");
  console.log(`NEXT_PUBLIC_DEFAULT_ORG_ID=${orgId}`);
  console.log("----------------------------------------------------------------");
  console.log(
    "\nJohn Finmann (administrator) og Calle Pedersen (indkøber) har nu en profil, er aktive\n" +
      "medlemmer af Ebeltoft Marineforening med den korrekte rolle, og kan begge logge ind med\n" +
      "magic link på deres e-mail fra login-siden. Ingen adgangskode er nødvendig eller sat."
  );
}

main().catch((err) => {
  console.error("Seed fejlede:", err.message || err);
  process.exit(1);
});
