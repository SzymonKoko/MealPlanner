"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/server/require-auth";
import { requireActiveHousehold } from "@/server/require-household-member";
import { nutritionGoalsSchema } from "../validators/nutrition-schemas";
import { upsertNutritionGoals, getNutritionGoals } from "../repository/nutrition-repository";
import { calculateGoalProgress } from "../services/daily-nutrition";
import { calculatePlannedDayNutrition } from "../services/planned-day-nutrition";
import { AppError } from "@/lib/errors";
import { formatDateISO } from "@/lib/dates";

export async function saveNutritionGoalsAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = nutritionGoalsSchema.safeParse({
    kcalTarget: formData.get("kcalTarget") || undefined,
    proteinTarget: formData.get("proteinTarget") || undefined,
    carbsTarget: formData.get("carbsTarget") || undefined,
    fatTarget: formData.get("fatTarget") || undefined,
    fiberTarget: formData.get("fiberTarget") || undefined,
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  await upsertNutritionGoals(user.id, parsed.data);
  revalidatePath("/today");
  revalidatePath("/more");
}

export async function getTodayNutritionAction(date?: string) {
  const user = await requireAuth();
  const { householdId } = await requireActiveHousehold();
  const targetDate = date ?? formatDateISO(new Date());

  const [plannedDay, goals] = await Promise.all([
    calculatePlannedDayNutrition(householdId, targetDate),
    getNutritionGoals(user.id),
  ]);

  return {
    planned: plannedDay.planned,
    meals: plannedDay.meals,
    progress: calculateGoalProgress(plannedDay.planned, goals),
    goals,
  };
}
