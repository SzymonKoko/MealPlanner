import type { MealType } from "@/db/schema/meal-planner";

export function buildPlanPickerReturnUrl(
  weekStart: string,
  date: string,
  mealType: MealType,
  scope: "mine" | "household" = "mine",
) {
  const params = new URLSearchParams({
    week: weekStart,
    view: "day",
    day: date,
    pick: mealType,
    scope,
  });
  return `/plan?${params.toString()}`;
}
