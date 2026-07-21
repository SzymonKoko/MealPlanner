"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { ingredients, mealPlanAssignments, mealPlanEntries, products, recipeIngredients, recipes } from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { requireActiveHouseholdEditor } from "@/server/require-household-member";
import { createComposition, getComposition, updateComposition } from "../repository/recipe-repository";
import { composeMealSchema, compositionSchema } from "../validators/composition-schemas";

function parseJson(value: FormDataEntryValue | null) {
  try {
    return JSON.parse(String(value ?? "[]"));
  } catch {
    throw new AppError("Nieprawidłowa struktura kompozycji", "VALIDATION_ERROR");
  }
}

function parseComposition(formData: FormData) {
  const parsed = compositionSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    sections: parseJson(formData.get("sections")),
  });
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }
  return parsed.data;
}

async function validateSources(householdId: string, data: ReturnType<typeof parseComposition>) {
  const ingredientIds = [...new Set(data.sections.flatMap((section) => section.options.map((option) => option.ingredientId).filter(Boolean)))] as string[];
  const productIds = [...new Set(data.sections.flatMap((section) => section.options.map((option) => option.productId).filter(Boolean)))] as string[];
  const [ingredientRows, productRows] = await Promise.all([
    ingredientIds.length ? db.select({ id: ingredients.id }).from(ingredients).where(and(
      eq(ingredients.householdId, householdId), isNull(ingredients.deletedAt), inArray(ingredients.id, ingredientIds),
    )) : [],
    productIds.length ? db.select({ id: products.id }).from(products).where(and(
      eq(products.householdId, householdId), inArray(products.id, productIds),
    )) : [],
  ]);
  if (ingredientRows.length !== ingredientIds.length || productRows.length !== productIds.length) {
    throw new AppError("Co najmniej jeden wariant nie należy do gospodarstwa", "VALIDATION_ERROR");
  }
}

export async function createCompositionAction(formData: FormData) {
  const { user, householdId } = await requireActiveHouseholdEditor();
  const data = parseComposition(formData);
  await validateSources(householdId, data);
  const composition = await createComposition(householdId, user.id, data);
  revalidatePath("/recipes");
  return composition;
}

export async function updateCompositionAction(id: string, formData: FormData) {
  const { householdId } = await requireActiveHouseholdEditor();
  const data = parseComposition(formData);
  await validateSources(householdId, data);
  const composition = await updateComposition(householdId, id, data);
  if (!composition) throw new AppError("Kompozycja nie istnieje", "NOT_FOUND", 404);
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  return composition;
}

export async function addCompositionToPlanAction(input: {
  compositionId: string;
  optionIds: string[];
  date: string;
  mealType: string;
  planScope: "mine" | "household";
}) {
  const { user, householdId } = await requireActiveHouseholdEditor();
  const parsed = composeMealSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowy wybór", "VALIDATION_ERROR");
  }
  const composition = await getComposition(householdId, parsed.data.compositionId);
  if (!composition) throw new AppError("Kompozycja nie istnieje", "NOT_FOUND", 404);

  const selected = composition.sections.flatMap((section) => {
    const matches = section.options.filter((option) => parsed.data.optionIds.includes(option.id));
    if (matches.length < 1) {
      throw new AppError(`Wybierz co najmniej jeden wariant w sekcji „${section.name}”`, "VALIDATION_ERROR");
    }
    return matches;
  });
  if (new Set(selected.map((option) => option.id)).size !== parsed.data.optionIds.length) {
    throw new AppError("Nieprawidłowy wariant kompozycji", "VALIDATION_ERROR");
  }

  await db.transaction(async (tx) => {
    const variantNames = selected.map((option) => option.source?.name).filter(Boolean);
    const [snapshot] = await tx.insert(recipes).values({
      householdId,
      createdBy: user.id,
      kind: "composition_instance",
      name: `${composition.recipe.name}: ${variantNames.join(", ")}`,
      description: `Kompozycja utworzona z „${composition.recipe.name}”`,
      servings: 1,
    }).returning();
    await tx.insert(recipeIngredients).values(selected.map((option, index) => ({
      recipeId: snapshot.id,
      ingredientId: option.ingredientId,
      productId: option.productId,
      quantity: option.quantity,
      unit: option.unit,
      optional: false,
      sortOrder: index,
    })));
    const [entry] = await tx.insert(mealPlanEntries).values({
      householdId,
      createdBy: user.id,
      recipeId: snapshot.id,
      date: parsed.data.date,
      mealType: parsed.data.mealType,
      servings: 1,
    }).returning();
    if (parsed.data.planScope === "mine") {
      await tx.insert(mealPlanAssignments).values({
        mealPlanEntryId: entry.id,
        userId: user.id,
        share: "1",
      });
    }
  });
  revalidatePath("/plan");
  revalidatePath("/today");
}
