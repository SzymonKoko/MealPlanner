import {
  ingredientImportDtoSchema,
  ingredientImportSearchResultDtoSchema,
  type IngredientImportDto,
} from "./schemas";

function classifyState(text: string) {
  const value = text.toLowerCase();
  if (/\b(raw|fresh|uncooked)\b/.test(value)) return "raw" as const;
  if (/\b(cooked|boiled|roasted|baked|fried|steamed)\b/.test(value)) return "cooked" as const;
  if (/\b(processed|canned|frozen|powder|mix)\b/.test(value)) return "processed" as const;
  return "unknown" as const;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(4).replace(/\.?0+$/, "") : null;
}

function sodiumToSalt(amount: number | null) {
  if (amount == null) return null;
  return ((amount / 1000) * 2.5).toFixed(4).replace(/\.?0+$/, "");
}

function findNutrientByName(
  nutrients: Array<{
    nutrient?: { name?: string; number?: string };
    amount?: number;
  }> | undefined,
  names: string[],
) {
  const match = nutrients?.find((item) =>
    names.some((name) => item.nutrient?.name?.toLowerCase() === name.toLowerCase()),
  );
  return match?.amount ?? null;
}

export function mapUsdaSearchResults(
  foods: Array<{
    fdcId: number;
    description?: string;
    additionalDescriptions?: string;
    foodCategory?: string;
    dataType?: string;
    foodNutrients?: Array<{ nutrientName?: string; value?: number }>;
  }>,
) {
  return foods.slice(0, 8).map((food) =>
    ingredientImportSearchResultDtoSchema.parse({
      externalId: String(food.fdcId),
      name: food.description?.trim() || `USDA #${food.fdcId}`,
      description: food.additionalDescriptions?.trim() || null,
      foodCategory: food.foodCategory?.trim() || null,
      dataType: food.dataType?.trim() || null,
      state: classifyState(`${food.description ?? ""} ${food.additionalDescriptions ?? ""}`),
      kcalPer100: normalizeNumber(
        food.foodNutrients?.find((item) => item.nutrientName?.toLowerCase() === "energy")?.value ?? null,
      ),
      dataSource: "usda",
    }),
  );
}

export function mapUsdaFoodDetails(food: {
  fdcId: number;
  description?: string;
  foodClass?: string;
  dataType?: string;
  foodCategory?: { description?: string };
  foodNutrients?: Array<{
    nutrient?: { name?: string; number?: string };
    amount?: number;
  }>;
}): IngredientImportDto {
  const protein = findNutrientByName(food.foodNutrients, ["Protein"]);
  const carbs = findNutrientByName(food.foodNutrients, ["Carbohydrate, by difference"]);
  const fat = findNutrientByName(food.foodNutrients, ["Total lipid (fat)"]);
  const fiber = findNutrientByName(food.foodNutrients, ["Fiber, total dietary"]);
  const energy = findNutrientByName(food.foodNutrients, ["Energy"]);
  const sodium = findNutrientByName(food.foodNutrients, ["Sodium, Na"]);
  const warnings: string[] = [];

  if (!food.description?.trim()) warnings.push("USDA nie zwróciło nazwy składnika");
  if (!energy && !protein && !carbs && !fat && !fiber && !sodium) {
    warnings.push("USDA nie zwróciło pełnych wartości odżywczych");
  }

  return ingredientImportDtoSchema.parse({
    externalId: String(food.fdcId),
    name: food.description?.trim() || `USDA #${food.fdcId}`,
    originalName: food.description?.trim() || `USDA #${food.fdcId}`,
    description: food.foodClass?.trim() || null,
    foodCategory: food.foodCategory?.description?.trim() || null,
    dataType: food.dataType?.trim() || null,
    nutritionBasis: "per100g",
    kcalPer100: normalizeNumber(energy),
    proteinPer100: normalizeNumber(protein),
    carbsPer100: normalizeNumber(carbs),
    fatPer100: normalizeNumber(fat),
    fiberPer100: normalizeNumber(fiber),
    saltPer100: sodiumToSalt(sodium),
    dataSource: "usda",
    sourceUpdatedAt: null,
    warnings,
  });
}
