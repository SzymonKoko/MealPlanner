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
  const localProduct = await getProductByBarcode(householdId, barcode);
  if (localProduct && !refresh) {
    return { status: "local", product: localProduct };
  }

  try {
    const candidate = await fetchOpenFoodFactsProduct(barcode);
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
    if (!localProduct && error instanceof OpenFoodFactsError && error.code === "NOT_FOUND") {
      return { status: "not_found" };
    }
    throw error;
  }
}
