import { z } from "zod";
import { mealTypeEnum } from "@/db/schema/meal-planner";
import { RECIPE_SUPPORTED_UNITS } from "@/lib/units";

const optionSchema = z
  .object({
    ingredientId: z.string().uuid().nullable().optional(),
    productId: z.string().uuid().nullable().optional(),
    quantity: z.coerce.number().positive(),
    unit: z.enum(RECIPE_SUPPORTED_UNITS),
    sortOrder: z.number().int().nonnegative().optional(),
  })
  .refine((value) => Boolean(value.ingredientId) !== Boolean(value.productId), {
    message: "Wariant musi wskazywać dokładnie jeden składnik lub produkt",
  });

export const compositionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  sections: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    sortOrder: z.number().int().nonnegative().optional(),
    options: z.array(optionSchema).min(1, "Dodaj co najmniej jeden wariant"),
  })).min(1, "Dodaj co najmniej jedną sekcję"),
});

export const composeMealSchema = z.object({
  compositionId: z.string().uuid(),
  optionIds: z.array(z.string().uuid()).min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(mealTypeEnum),
  planScope: z.enum(["mine", "household"]).default("mine"),
});

export type CompositionInput = z.infer<typeof compositionSchema>;
