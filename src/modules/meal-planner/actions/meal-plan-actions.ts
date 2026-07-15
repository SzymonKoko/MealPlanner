"use server";

import { revalidatePath } from "next/cache";
import { requireActiveHousehold } from "@/server/require-household-member";
import {
  mealPlanEntrySchema,
  moveMealPlanEntrySchema,
  assignmentSchema,
  copyWeekSchema,
} from "../validators/meal-plan-schemas";
import {
  createMealPlanEntry,
  updateMealPlanEntry,
  deleteMealPlanEntry,
  copyMealPlanEntry,
  copyPreviousWeek,
  setAssignment,
  getAssignmentsForEntry,
  getMealPlanForWeek,
} from "../repository/meal-plan-repository";
import { AppError } from "@/lib/errors";
import { db } from "@/db/client";
import { mealPlanEntries } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function addMealPlanEntryAction(formData: FormData) {
  const { user, householdId } = await requireActiveHousehold();
  const parsed = mealPlanEntrySchema.safeParse({
    recipeId: formData.get("recipeId"),
    date: formData.get("date"),
    mealType: formData.get("mealType"),
    servings: formData.get("servings") || 1,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  await createMealPlanEntry(householdId, user.id, parsed.data);
  revalidatePath("/plan");
  revalidatePath("/today");
}

export async function moveMealPlanEntryAction(formData: FormData) {
  const { householdId } = await requireActiveHousehold();
  const parsed = moveMealPlanEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    date: formData.get("date"),
    mealType: formData.get("mealType"),
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  await updateMealPlanEntry(householdId, parsed.data.entryId, {
    date: parsed.data.date,
    mealType: parsed.data.mealType,
  });
  revalidatePath("/plan");
}

export async function updateMealPlanServingsAction(entryId: string, servings: number) {
  const { householdId } = await requireActiveHousehold();
  await updateMealPlanEntry(householdId, entryId, { servings });
  revalidatePath("/plan");
}

export async function deleteMealPlanEntryAction(entryId: string) {
  const { householdId } = await requireActiveHousehold();
  await deleteMealPlanEntry(householdId, entryId);
  revalidatePath("/plan");
  revalidatePath("/today");
}

export async function copyMealPlanEntryAction(entryId: string) {
  const { user, householdId } = await requireActiveHousehold();
  await copyMealPlanEntry(householdId, user.id, entryId);
  revalidatePath("/plan");
}

export async function copyPreviousWeekAction(formData: FormData) {
  const { user, householdId } = await requireActiveHousehold();
  const parsed = copyWeekSchema.safeParse({
    sourceWeekStart: formData.get("sourceWeekStart"),
    targetWeekStart: formData.get("targetWeekStart"),
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  await copyPreviousWeek(
    householdId,
    user.id,
    parsed.data.sourceWeekStart,
    parsed.data.targetWeekStart,
  );
  revalidatePath("/plan");
}

export async function assignPortionsAction(formData: FormData) {
  const { householdId } = await requireActiveHousehold();
  const parsed = assignmentSchema.safeParse({
    mealPlanEntryId: formData.get("mealPlanEntryId"),
    userId: formData.get("userId"),
    servings: formData.get("servings"),
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  const [entry] = await db
    .select()
    .from(mealPlanEntries)
    .where(
      and(
        eq(mealPlanEntries.id, parsed.data.mealPlanEntryId),
        eq(mealPlanEntries.householdId, householdId),
      ),
    )
    .limit(1);

  if (!entry) throw new AppError("Wpis planera nie istnieje", "NOT_FOUND", 404);

  const assignments = await getAssignmentsForEntry(parsed.data.mealPlanEntryId);
  const otherTotal = assignments
    .filter((a) => a.userId !== parsed.data.userId)
    .reduce((sum, a) => sum + a.servings, 0);

  if (otherTotal + parsed.data.servings > entry.servings) {
    throw new AppError("Suma porcji przekracza liczbę porcji posiłku", "VALIDATION_ERROR");
  }

  await setAssignment(parsed.data.mealPlanEntryId, parsed.data.userId, parsed.data.servings);
  revalidatePath("/plan");
  revalidatePath("/today");
}

export async function getWeekPlanAction(weekStart: string) {
  const { householdId } = await requireActiveHousehold();
  return getMealPlanForWeek(householdId, weekStart);
}
