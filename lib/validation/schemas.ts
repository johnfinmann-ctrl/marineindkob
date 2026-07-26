import { z } from "zod";

export const shoppingNeedSchema = z.object({
  product_id: z.string().uuid({ message: "Vælg et produkt." }),
  current_stock: z.number().min(0, "Antal kan ikke være negativt."),
  min_stock: z.number().min(0, "Minimumslager kan ikke være negativt."),
  typical_use: z.number().min(0, "Forbrug kan ikke være negativt."),
  need_by_date: z.string().date().optional().or(z.literal("")),
  priority: z.enum(["Høj", "Middel", "Lav"]),
  comment: z.string().max(500, "Kommentar må højst være 500 tegn.").optional()
});
export type ShoppingNeedInput = z.infer<typeof shoppingNeedSchema>;

export const offerSchema = z
  .object({
    product_id: z.string().uuid({ message: "Vælg et produkt." }),
    store_id: z.string().uuid({ message: "Vælg en butik." }),
    offer_price: z.number().positive("Tilbudsprisen skal være positiv."),
    normal_price: z.number().positive("Normalprisen skal være positiv."),
    qty: z.number().positive("Mængden skal være positiv.").default(1),
    unit: z.string().min(1, "Angiv en enhed."),
    start_date: z.string().date(),
    end_date: z.string().date(),
    max_per_customer: z.number().int().positive().optional(),
    member_price: z.number().positive().optional(),
    notes: z.string().max(500).optional()
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "Slutdato skal være efter startdato.",
    path: ["end_date"]
  });
export type OfferInput = z.infer<typeof offerSchema>;

export const eventSchema = z.object({
  name: z.string().min(2, "Navnet skal være mindst 2 tegn."),
  date: z.string().date(),
  guests: z.number().int().min(1, "Angiv mindst 1 deltager."),
  menu: z.string().max(500).optional(),
  budget: z.number().min(0, "Budget kan ikke være negativt.")
});
export type EventInput = z.infer<typeof eventSchema>;

export const stockAdjustmentSchema = z.object({
  product_id: z.string().uuid(),
  delta: z.number().refine((n) => n !== 0, "Ændringen kan ikke være 0."),
  movement_type: z.enum(["køb", "forbrug", "manuel regulering", "kassation", "arrangement", "korrektion"]),
  expected_version: z.number().int().optional(),
  note: z.string().max(300).optional()
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const inviteUserSchema = z.object({
  email: z.string().email("Angiv en gyldig e-mailadresse."),
  full_name: z.string().min(2, "Navnet skal være mindst 2 tegn."),
  role: z.enum(["indkober", "administrator"])
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const loginSchema = z.object({
  email: z.string().email("Indtast en gyldig e-mailadresse.")
});
export type LoginInput = z.infer<typeof loginSchema>;
