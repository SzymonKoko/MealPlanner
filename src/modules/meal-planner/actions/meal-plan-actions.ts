"use server";

import { revalidatePath } from "next/cache";
import {
  requireActiveHousehold,
  requireActiveHouseholdEditor,
} from "@/server/require-household-member";
import {
  mealPlanEntrySchema,
  moveMealPlanEntrySchema,
  splitMealPlanEntrySchema,
  copyWeekSchema,
  mealPlanDetailsSchema,
} from "../validators/meal-plan-schemas";
import {
  createMealPlanEntry,
  updateMealPlanEntry,
  deleteMealPlanEntry,
  copyMealPlanEntry,
  copyPreviousWeek,
  replaceEntryShares,
  getMealPlanForWeek,
} from "../repository/meal-plan-repository";
import { AppError } from "@/lib/errors";
import { db } from "@/db/client";
import { householdMembers, mealPlanEntries, recipes, ingredients, products } from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { equalShares, percentageAllocationsToShares } from "../services/portion-allocation";

export async function addMealPlanEntryAction(formData: FormData) {
  const { user, householdId } = await requireActiveHouseholdEditor();
  const parsed = mealPlanEntrySchema.safeParse({
    recipeId: formData.get("recipeId"),
    ingredientId: formData.get("ingredientId"),
    productId: formData.get("productId"),
    date: formData.get("date"),
    mealType: formData.get("mealType"),
    servings: formData.get("servings") || 1,
    quantity: formData.get("quantity") || undefined,
    unit: formData.get("unit") || undefined,
    notes: formData.get("notes") || undefined,
    planScope: formData.get("planScope") || "mine",
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  if (parsed.data.recipeId) {
    const [recipe] = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(
        and(
          eq(recipes.id, parsed.data.recipeId),
          eq(recipes.householdId, householdId),
          isNull(recipes.deletedAt),
        ),
      )
      .limit(1);
    if (!recipe) throw new AppError("Przepis nie należy do gospodarstwa", "VALIDATION_ERROR");
  }

  if (parsed.data.ingredientId) {
    const [ingredient] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(
        and(
          eq(ingredients.id, parsed.data.ingredientId),
          eq(ingredients.householdId, householdId),
          isNull(ingredients.deletedAt),
        ),
      )
      .limit(1);
    if (!ingredient) throw new AppError("Składnik nie należy do gospodarstwa", "VALIDATION_ERROR");
  }

  if (parsed.data.productId) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, parsed.data.productId), eq(products.householdId, householdId)))
      .limit(1);
    if (!product) throw new AppError("Produkt nie należy do gospodarstwa", "VALIDATION_ERROR");
  }

  await createMealPlanEntry(householdId, user.id, {
    ...parsed.data,
    quantity: parsed.data.quantity,
    unit: parsed.data.unit ?? (parsed.data.ingredientId || parsed.data.productId ? "g" : undefined),
  });
  revalidatePath("/plan");
  revalidatePath("/today");
}

export async function moveMealPlanEntryAction(formData: FormData) {
  const { householdId } = await requireActiveHouseholdEditor();
  const parsed = moveMealPlanEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    date: formData.get("date"),
    mealType: formData.get("mealType"),
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  const entry = await updateMealPlanEntry(householdId, parsed.data.entryId, {
    date: parsed.data.date,
    mealType: parsed.data.mealType,
  });
  if (!entry) throw new AppError("Wpis planera nie istnieje", "NOT_FOUND", 404);
  revalidatePath("/plan");
}

export async function updateMealPlanServingsAction(entryId: string, servings: number) {
  const { householdId } = await requireActiveHouseholdEditor();
  await updateMealPlanEntry(householdId, entryId, { servings });
  revalidatePath("/plan");
}

export async function updateMealPlanDetailsAction(formData: FormData) {
  const { householdId } = await requireActiveHouseholdEditor();
  const parsed = mealPlanDetailsSchema.safeParse({
    entryId: formData.get("entryId"),
    servings: formData.get("servings") || undefined,
    quantity: formData.get("quantity") || undefined,
    unit: formData.get("unit") || undefined,
    notes: formData.get("notes") || undefined,
    isBatchCooking: formData.get("isBatchCooking") === "true",
  });
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }
  const [existingEntry] = await db
    .select({
      id: mealPlanEntries.id,
      recipeId: mealPlanEntries.recipeId,
      ingredientId: mealPlanEntries.ingredientId,
      productId: mealPlanEntries.productId,
    })
    .from(mealPlanEntries)
    .where(
      and(
        eq(mealPlanEntries.id, parsed.data.entryId),
        eq(mealPlanEntries.householdId, householdId),
      ),
    )
    .limit(1);
  if (!existingEntry) throw new AppError("Wpis planera nie istnieje", "NOT_FOUND", 404);

  const isRecipe = Boolean(existingEntry.recipeId);
  if (isRecipe) {
    if (!parsed.data.servings) {
      throw new AppError("Podaj liczbę porcji", "VALIDATION_ERROR");
    }
    const entry = await updateMealPlanEntry(householdId, parsed.data.entryId, {
      servings: parsed.data.servings,
      notes: parsed.data.notes,
      isBatchCooking: parsed.data.isBatchCooking,
    });
    if (!entry) throw new AppError("Wpis planera nie istnieje", "NOT_FOUND", 404);
  } else {
    if (!parsed.data.quantity) {
      throw new AppError("Podaj gramaturę", "VALIDATION_ERROR");
    }
    const entry = await updateMealPlanEntry(householdId, parsed.data.entryId, {
      quantity: parsed.data.quantity,
      unit: parsed.data.unit ?? "g",
      notes: parsed.data.notes,
      isBatchCooking: parsed.data.isBatchCooking,
    });
    if (!entry) throw new AppError("Wpis planera nie istnieje", "NOT_FOUND", 404);
  }
  revalidatePath("/plan");
  revalidatePath("/today");
}

export async function deleteMealPlanEntryAction(entryId: string) {
  const { householdId } = await requireActiveHouseholdEditor();
  await deleteMealPlanEntry(householdId, entryId);
  revalidatePath("/plan");
  revalidatePath("/today");
}

export async function copyMealPlanEntryAction(entryId: string) {
  const { user, householdId } = await requireActiveHouseholdEditor();
  await copyMealPlanEntry(householdId, user.id, entryId);
  revalidatePath("/plan");
}

export async function copyMealPlanEntryToAction(formData: FormData) {
  const { user, householdId } = await requireActiveHouseholdEditor();
  const parsed = moveMealPlanEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    date: formData.get("date"),
    mealType: formData.get("mealType"),
  });
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }
  const copy = await copyMealPlanEntry(
    householdId,
    user.id,
    parsed.data.entryId,
    parsed.data.date,
    parsed.data.mealType,
  );
  if (!copy) throw new AppError("Wpis planera nie istnieje", "NOT_FOUND", 404);
  revalidatePath("/plan");
}

export async function copyPreviousWeekAction(formData: FormData) {
  const { user, householdId } = await requireActiveHouseholdEditor();
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

export async function splitMealPlanEntryAction(input:
  | { entryId: string; mode: "equal"; userIds: string[] }
  | { entryId: string; mode: "percentage"; allocations: Array<{ userId: string; percentage: number }> }
  | { entryId: string; mode: "clear" }
) {
  const { householdId } = await requireActiveHouseholdEditor();
  const parsed = splitMealPlanEntrySchema.safeParse(input);

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  const [entry] = await db
    .select()
    .from(mealPlanEntries)
    .where(
      and(
        eq(mealPlanEntries.id, parsed.data.entryId),
        eq(mealPlanEntries.householdId, householdId),
      ),
    )
    .limit(1);

  if (!entry) throw new AppError("Wpis planera nie istnieje", "NOT_FOUND", 404);

  const shares = parsed.data.mode === "clear"
    ? []
    : parsed.data.mode === "equal"
      ? equalShares(parsed.data.userIds)
      : percentageAllocationsToShares(parsed.data.allocations);

  if (shares.length) {
    const memberships = await db.select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(and(
        eq(householdMembers.householdId, householdId),
        inArray(householdMembers.userId, shares.map(({ userId }) => userId)),
      ));
    if (memberships.length !== shares.length) {
      throw new AppError("Użytkownik nie należy do gospodarstwa", "VALIDATION_ERROR");
    }
  }

  await replaceEntryShares(householdId, parsed.data.entryId, shares);
  revalidatePath("/plan");
  revalidatePath("/today");
}

export async function getWeekPlanAction(weekStart: string) {
  const { householdId } = await requireActiveHousehold();
  return getMealPlanForWeek(householdId, weekStart);
}
