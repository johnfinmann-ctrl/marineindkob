// =============================================================
// MarineIndkøb — Fase 3
// Seed-script: opretter organisation, testbrugere og demodata.
// =============================================================
// Kør med:  npm run seed
// Kræver .env.local med NEXT_PUBLIC_SUPABASE_URL og
// SUPABASE_SERVICE_ROLE_KEY (se README, afsnit "Seed-data").
//
// Scriptet er "idempotent-venligt": kør det roligt igen, hvis noget
// fejler undervejs — det springer allerede oprettede rækker over,
// hvor det er muligt at genkende dem (organisation, produkter, butikker).
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

const ORG_NAME = "Ebeltoft Marineforening";

// Testbrugere. Disse e-mailadresser er ikke rigtige postkasser —
// erstat dem med foreningens egne e-mails, før I bruger appen i praksis.
const TEST_USERS = [
  { email: "jens@marineindkob-demo.dk", full_name: "Jens", initials: "J", role: "indkober" },
  { email: "anna@marineindkob-demo.dk", full_name: "Anna", initials: "A", role: "indkober" },
  { email: "bo.admin@marineindkob-demo.dk", full_name: "Bo", initials: "B", role: "administrator" }
];

async function upsertOrganization() {
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", ORG_NAME)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: ORG_NAME })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function upsertUser(email, full_name, initials) {
  // Opret bruger via Auth Admin API. E-mailen bekræftes automatisk,
  // og der sættes IKKE en adgangskode, da login foregår med magic link.
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name }
  });

  let userId;
  if (error) {
    if (error.message?.toLowerCase().includes("already been registered")) {
      const { data: list } = await supabase.auth.admin.listUsers();
      const found = list.users.find((u) => u.email === email);
      if (!found) throw error;
      userId = found.id;
    } else {
      throw error;
    }
  } else {
    userId = created.user.id;
  }

  await supabase
    .from("profiles")
    .upsert({ id: userId, full_name, initials }, { onConflict: "id" });

  return userId;
}

async function upsertMembership(orgId, userId, roleCode, invitedBy) {
  const { data: role } = await supabase.from("roles").select("id").eq("code", roleCode).single();
  await supabase.from("organization_members").upsert(
    {
      organization_id: orgId,
      user_id: userId,
      role_id: role.id,
      active: true,
      invited_by: invitedBy ?? null
    },
    { onConflict: "organization_id,user_id" }
  );
}

async function seedCategoriesAndUnits(orgId) {
  const categories = ["Bagværk", "Kølevarer", "Fisk", "Pålæg", "Kolonial", "Drikkevarer", "Forbrugsvarer"];
  const catMap = {};
  for (const name of categories) {
    const { data } = await supabase
      .from("product_categories")
      .upsert({ organization_id: orgId, name }, { onConflict: "organization_id,name" })
      .select("id, name")
      .maybeSingle();
    if (data) catMap[name] = data.id;
    else {
      const { data: existing } = await supabase
        .from("product_categories")
        .select("id")
        .eq("organization_id", orgId)
        .eq("name", name)
        .single();
      catMap[name] = existing.id;
    }
  }

  const units = [
    ["stk", "styk"], ["bakker", "bakker"], ["glas", "glas"], ["kg", "kilogram"],
    ["dåser", "dåser"], ["flasker", "flasker"], ["pakker", "pakker"], ["kasser", "kasser"]
  ];
  const unitMap = {};
  for (const [code, name] of units) {
    const { data: existing } = await supabase
      .from("product_units")
      .select("id")
      .eq("organization_id", orgId)
      .eq("code", code)
      .maybeSingle();
    if (existing) {
      unitMap[code] = existing.id;
    } else {
      const { data } = await supabase
        .from("product_units")
        .insert({ organization_id: orgId, code, name })
        .select("id")
        .single();
      unitMap[code] = data.id;
    }
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
  { name: "Lokal Dagligvare Ebeltoft", type: "Supermarked", distance_km: 2.4, delivery: false, delivery_price: 0, min_order: 0, hours: "08–20" },
  { name: "Ebeltoft Discount", type: "Discount", distance_km: 3.1, delivery: false, delivery_price: 0, min_order: 0, hours: "08–20" },
  { name: "Djurs Drikkevarer", type: "Drikkevarer", distance_km: 6.5, delivery: true, delivery_price: 49, min_order: 300, hours: "10–17:30" },
  { name: "Aarhus Catering Online", type: "Netbutik", distance_km: null, delivery: true, delivery_price: 99, min_order: 500, hours: "Online — altid åben" },
  { name: "Mols Specialiteter", type: "Specialbutik", distance_km: 12, delivery: false, delivery_price: 0, min_order: 0, hours: "10–17" }
];

async function seedProducts(orgId, catMap, unitMap, adminUserId) {
  const productIds = {};
  for (const p of PRODUCTS) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", p.name)
      .maybeSingle();

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
      if (error) throw error;
      id = data.id;
    }
    productIds[p.name] = id;

    const { data: stockExisting } = await supabase
      .from("stock_items")
      .select("id")
      .eq("organization_id", orgId)
      .eq("product_id", id)
      .maybeSingle();

    if (!stockExisting) {
      await supabase.from("stock_items").insert({
        organization_id: orgId,
        product_id: id,
        quantity: p.stock,
        minimum_quantity: p.min,
        unit_id: unitMap[p.unit],
        average_weekly_consumption: p.weeklyUse,
        updated_by: adminUserId
      });
    }
  }
  return productIds;
}

async function seedStores(orgId, adminUserId) {
  const storeIds = {};
  for (const s of STORES) {
    const { data: existing } = await supabase
      .from("stores")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", s.name)
      .maybeSingle();
    if (existing) {
      storeIds[s.name] = existing.id;
      continue;
    }
    const { data, error } = await supabase
      .from("stores")
      .insert({ organization_id: orgId, ...s, created_by: adminUserId, updated_by: adminUserId })
      .select("id")
      .single();
    if (error) throw error;
    storeIds[s.name] = data.id;
  }
  return storeIds;
}

async function seedTravelSettings(orgId, adminUserId) {
  const { data: existing } = await supabase
    .from("travel_cost_settings")
    .select("id")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (existing) return;
  await supabase.from("travel_cost_settings").insert({
    organization_id: orgId,
    price_per_km: 3.2,
    average_speed_kmh: 45,
    updated_by: adminUserId
  });
}

async function seedShoppingListAndNeeds(orgId, productIds, storeIds, adminUserId) {
  const { data: existingList } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("organization_id", orgId)
    .eq("status", "aktiv")
    .maybeSingle();

  let listId = existingList?.id;
  if (!listId) {
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ organization_id: orgId, name: "Aktiv indkøbsliste", created_by: adminUserId })
      .select("id")
      .single();
    if (error) throw error;
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
    const { data: exists } = await supabase
      .from("shopping_needs")
      .select("id")
      .eq("organization_id", orgId)
      .eq("product_id", productIds[n.product])
      .maybeSingle();
    if (exists) continue;
    await supabase.from("shopping_needs").insert({
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
    const { data: exists } = await supabase
      .from("shopping_list_items")
      .select("id")
      .eq("shopping_list_id", listId)
      .eq("product_id", productIds[li.product])
      .maybeSingle();
    if (exists) continue;
    await supabase.from("shopping_list_items").insert({
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
    const { data: exists } = await supabase
      .from("offers")
      .select("id")
      .eq("organization_id", orgId)
      .eq("product_id", productIds[o.product])
      .eq("store_id", storeIds[o.store])
      .maybeSingle();
    if (exists) continue;
    await supabase.from("offers").insert({
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
  }

  const events = [
    { name: "Medlemsaften", date: "2026-08-05", guests: 25, menu: "Let anretning, øl og vand", budget: 1500 },
    { name: "Julefrokost", date: "2026-12-05", guests: 40, menu: "Traditionel julefrokost", budget: 8000 },
    { name: "Generalforsamling", date: "2026-09-20", guests: 30, menu: "Kaffe, kage og en øl", budget: 1200 }
  ];
  for (const e of events) {
    const { data: exists } = await supabase
      .from("events")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", e.name)
      .maybeSingle();
    if (exists) continue;
    await supabase.from("events").insert({ organization_id: orgId, ...e, created_by: adminUserId, updated_by: adminUserId });
  }
}

async function main() {
  console.log("Opretter organisation …");
  const orgId = await upsertOrganization();
  console.log("Organisation:", orgId);

  console.log("Opretter testbrugere …");
  const userIds = {};
  let adminUserId = null;
  for (const u of TEST_USERS) {
    const id = await upsertUser(u.email, u.full_name, u.initials);
    userIds[u.full_name] = id;
    if (u.role === "administrator") adminUserId = id;
  }
  for (const u of TEST_USERS) {
    await upsertMembership(orgId, userIds[u.full_name], u.role, adminUserId);
  }
  console.log("Brugere oprettet:", TEST_USERS.map((u) => `${u.full_name} (${u.role})`).join(", "));

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
  console.log("Organisation-id (brug som NEXT_PUBLIC_DEFAULT_ORG_ID):", orgId);
  console.log(
    "\nHusk: testbrugerne har ingen adgangskode. De logger ind med magic link på de e-mails, du har sat i TEST_USERS (ret dem i supabase/seed/run-seed.mjs til foreningens rigtige e-mails, før I bruger appen i praksis)."
  );
}

main().catch((err) => {
  console.error("Seed fejlede:", err.message || err);
  process.exit(1);
});
