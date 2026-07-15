import { z } from "zod";
import { SUPPORTED_UNITS } from "@/lib/units";

export const recipeIngredientSchema = z
  .object({
    ingredientId: z.string().uuid().optional().nullable(),
    productId: z.string().uuid().optional().nullable(),
    quantity: z.string().min(1),
    unit: z.enum(SUPPORTED_UNITS),
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
  prepTimeMinutes: z.coerce.number().int().optional(),
  cookTimeMinutes: z.coerce.number().int().optional(),
  imageUrl: z.string().url().optional().nullable(),
  ingredients: z.array(recipeIngredientSchema).min(1),
  tagIds: z.array(z.string().uuid()).optional(),
});
