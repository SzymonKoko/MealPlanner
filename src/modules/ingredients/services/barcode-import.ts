import type { ProductImportDto } from "@/integrations/open-food-facts";
import { fetchOpenFoodFactsProduct, OpenFoodFactsError } from "@/integrations/open-food-facts";
import { getProductByBarcode } from "../repository/ingredient-repository";

type LocalProduct = Awaited<ReturnType<typeof getProductByBarcode>>;

const diffFields = [
  "name",
  "brand",
  "packageQuantity",
  "packageUnit",
  "nutritionBasis",
  "kcalPer100",
  "proteinPer100",
  "carbsPer100",
  "fatPer100",
  "fiberPer100",
  "saltPer100",
  "imageUrl",
] as const;

export type ProductDiffField = (typeof diffFields)[number];

export interface ProductImportLookupResult {
  status: "local" | "external" | "not_found";
  product?: LocalProduct;
  candidate?: ProductImportDto;
  diffs?: ProductDiffField[];
}

function normalized(value: unknown) {
  return value == null || value === "" ? null : String(value);
}

export function barcodeLookupVariants(barcode: string) {
  const normalizedBarcode = barcode.trim();
  const variants = [normalizedBarcode];
  if (/^\d{12}$/.test(normalizedBarcode)) {
    variants.push(`0${normalizedBarcode}`);
  } else if (/^0\d{12}$/.test(normalizedBarcode)) {
    variants.push(normalizedBarcode.slice(1));
  }
  return variants;
}

export function compareProductWithImport(
  product: NonNullable<LocalProduct>,
  candidate: ProductImportDto,
) {
  return diffFields.filter((field) => normalized(product[field]) !== normalized(candidate[field]));
}

export async function lookupBarcodeProduct(
  householdId: string,
  barcode: string,
  refresh = false,
): Promise<ProductImportLookupResult> {
  const variants = barcodeLookupVariants(barcode);
  let localProduct: LocalProduct | null = null;
  for (const variant of variants) {
    localProduct = await getProductByBarcode(householdId, variant);
    if (localProduct) break;
  }
  if (localProduct && !refresh) {
    return { status: "local", product: localProduct };
  }

  for (const variant of variants) {
    try {
      const candidate = await fetchOpenFoodFactsProduct(variant);
      if (localProduct) {
        return {
          status: "external",
          product: localProduct,
          candidate,
          diffs: compareProductWithImport(localProduct, candidate),
        };
      }
      return { status: "external", candidate, diffs: [] };
    } catch (error) {
      if (error instanceof OpenFoodFactsError && error.code === "NOT_FOUND") {
        continue;
      }
      throw error;
    }
  }
  return { status: "not_found" };
}
