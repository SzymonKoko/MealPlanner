import { mealTypeEnum, type MealType } from "@/db/schema/meal-planner";

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Śniadanie",
  secondBreakfast: "II śniadanie",
  lunch: "Obiad",
  dinner: "Kolacja",
  snack: "Przekąska",
};

export { mealTypeEnum };
