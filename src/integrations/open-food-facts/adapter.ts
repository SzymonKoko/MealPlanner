import { productImportDtoSchema, type ProductImportDto } from "./schemas";

function parseDecimalString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    if (/^\d+(\.\d+)?$/.test(normalized)) {
      return normalized;
    }
  }
  return null;
}

function parsePackage(quantity?: string | null) {
  if (!quantity) return { packageQuantity: null, packageUnit: null };
  const normalized = quantity.trim().toLowerCase().replace(",", ".");
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(kg|g|ml|l|szt)$/);
  if (!match) return { packageQuantity: null, packageUnit: null };
  return {
    packageQuantity: match[1],
    packageUnit: match[2] as ProductImportDto["packageUnit"],
  };
}

function resolveBasis(nutriments?: Record<string, unknown>) {
  const has100ml = [
    nutriments?.["energy-kcal_100ml"],
    nutriments?.proteins_100ml,
    nutriments?.carbohydrates_100ml,
    nutriments?.fat_100ml,
    nutriments?.fiber_100ml,
    nutriments?.salt_100ml,
  ].some((value) => parseDecimalString(value) !== null);
  return has100ml ? "per100ml" : "per100g";
}

export function mapOpenFoodFactsProduct(input: {
  code: string;
  product?: {
    product_name?: string;
    brands?: string;
    quantity?: string;
    serving_size?: string;
    image_url?: string;
    last_modified_t?: number;
    last_updated_t?: number;
    nutriments?: Record<string, unknown>;
  };
}): ProductImportDto {
  const basis = resolveBasis(input.product?.nutriments);
  const suffix = basis === "per100ml" ? "100ml" : "100g";
  const nutriments = input.product?.nutriments ?? {};
  const quantity = parsePackage(input.product?.quantity);
  const warnings: string[] = [];

  if (!input.product?.product_name?.trim()) warnings.push("Brak nazwy produktu w Open Food Facts");
  if (!Object.keys(nutriments).length) warnings.push("Brak wartości odżywczych w Open Food Facts");

  const dto = productImportDtoSchema.parse({
    barcode: input.code,
    name: input.product?.product_name?.trim() ?? "",
    brand: input.product?.brands?.trim() || null,
    packageQuantity: quantity.packageQuantity,
    packageUnit: quantity.packageUnit,
    servingSize: input.product?.serving_size?.trim() || null,
    imageUrl: input.product?.image_url ?? null,
    nutritionBasis: basis,
    kcalPer100: parseDecimalString(nutriments[`energy-kcal_${suffix}`]),
    proteinPer100: parseDecimalString(nutriments[`proteins_${suffix}`]),
    carbsPer100: parseDecimalString(nutriments[`carbohydrates_${suffix}`]),
    fatPer100: parseDecimalString(nutriments[`fat_${suffix}`]),
    fiberPer100: parseDecimalString(nutriments[`fiber_${suffix}`]),
    saltPer100: parseDecimalString(nutriments[`salt_${suffix}`]),
    dataSource: "open_food_facts",
    externalId: input.code,
    sourceUpdatedAt: input.product?.last_updated_t || input.product?.last_modified_t
      ? new Date(((input.product?.last_updated_t ?? input.product?.last_modified_t) as number) * 1000)
      : null,
    warnings,
  });

  if (
    !dto.kcalPer100 &&
    !dto.proteinPer100 &&
    !dto.carbsPer100 &&
    !dto.fatPer100 &&
    !dto.fiberPer100 &&
    !dto.saltPer100
  ) {
    dto.warnings.push("Open Food Facts nie zwrócił użytecznych makroskładników");
  }

  return dto;
}
