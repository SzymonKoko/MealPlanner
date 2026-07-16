import { z } from "zod";
import {
  ingredientCreateSchema,
  ingredientUnitConversionSchema,
} from "./ingredient-schemas";

export const usdaSearchQuerySchema = z.object({
  query: z.string().trim().min(2).max(120),
});

export const usdaFoodIdSchema = z.object({
  fdcId: z.coerce.number().int().positive(),
});

export const approveUsdaIngredientSchema = ingredientCreateSchema.extend({
  externalId: z.string().min(1).max(100),
  sourceUpdatedAt: z.coerce.date().optional().nullable(),
  originalName: z.string().min(1).max(300),
  dataSource: z.literal("usda").default("usda"),
  foodCategory: z.string().max(200).optional().nullable(),
  dataType: z.string().max(100).optional().nullable(),
  translatedQuery: z.string().max(120).optional(),
  conversions: z.array(ingredientUnitConversionSchema).optional(),
});
