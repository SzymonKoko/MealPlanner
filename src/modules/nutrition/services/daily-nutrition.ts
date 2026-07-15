import {
  calculateNutritionForQuantity,
  perServing,
  scaleNutrition,
  sumNutrition,
  parseDecimal,
  type NutritionValues,
} from "@/lib/nutrition";
import { getMealPlanForDate } from "@/modules/meal-planner/repository/meal-plan-repository";
import { getRecipeWithIngredients } from "@/modules/recipes/repository/recipe-repository";
import { getAssignmentsForEntry } from "@/modules/meal-planner/repository/meal-plan-repository";
import { db } from "@/db/client";
import { ingredients, products } from "@/db/schema";
import { eq } from "drizzle-orm";

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

export async function calculateDailyNutritionForUser(
  householdId: string,
  userId: string,
  date: string,
): Promise<DailyNutritionResult> {
  const dayMeals = await getMealPlanForDate(householdId, date);
  const meals: DailyNutritionResult["meals"] = [];

  for (const { entry, recipeName } of dayMeals) {
    const assignments = await getAssignmentsForEntry(entry.id);
    const userAssignment = assignments.find((a) => a.userId === userId);
    if (!userAssignment) continue;

    const recipeData = await getRecipeWithIngredients(householdId, entry.recipeId);
    if (!recipeData) continue;

    const ingredientNutrition = await Promise.all(
      recipeData.ingredients.map(async (ri) => {
        let nutritionSource: {
          kcalPer100?: string | null;
          proteinPer100?: string | null;
          carbsPer100?: string | null;
          fatPer100?: string | null;
          fiberPer100?: string | null;
          baseUnit: string;
        } | null = null;

        if (ri.ingredientId) {
          const [ingredient] = await db
            .select()
            .from(ingredients)
            .where(eq(ingredients.id, ri.ingredientId))
            .limit(1);
          if (ingredient) {
            nutritionSource = { ...ingredient, baseUnit: ingredient.baseUnit };
          }
        } else if (ri.productId) {
          const [product] = await db
            .select()
            .from(products)
            .where(eq(products.id, ri.productId))
            .limit(1);
          if (product) {
            nutritionSource = { ...product, baseUnit: product.packageUnit ?? "g" };
          }
        }

        if (!nutritionSource || ri.optional) {
          return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
        }

        const total = calculateNutritionForQuantity(
          nutritionSource,
          Number.parseFloat(ri.quantity),
          ri.unit,
          nutritionSource.baseUnit,
        );
        return total;
      }),
    );

    const recipeTotal = sumNutrition(ingredientNutrition);
    const perRecipeServing = perServing(recipeTotal, recipeData.recipe.servings);
    const userNutrition = scaleNutrition(perRecipeServing, userAssignment.servings);

    meals.push({
      entryId: entry.id,
      recipeName,
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
