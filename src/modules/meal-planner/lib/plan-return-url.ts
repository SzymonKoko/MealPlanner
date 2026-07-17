import type { MealType } from "@/db/schema/meal-planner";

export function buildPlanPickerReturnUrl(weekStart: string, date: string, mealType: MealType) {
  const params = new URLSearchParams({
    week: weekStart,
    view: "day",
    day: date,
    pick: mealType,
  });
  return `/plan?${params.toString()}`;
}
