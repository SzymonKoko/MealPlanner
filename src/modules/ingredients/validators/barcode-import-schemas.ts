import { z } from "zod";
import {
  barcodeValueSchema,
  nutritionValuesSchema,
  optionalNonNegativeDecimal,
} from "./ingredient-schemas";
import { nutritionDataSourceEnum } from "@/db/schema/ingredients";
import { SUPPORTED_UNITS } from "@/lib/units";

export const requiredBarcodeSchema = barcodeValueSchema;

export const productImportLookupSchema = z.object({
  barcode: requiredBarcodeSchema,
  refresh: z.boolean().optional().default(false),
});

export const approveImportedProductSchema = nutritionValuesSchema.extend({
  existingProductId: z.string().uuid().optional(),
  ingredientId: z.string().uuid().optional().nullable(),
  barcode: requiredBarcodeSchema,
  name: z.string().min(1).max(200),
  brand: z.string().max(100).optional(),
  packageQuantity: optionalNonNegativeDecimal,
  packageUnit: z.enum(SUPPORTED_UNITS).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  sourceUpdatedAt: z.coerce.date().optional().nullable(),
  externalId: z.string().max(200).optional().nullable(),
  dataSource: z.enum(nutritionDataSourceEnum).default("manual"),
  verifiedByUser: z.boolean().default(false),
}).refine((value) => !value.packageQuantity || Boolean(value.packageUnit), {
  message: "Jednostka opakowania jest wymagana, gdy podano ilość",
  path: ["packageUnit"],
});
