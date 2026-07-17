import {
  sumNutrition,
  parseDecimal,
  type NutritionValues,
} from "@/lib/nutrition";
import { getMealPlanForDate, getAssignmentsForEntry } from "@/modules/meal-planner/repository/meal-plan-repository";
import { calculatePlannedNutritionForEntry } from "./planned-nutrition";
import { formatPlanEntryAmount } from "@/modules/meal-planner/lib/format-entry-amount";
import { calculatePersonalEntryNutrition } from "./personal-nutrition";

export interface DailyNutritionResult {
  consumed: NutritionValues;
  meals: {
    entryId: string;
    itemName: string;
    mealType: string;
    servings: number;
    amountLabel: string;
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

    const fullNutrition = await calculatePlannedNutritionForEntry(householdId, {
      recipeId: entry.recipeId,
      ingredientId: entry.ingredientId,
      productId: entry.productId,
      servings: entry.servings,
      quantity: entry.quantity,
      unit: entry.unit,
    });
    const personal = calculatePersonalEntryNutrition({
      nutrition: fullNutrition,
      servings: entry.servings,
      quantity: entry.quantity == null ? null : Number.parseFloat(String(entry.quantity)),
      share: Number.parseFloat(userAssignment.share),
    });

    meals.push({
      entryId: entry.id,
      itemName,
      mealType: entry.mealType,
      servings: personal.servings,
      amountLabel: formatPlanEntryAmount({
        recipeId: entry.recipeId,
        servings: personal.servings,
        quantity: personal.quantity,
        unit: entry.unit,
      }),
      nutrition: personal.nutrition,
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
