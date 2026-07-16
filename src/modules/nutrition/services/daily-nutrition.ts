import {
  calculateNutritionForQuantity,
  perServing,
  scaleNutrition,
  sumNutrition,
  parseDecimal,
  EMPTY_NUTRITION,
  type NutritionPer100,
  type NutritionValues,
} from "@/lib/nutrition";
import { getMealPlanForDate } from "@/modules/meal-planner/repository/meal-plan-repository";
import { getRecipeWithIngredients } from "@/modules/recipes/repository/recipe-repository";
import { getAssignmentsForEntry } from "@/modules/meal-planner/repository/meal-plan-repository";
import { getIngredientUnitConversions } from "@/modules/ingredients/repository/ingredient-repository";
import { db } from "@/db/client";
import { ingredients, products } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export interface DailyNutritionResult {
  consumed: NutritionValues;
  meals: {
    entryId: string;
    recipeName: string;
    mealType: string;
    servings: number;
    nutrition: NutritionValues;
  }[];
}

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

export async function calculateDailyNutritionForUser(
  householdId: string,
  userId: string,
  date: string,
): Promise<DailyNutritionResult> {
  const dayMeals = await getMealPlanForDate(householdId, date);
  const meals: DailyNutritionResult["meals"] = [];

  for (const { entry, itemName } of dayMeals) {
    const assignments = await getAssignmentsForEntry(entry.id);
    const userAssignment = assignments.find((a) => a.userId === userId);
    if (!userAssignment) continue;

    let userNutrition: NutritionValues = { ...EMPTY_NUTRITION };

    if (entry.recipeId) {
      const recipeData = await getRecipeWithIngredients(householdId, entry.recipeId);
      if (!recipeData) continue;

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
              .where(
                and(
                  eq(products.id, ri.productId),
                  eq(products.householdId, householdId),
                ),
              )
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

          return calculateNutritionForQuantity(nutritionSource, ri.quantity, ri.unit);
        }),
      );

      const recipeTotal = sumNutrition(ingredientNutrition);
      const perRecipeServing = perServing(recipeTotal, recipeData.recipe.servings);
      userNutrition = scaleNutrition(perRecipeServing, userAssignment.servings);
    } else if (entry.ingredientId) {
      const [ingredient] = await db
        .select({ baseUnit: ingredients.baseUnit })
        .from(ingredients)
        .where(eq(ingredients.id, entry.ingredientId))
        .limit(1);
      const portionTotal = await nutritionForIngredientSource(
        householdId,
        entry.ingredientId,
        100,
        ingredient?.baseUnit ?? "g",
      );
      userNutrition = scaleNutrition(portionTotal, userAssignment.servings);
    } else if (entry.productId) {
      const productTotal = await nutritionForProductSource(
        householdId,
        entry.productId,
        entry.servings,
      );
      const perEntryServing = perServing(productTotal, entry.servings);
      userNutrition = scaleNutrition(perEntryServing, userAssignment.servings);
    } else {
      continue;
    }

    meals.push({
      entryId: entry.id,
      recipeName: itemName,
      mealType: entry.mealType,
      servings: userAssignment.servings,
      nutrition: userNutrition,
    });
  }

  return {
    consumed: sumNutrition(meals.map((m) => m.nutrition)),
    meals,
  };
}

export function calculateGoalProgress(
  consumed: NutritionValues,
  goals: {
    kcalTarget?: string | null;
    proteinTarget?: string | null;
    carbsTarget?: string | null;
    fatTarget?: string | null;
    fiberTarget?: string | null;
  } | null,
) {
  return {
    kcal: { consumed: consumed.kcal, target: parseDecimal(goals?.kcalTarget) },
    protein: { consumed: consumed.protein, target: parseDecimal(goals?.proteinTarget) },
    carbs: { consumed: consumed.carbs, target: parseDecimal(goals?.carbsTarget) },
    fat: { consumed: consumed.fat, target: parseDecimal(goals?.fatTarget) },
    fiber: { consumed: consumed.fiber, target: parseDecimal(goals?.fiberTarget) },
  };
}
