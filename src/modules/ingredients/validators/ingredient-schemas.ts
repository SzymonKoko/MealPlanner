import { z } from "zod";
import { SUPPORTED_UNITS } from "@/lib/units";

const optionalNonNegativeNumber = z
  .string()
  .regex(/^\d+([.,]\d+)?$/)
  .transform((value) => value.replace(",", "."))
  .optional();
const optionalPositiveNumber = z
  .string()
  .regex(/^\d+([.,]\d+)?$/)
  .transform((value) => value.replace(",", "."))
  .refine((value) => Number(value) > 0)
  .optional();

export const ingredientSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  baseUnit: z.enum(SUPPORTED_UNITS).default("g"),
  kcalPer100: optionalNonNegativeNumber,
  proteinPer100: optionalNonNegativeNumber,
  carbsPer100: optionalNonNegativeNumber,
  fatPer100: optionalNonNegativeNumber,
  fiberPer100: optionalNonNegativeNumber,
  densityGramsPerMl: optionalPositiveNumber,
  allergens: z.string().max(500).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const productSchema = z.object({
  ingredientId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(200),
  brand: z.string().max(100).optional(),
  barcode: z.string().max(50).optional(),
  packageQuantity: optionalNonNegativeNumber,
  packageUnit: z.enum(SUPPORTED_UNITS).optional(),
  kcalPer100: optionalNonNegativeNumber,
  proteinPer100: optionalNonNegativeNumber,
  carbsPer100: optionalNonNegativeNumber,
  fatPer100: optionalNonNegativeNumber,
  fiberPer100: optionalNonNegativeNumber,
  tagIds: z.array(z.string().uuid()).optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.coerce.number().int().default(0),
});

export const tagSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(["ingredient", "product", "recipe"]),
});
