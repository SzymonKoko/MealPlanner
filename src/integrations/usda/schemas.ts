import { z } from "zod";

export const usdaSearchResultSchema = z
  .object({
    fdcId: z.number(),
    description: z.string().optional(),
    lowercaseDescription: z.string().optional(),
    additionalDescriptions: z.string().optional(),
    foodCategory: z.string().optional(),
    dataType: z.string().optional(),
    score: z.number().optional(),
    foodNutrients: z.array(
      z.object({
        nutrientName: z.string().optional(),
        value: z.number().optional(),
      }).passthrough(),
    ).optional(),
  })
  .passthrough();

export const usdaSearchResponseSchema = z
  .object({
    foods: z.array(usdaSearchResultSchema).optional(),
  })
  .passthrough();

export const usdaFoodNutrientSchema = z
  .object({
    nutrient: z.object({
      number: z.string().optional(),
      name: z.string().optional(),
      unitName: z.string().optional(),
    }).optional(),
    amount: z.number().optional(),
  })
  .passthrough();

export const usdaFoodDetailsResponseSchema = z
  .object({
    fdcId: z.number(),
    description: z.string().optional(),
    foodClass: z.string().optional(),
    dataType: z.string().optional(),
    foodCategory: z.object({ description: z.string().optional() }).optional(),
    foodNutrients: z.array(usdaFoodNutrientSchema).optional(),
  })
  .passthrough();

export const ingredientImportSearchResultDtoSchema = z.object({
  externalId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  foodCategory: z.string().nullable(),
  dataType: z.string().nullable(),
  state: z.enum(["raw", "cooked", "processed", "unknown"]),
  kcalPer100: z.string().nullable(),
  dataSource: z.literal("usda"),
});

export const ingredientImportDtoSchema = z.object({
  externalId: z.string(),
  name: z.string(),
  originalName: z.string(),
  description: z.string().nullable(),
  foodCategory: z.string().nullable(),
  dataType: z.string().nullable(),
  nutritionBasis: z.literal("per100g"),
  kcalPer100: z.string().nullable(),
  proteinPer100: z.string().nullable(),
  carbsPer100: z.string().nullable(),
  fatPer100: z.string().nullable(),
  fiberPer100: z.string().nullable(),
  saltPer100: z.string().nullable(),
  dataSource: z.literal("usda"),
  sourceUpdatedAt: z.date().nullable(),
  warnings: z.array(z.string()),
});

export type IngredientImportDto = z.infer<typeof ingredientImportDtoSchema>;
export type IngredientImportSearchResultDto = z.infer<typeof ingredientImportSearchResultDtoSchema>;
