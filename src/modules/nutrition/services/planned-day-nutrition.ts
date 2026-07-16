import { getMealPlanForDate } from "@/modules/meal-planner/repository/meal-plan-repository";
import { calculatePlannedNutritionForEntry } from "./planned-nutrition";
import { sumNutrition, EMPTY_NUTRITION, type NutritionValues } from "@/lib/nutrition";

export async function calculatePlannedDayNutrition(
  householdId: string,
  date: string,
): Promise<{
  planned: NutritionValues;
  meals: {
    entryId: string;
    itemName: string;
    mealType: string;
    servings: number;
    nutrition: NutritionValues;
  }[];
}> {
  const dayMeals = await getMealPlanForDate(householdId, date);
  const meals: {
    entryId: string;
    itemName: string;
    mealType: string;
    servings: number;
    nutrition: NutritionValues;
  }[] = [];

  for (const { entry, itemName } of dayMeals) {
    if (!entry.recipeId && !entry.ingredientId && !entry.productId) continue;
    const nutrition = await calculatePlannedNutritionForEntry(householdId, {
      recipeId: entry.recipeId,
      ingredientId: entry.ingredientId,
      productId: entry.productId,
      servings: entry.servings,
    });
    meals.push({
      entryId: entry.id,
      itemName,
      mealType: entry.mealType,
      servings: entry.servings,
      nutrition,
    });
  }

  return {
    planned: meals.length ? sumNutrition(meals.map((meal) => meal.nutrition)) : { ...EMPTY_NUTRITION },
    meals,
  };
}
