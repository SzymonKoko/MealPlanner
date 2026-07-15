"use server";

import { revalidatePath } from "next/cache";
import { requireActiveHousehold } from "@/server/require-household-member";
import { ingredientSchema, productSchema, categorySchema } from "../validators/ingredient-schemas";
import {
  createIngredient,
  updateIngredient,
  softDeleteIngredient,
  createProduct,
  createCategory,
  listIngredients,
} from "../repository/ingredient-repository";
import { AppError } from "@/lib/errors";

export async function createIngredientAction(formData: FormData) {
  const { user, householdId } = await requireActiveHousehold();
  const parsed = ingredientSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    categoryId: formData.get("categoryId") || null,
    baseUnit: formData.get("baseUnit") || "g",
    kcalPer100: formData.get("kcalPer100") || undefined,
    proteinPer100: formData.get("proteinPer100") || undefined,
    carbsPer100: formData.get("carbsPer100") || undefined,
    fatPer100: formData.get("fatPer100") || undefined,
    fiberPer100: formData.get("fiberPer100") || undefined,
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  const { tagIds, ...data } = parsed.data;
  await createIngredient(householdId, user.id, data, tagIds);
  revalidatePath("/ingredients");
}

export async function updateIngredientAction(id: string, formData: FormData) {
  const { householdId } = await requireActiveHousehold();
  const parsed = ingredientSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    categoryId: formData.get("categoryId") || null,
    baseUnit: formData.get("baseUnit") || "g",
    kcalPer100: formData.get("kcalPer100") || undefined,
    proteinPer100: formData.get("proteinPer100") || undefined,
    carbsPer100: formData.get("carbsPer100") || undefined,
    fatPer100: formData.get("fatPer100") || undefined,
    fiberPer100: formData.get("fiberPer100") || undefined,
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  const { tagIds, ...data } = parsed.data;
  await updateIngredient(householdId, id, data, tagIds);
  revalidatePath("/ingredients");
}

export async function deleteIngredientAction(id: string) {
  const { householdId } = await requireActiveHousehold();
  await softDeleteIngredient(householdId, id);
  revalidatePath("/ingredients");
}

export async function createProductAction(formData: FormData) {
  const { householdId } = await requireActiveHousehold();
  const parsed = productSchema.safeParse({
    ingredientId: formData.get("ingredientId") || null,
    name: formData.get("name"),
    brand: formData.get("brand") || undefined,
    barcode: formData.get("barcode") || undefined,
    packageQuantity: formData.get("packageQuantity") || undefined,
    packageUnit: formData.get("packageUnit") || undefined,
    kcalPer100: formData.get("kcalPer100") || undefined,
    proteinPer100: formData.get("proteinPer100") || undefined,
    carbsPer100: formData.get("carbsPer100") || undefined,
    fatPer100: formData.get("fatPer100") || undefined,
    fiberPer100: formData.get("fiberPer100") || undefined,
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  await createProduct(householdId, parsed.data);
  revalidatePath("/ingredients");
}

export async function createCategoryAction(formData: FormData) {
  const { householdId } = await requireActiveHousehold();
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") || 0,
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  await createCategory(householdId, parsed.data.name, parsed.data.sortOrder);
  revalidatePath("/ingredients");
}

export async function deleteIngredientFormAction(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) throw new AppError("Brak ID", "VALIDATION_ERROR");
  await deleteIngredientAction(id);
}

export async function searchIngredientsAction(query: string) {
  const { householdId } = await requireActiveHousehold();
  return listIngredients(householdId, query);
}
