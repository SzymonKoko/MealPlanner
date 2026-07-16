import {
  sumNutrition,
  parseDecimal,
  type NutritionValues,
} from "@/lib/nutrition";
import { getMealPlanForDate, getAssignmentsForEntry } from "@/modules/meal-planner/repository/meal-plan-repository";
import { calculatePlannedNutritionForEntry } from "./planned-nutrition";

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

  for (const { entry, itemName } of dayMeals) {
    const assignments = await getAssignmentsForEntry(entry.id);
    const userAssignment = assignments.find((a) => a.userId === userId);
    if (!userAssignment) continue;
    if (!entry.recipeId && !entry.ingredientId && !entry.productId) continue;

    const userNutrition = await calculatePlannedNutritionForEntry(householdId, {
      recipeId: entry.recipeId,
      ingredientId: entry.ingredientId,
      productId: entry.productId,
      servings: userAssignment.servings,
    });

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
