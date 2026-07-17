import {
  calculateNutritionForQuantity,
  perServing,
  scaleNutrition,
  sumNutrition,
  EMPTY_NUTRITION,
  type NutritionPer100,
  type NutritionValues,
} from "@/lib/nutrition";
import { getRecipeWithIngredients } from "@/modules/recipes/repository/recipe-repository";
import { getIngredientUnitConversions } from "@/modules/ingredients/repository/ingredient-repository";
import { db } from "@/db/client";
import { ingredients, products } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

async function nutritionForIngredientSource(
  householdId: string,
  ingredientId: string,
  quantity: number,
  unit: string,
): Promise<NutritionValues> {
  const [ingredient] = await db
    .select()
    .from(ingredients)
    .where(
      and(
        eq(ingredients.id, ingredientId),
        eq(ingredients.householdId, householdId),
        isNull(ingredients.deletedAt),
      ),
    )
    .limit(1);
  if (!ingredient) return { ...EMPTY_NUTRITION };

  try {
    return calculateNutritionForQuantity(
      {
        ...ingredient,
        unitConversions: await getIngredientUnitConversions([ingredient.id]),
      },
      quantity,
      unit,
    );
  } catch {
    return { ...EMPTY_NUTRITION };
  }
}

async function nutritionForProductByQuantity(
  householdId: string,
  productId: string,
  quantity: number,
  unit: string,
): Promise<NutritionValues> {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.householdId, householdId)))
    .limit(1);
  if (!product) return { ...EMPTY_NUTRITION };

  const [linkedIngredient] = product.ingredientId
    ? await db
        .select({ id: ingredients.id, densityGramsPerMl: ingredients.densityGramsPerMl })
        .from(ingredients)
        .where(
          and(
            eq(ingredients.id, product.ingredientId),
            eq(ingredients.householdId, householdId),
            isNull(ingredients.deletedAt),
          ),
        )
        .limit(1)
    : [];

  const nutritionSource: NutritionPer100 = {
    ...product,
    densityGramsPerMl: linkedIngredient?.densityGramsPerMl ?? null,
    unitConversions: linkedIngredient
      ? await getIngredientUnitConversions([linkedIngredient.id])
      : [],
    packageQuantity: product.packageQuantity,
    packageUnit: product.packageUnit,
  };

  try {
    return calculateNutritionForQuantity(nutritionSource, quantity, unit);
  } catch {
    return { ...EMPTY_NUTRITION };
  }
}

async function nutritionForProductSource(
  householdId: string,
  productId: string,
  servings: number,
): Promise<NutritionValues> {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.householdId, householdId)))
    .limit(1);
  if (!product) return { ...EMPTY_NUTRITION };

  const [linkedIngredient] = product.ingredientId
    ? await db
        .select({ id: ingredients.id, densityGramsPerMl: ingredients.densityGramsPerMl })
        .from(ingredients)
        .where(
          and(
            eq(ingredients.id, product.ingredientId),
            eq(ingredients.householdId, householdId),
            isNull(ingredients.deletedAt),
          ),
        )
        .limit(1)
    : [];

  const nutritionSource: NutritionPer100 = {
    ...product,
    densityGramsPerMl: linkedIngredient?.densityGramsPerMl ?? null,
    unitConversions: linkedIngredient
      ? await getIngredientUnitConversions([linkedIngredient.id])
      : [],
    packageQuantity: product.packageQuantity,
    packageUnit: product.packageUnit,
  };

  try {
    if (product.packageQuantity && product.packageUnit) {
      return calculateNutritionForQuantity(nutritionSource, servings, "opakowanie");
    }
    const basisUnit = product.nutritionBasis === "per100ml" ? "ml" : "g";
    return calculateNutritionForQuantity(nutritionSource, servings * 100, basisUnit);
  } catch {
    return { ...EMPTY_NUTRITION };
  }
}

async function nutritionForRecipeServings(
  householdId: string,
  recipeId: string,
  servings: number,
): Promise<NutritionValues> {
  const recipeData = await getRecipeWithIngredients(householdId, recipeId);
  if (!recipeData) return { ...EMPTY_NUTRITION };

  const ingredientNutrition = await Promise.all(
    recipeData.ingredients.map(async (ri) => {
      let nutritionSource: NutritionPer100 | null = null;

      if (ri.ingredientId) {
        const [ingredient] = await db
          .select()
          .from(ingredients)
          .where(
            and(
              eq(ingredients.id, ri.ingredientId),
              eq(ingredients.householdId, householdId),
              isNull(ingredients.deletedAt),
            ),
          )
          .limit(1);
        if (ingredient) {
          nutritionSource = {
            ...ingredient,
            unitConversions: await getIngredientUnitConversions([ingredient.id]),
          };
        }
      } else if (ri.productId) {
        const [product] = await db
          .select()
          .from(products)
          .where(and(eq(products.id, ri.productId), eq(products.householdId, householdId)))
          .limit(1);
        if (product) {
          const [linkedIngredient] = product.ingredientId
            ? await db
                .select({ id: ingredients.id, densityGramsPerMl: ingredients.densityGramsPerMl })
                .from(ingredients)
                .where(
                  and(
                    eq(ingredients.id, product.ingredientId),
                    eq(ingredients.householdId, householdId),
                    isNull(ingredients.deletedAt),
                  ),
                )
                .limit(1)
            : [];
          nutritionSource = {
            ...product,
            densityGramsPerMl: linkedIngredient?.densityGramsPerMl ?? null,
            unitConversions: linkedIngredient
              ? await getIngredientUnitConversions([linkedIngredient.id])
              : [],
            packageQuantity: product.packageQuantity,
            packageUnit: product.packageUnit,
          };
        }
      }

      if (!nutritionSource || ri.optional) {
        return { ...EMPTY_NUTRITION };
      }

      try {
        return calculateNutritionForQuantity(nutritionSource, ri.quantity, ri.unit);
      } catch {
        return { ...EMPTY_NUTRITION };
      }
    }),
  );

  const recipeTotal = sumNutrition(ingredientNutrition);
  return scaleNutrition(perServing(recipeTotal, recipeData.recipe.servings), servings);
}

export type PlanEntryNutritionSource = {
  recipeId: string | null;
  ingredientId: string | null;
  productId: string | null;
  servings: number;
  quantity?: number | string | null;
  unit?: string | null;
  date?: string;
};

function parseQuantity(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Full planned nutrition for an entry (scaled by entry.servings). */
export async function calculatePlannedNutritionForEntry(
  householdId: string,
  entry: PlanEntryNutritionSource,
): Promise<NutritionValues> {
  if (entry.recipeId) {
    return nutritionForRecipeServings(householdId, entry.recipeId, entry.servings);
  }
  if (entry.ingredientId) {
    const quantity = parseQuantity(entry.quantity) ?? entry.servings * 100;
    const [ingredient] = await db
      .select({ baseUnit: ingredients.baseUnit })
      .from(ingredients)
      .where(eq(ingredients.id, entry.ingredientId))
      .limit(1);
    return nutritionForIngredientSource(
      householdId,
      entry.ingredientId,
      quantity,
      entry.unit ?? ingredient?.baseUnit ?? "g",
    );
  }
  if (entry.productId) {
    const quantity = parseQuantity(entry.quantity);
    if (quantity != null) {
      const [product] = await db
        .select({
          nutritionBasis: products.nutritionBasis,
          packageQuantity: products.packageQuantity,
          packageUnit: products.packageUnit,
        })
        .from(products)
        .where(and(eq(products.id, entry.productId), eq(products.householdId, householdId)))
        .limit(1);
      if (!product) return { ...EMPTY_NUTRITION };
      const unit = entry.unit ?? product.packageUnit ?? (product.nutritionBasis === "per100ml" ? "ml" : "g");
      return nutritionForProductByQuantity(householdId, entry.productId, quantity, unit);
    }
    return nutritionForProductSource(householdId, entry.productId, entry.servings);
  }
  return { ...EMPTY_NUTRITION };
}

export async function sumPlannedNutritionByDate(
  householdId: string,
  entries: PlanEntryNutritionSource[],
): Promise<Record<string, NutritionValues>> {
  const byDate: Record<string, NutritionValues[]> = {};
  for (const entry of entries) {
    if (!entry.date) continue;
    const nutrition = await calculatePlannedNutritionForEntry(householdId, entry);
    byDate[entry.date] = [...(byDate[entry.date] ?? []), nutrition];
  }
  return Object.fromEntries(
    Object.entries(byDate).map(([date, values]) => [date, sumNutrition(values)]),
  );
}

/** Kcal per recipe serving for list/palette sorting. */
export async function getRecipesKcalPerServing(
  householdId: string,
  recipeIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  await Promise.all(
    recipeIds.map(async (recipeId) => {
      const nutrition = await nutritionForRecipeServings(householdId, recipeId, 1);
      result.set(recipeId, nutrition.kcal);
    }),
  );
  return result;
}

export {
  nutritionForIngredientSource,
  nutritionForProductSource,
  nutritionForRecipeServings,
};
