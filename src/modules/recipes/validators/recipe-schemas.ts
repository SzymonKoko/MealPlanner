import { z } from "zod";
import { RECIPE_SUPPORTED_UNITS } from "@/lib/units";

export const recipeIngredientSchema = z
  .object({
    ingredientId: z.string().uuid().optional().nullable(),
    productId: z.string().uuid().optional().nullable(),
    quantity: z
      .string()
      .regex(/^\d+([.,]\d+)?$/, "Ilość musi być liczbą dodatnią")
      .transform((value) => value.replace(",", "."))
      .refine((value) => Number(value) > 0, "Ilość musi być większa od zera"),
    unit: z.enum(RECIPE_SUPPORTED_UNITS),
    optional: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
  })
  .refine((data) => Boolean(data.ingredientId) !== Boolean(data.productId), {
    message: "Ustaw ingredientId albo productId, nie oba",
  });

export const recipeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  instructions: z.string().max(10000).optional(),
  servings: z.coerce.number().int().min(1).default(1),
  prepTimeMinutes: z.coerce.number().int().min(0).optional(),
  cookTimeMinutes: z.coerce.number().int().min(0).optional(),
  imageUrl: z
    .string()
    .refine((value) => value.startsWith("/") || URL.canParse(value), "Nieprawidłowy adres zdjęcia")
    .optional()
    .nullable(),
  ingredients: z.array(recipeIngredientSchema).min(1),
  tagIds: z.array(z.string().uuid()).optional(),
});
