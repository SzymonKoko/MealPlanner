import { z } from "zod";
import { RECIPE_SUPPORTED_UNITS, SUPPORTED_UNITS } from "@/lib/units";
import {
  nutritionBasisEnum,
  nutritionDataSourceEnum,
} from "@/db/schema/ingredients";

export const optionalNonNegativeDecimal = z
  .string()
  .regex(/^\d+([.,]\d+)?$/)
  .transform((value) => value.replace(",", "."))
  .refine((value) => Number(value) >= 0)
  .optional();
const optionalPositiveNumber = z
  .string()
  .regex(/^\d+([.,]\d+)?$/)
  .transform((value) => value.replace(",", "."))
  .refine((value) => Number(value) > 0)
  .optional();

export const nutritionValuesSchema = z.object({
  nutritionBasis: z.enum(nutritionBasisEnum).default("per100g"),
  kcalPer100: optionalNonNegativeDecimal,
  proteinPer100: optionalNonNegativeDecimal,
  carbsPer100: optionalNonNegativeDecimal,
  fatPer100: optionalNonNegativeDecimal,
  fiberPer100: optionalNonNegativeDecimal,
  saltPer100: optionalNonNegativeDecimal,
});

function hasValidGtinCheckDigit(value: string) {
  const digits = value.split("").map(Number);
  const checkDigit = digits.pop();
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return checkDigit === (10 - (sum % 10)) % 10;
}

export const barcodeValueSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => [8, 12, 13, 14].includes(value.length) && /^\d+$/.test(value), {
    message: "Kod kreskowy musi być numerem GTIN-8, UPC-12, EAN-13 lub GTIN-14",
  })
  .refine(hasValidGtinCheckDigit, { message: "Kod kreskowy ma nieprawidłową cyfrę kontrolną" });

export const barcodeSchema = barcodeValueSchema.optional();

const ingredientFields = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  baseUnit: z.enum(SUPPORTED_UNITS).default("g"),
  densityGramsPerMl: optionalPositiveNumber,
  allergens: z.string().max(500).optional(),
  verifiedByUser: z.boolean().default(false),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const ingredientCreateSchema = ingredientFields.merge(nutritionValuesSchema);
export const ingredientUpdateSchema = ingredientCreateSchema;
export const ingredientSchema = ingredientCreateSchema;

const productFields = z.object({
  ingredientId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(200),
  brand: z.string().max(100).optional(),
  barcode: barcodeSchema,
  packageQuantity: optionalNonNegativeDecimal,
  packageUnit: z.enum(SUPPORTED_UNITS).optional(),
  verifiedByUser: z.boolean().default(false),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const productCreateSchema = productFields
  .merge(nutritionValuesSchema)
  .refine((value) => !value.packageQuantity || Boolean(value.packageUnit), {
    message: "Jednostka opakowania jest wymagana, gdy podano ilość",
    path: ["packageUnit"],
  });
export const productUpdateSchema = productCreateSchema;
export const productSchema = productCreateSchema;

export const nutritionSourceSchema = z.object({
  dataSource: z.enum(nutritionDataSourceEnum),
  externalId: z.string().max(200).optional().nullable(),
  importedAt: z.coerce.date().optional().nullable(),
  sourceUpdatedAt: z.coerce.date().optional().nullable(),
  verifiedByUser: z.boolean(),
  manuallyModified: z.boolean(),
});

export const ingredientUnitConversionSchema = z.object({
  unit: z.enum(RECIPE_SUPPORTED_UNITS).refine((value) => value !== "g" && value !== "kg" && value !== "ml" && value !== "l", {
    message: "Dodatkowa konwersja powinna dotyczyć jednostki domowej",
  }),
  gramsEquivalent: optionalPositiveNumber,
  label: z.string().max(100).optional(),
  isDefault: z.boolean().default(false),
});

export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.coerce.number().int().default(0),
});

export const tagSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(["ingredient", "product", "recipe"]),
});
