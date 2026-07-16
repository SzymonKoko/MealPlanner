import { z } from "zod";

export const openFoodFactsNutrimentsSchema = z
  .object({
    "energy-kcal_100g": z.unknown().optional(),
    "energy-kcal_100ml": z.unknown().optional(),
    proteins_100g: z.unknown().optional(),
    proteins_100ml: z.unknown().optional(),
    carbohydrates_100g: z.unknown().optional(),
    carbohydrates_100ml: z.unknown().optional(),
    fat_100g: z.unknown().optional(),
    fat_100ml: z.unknown().optional(),
    fiber_100g: z.unknown().optional(),
    fiber_100ml: z.unknown().optional(),
    salt_100g: z.unknown().optional(),
    salt_100ml: z.unknown().optional(),
  })
  .passthrough();

export const openFoodFactsProductSchema = z
  .object({
    code: z.string().optional(),
    product_name: z.string().optional(),
    brands: z.string().optional(),
    quantity: z.string().optional(),
    serving_size: z.string().optional(),
    image_url: z.string().url().optional(),
    last_modified_t: z.number().optional(),
    last_updated_t: z.number().optional(),
    nutriments: openFoodFactsNutrimentsSchema.optional(),
  })
  .passthrough();

export const openFoodFactsResponseSchema = z
  .object({
    code: z.string().optional(),
    status: z.number().optional(),
    product: openFoodFactsProductSchema.optional(),
  })
  .passthrough();

export const productImportDtoSchema = z.object({
  barcode: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  packageQuantity: z.string().nullable(),
  packageUnit: z.enum(["g", "kg", "ml", "l", "szt"]).nullable(),
  servingSize: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  nutritionBasis: z.enum(["per100g", "per100ml"]),
  kcalPer100: z.string().nullable(),
  proteinPer100: z.string().nullable(),
  carbsPer100: z.string().nullable(),
  fatPer100: z.string().nullable(),
  fiberPer100: z.string().nullable(),
  saltPer100: z.string().nullable(),
  dataSource: z.literal("open_food_facts"),
  externalId: z.string(),
  sourceUpdatedAt: z.date().nullable(),
  warnings: z.array(z.string()),
});

export type ProductImportDto = z.infer<typeof productImportDtoSchema>;
