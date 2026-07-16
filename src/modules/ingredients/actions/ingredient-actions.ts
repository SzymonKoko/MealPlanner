"use server";

import { revalidatePath } from "next/cache";
import {
  requireActiveHousehold,
  requireActiveHouseholdEditor,
} from "@/server/require-household-member";
import {
  ingredientCreateSchema,
  ingredientUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
  categorySchema,
  tagSchema,
} from "../validators/ingredient-schemas";
import {
  createIngredient,
  updateIngredient,
  softDeleteIngredient,
  createProduct,
  createCategory,
  listIngredients,
  getIngredient,
  updateProduct,
  deleteProduct,
  deleteCategory,
  createTag,
  deleteTag,
  updateCategory,
  updateTag,
  getProduct,
} from "../repository/ingredient-repository";
import { AppError } from "@/lib/errors";
import { db } from "@/db/client";
import { categories, tags } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { markManualNutritionUpdate } from "../services/nutrition-source";

async function validateIngredientReferences(
  householdId: string,
  categoryId?: string | null,
  tagIds?: string[],
  tagType: "ingredient" | "product" = "ingredient",
) {
  if (categoryId) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.householdId, householdId)))
      .limit(1);
    if (!category) {
      throw new AppError("Kategoria nie należy do gospodarstwa", "VALIDATION_ERROR");
    }
  }

  if (tagIds?.length) {
    const householdTags = await db
      .select({ id: tags.id })
      .from(tags)
      .where(
        and(
          eq(tags.householdId, householdId),
          eq(tags.type, tagType),
          inArray(tags.id, tagIds),
        ),
      );
    if (householdTags.length !== new Set(tagIds).size) {
      throw new AppError("Co najmniej jeden tag nie należy do gospodarstwa", "VALIDATION_ERROR");
    }
  }
}

export async function createIngredientAction(formData: FormData) {
  const { user, householdId } = await requireActiveHouseholdEditor();
  const parsed = ingredientCreateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    categoryId: formData.get("categoryId") || null,
    baseUnit: formData.get("baseUnit") || "g",
    kcalPer100: formData.get("kcalPer100") || undefined,
    proteinPer100: formData.get("proteinPer100") || undefined,
    carbsPer100: formData.get("carbsPer100") || undefined,
    fatPer100: formData.get("fatPer100") || undefined,
    fiberPer100: formData.get("fiberPer100") || undefined,
    saltPer100: formData.get("saltPer100") || undefined,
    nutritionBasis: formData.get("nutritionBasis") || "per100g",
    densityGramsPerMl: formData.get("densityGramsPerMl") || undefined,
    allergens: formData.get("allergens") || undefined,
    verifiedByUser: formData.get("verifiedByUser") === "true",
    tagIds: formData.getAll("tagIds"),
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  const { tagIds, ...data } = parsed.data;
  await validateIngredientReferences(householdId, data.categoryId, tagIds);
  await createIngredient(
    householdId,
    user.id,
    // Manual creation should be protected from future external sync.
    { ...data, dataSource: "manual", manuallyModified: true },
    tagIds,
  );
  revalidatePath("/ingredients");
}

export async function updateIngredientAction(id: string, formData: FormData) {
  const { householdId } = await requireActiveHouseholdEditor();
  const parsed = ingredientUpdateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    categoryId: formData.get("categoryId") || null,
    baseUnit: formData.get("baseUnit") || "g",
    kcalPer100: formData.get("kcalPer100") || undefined,
    proteinPer100: formData.get("proteinPer100") || undefined,
    carbsPer100: formData.get("carbsPer100") || undefined,
    fatPer100: formData.get("fatPer100") || undefined,
    fiberPer100: formData.get("fiberPer100") || undefined,
    saltPer100: formData.get("saltPer100") || undefined,
    nutritionBasis: formData.get("nutritionBasis") || "per100g",
    densityGramsPerMl: formData.get("densityGramsPerMl") || undefined,
    allergens: formData.get("allergens") || undefined,
    verifiedByUser: formData.get("verifiedByUser") === "true",
    tagIds: formData.getAll("tagIds"),
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  const { tagIds, ...data } = parsed.data;
  await validateIngredientReferences(householdId, data.categoryId, tagIds);
  const current = await getIngredient(householdId, id);
  if (!current) {
    throw new AppError("Składnik nie istnieje", "NOT_FOUND", 404);
  }
  const sourceUpdate = markManualNutritionUpdate(current, data);
  const ingredient = await updateIngredient(
    householdId,
    id,
    { ...data, ...sourceUpdate },
    tagIds,
  );
  if (!ingredient) {
    throw new AppError("Składnik nie istnieje", "NOT_FOUND", 404);
  }
  revalidatePath("/ingredients");
}

export async function deleteIngredientAction(id: string) {
  const { householdId } = await requireActiveHouseholdEditor();
  if (!(await softDeleteIngredient(householdId, id))) {
    throw new AppError("Składnik nie istnieje", "NOT_FOUND", 404);
  }
  revalidatePath("/ingredients");
}

export async function createProductAction(formData: FormData) {
  const { householdId } = await requireActiveHouseholdEditor();
  const parsed = productCreateSchema.safeParse({
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
    saltPer100: formData.get("saltPer100") || undefined,
    nutritionBasis: formData.get("nutritionBasis") || "per100g",
    verifiedByUser: formData.get("verifiedByUser") === "true",
    tagIds: formData.getAll("tagIds"),
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  if (parsed.data.ingredientId) {
    const ingredient = await getIngredient(householdId, parsed.data.ingredientId);
    if (!ingredient) {
      throw new AppError("Składnik nie należy do gospodarstwa", "VALIDATION_ERROR");
    }
  }

  const { tagIds, ...data } = parsed.data;
  await validateIngredientReferences(householdId, null, tagIds, "product");
  await createProduct(
    householdId,
    // Manual creation should be protected from future external sync.
    { ...data, dataSource: "manual", manuallyModified: true },
    tagIds,
  );
  revalidatePath("/ingredients");
}

export async function updateProductAction(id: string, formData: FormData) {
  const { householdId } = await requireActiveHouseholdEditor();
  const parsed = productUpdateSchema.safeParse({
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
    saltPer100: formData.get("saltPer100") || undefined,
    nutritionBasis: formData.get("nutritionBasis") || "per100g",
    verifiedByUser: formData.get("verifiedByUser") === "true",
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }
  if (parsed.data.ingredientId && !(await getIngredient(householdId, parsed.data.ingredientId))) {
    throw new AppError("Składnik nie należy do gospodarstwa", "VALIDATION_ERROR");
  }
  const { tagIds, ...data } = parsed.data;
  await validateIngredientReferences(householdId, null, tagIds, "product");
  const current = await getProduct(householdId, id);
  if (!current) {
    throw new AppError("Produkt nie istnieje", "NOT_FOUND", 404);
  }
  const sourceUpdate = markManualNutritionUpdate(current, data);
  if (!(await updateProduct(householdId, id, { ...data, ...sourceUpdate }, tagIds))) {
    throw new AppError("Produkt nie istnieje", "NOT_FOUND", 404);
  }
  revalidatePath("/ingredients");
}

export async function deleteProductAction(id: string) {
  const { householdId } = await requireActiveHouseholdEditor();
  if (!(await deleteProduct(householdId, id))) {
    throw new AppError("Produkt nie istnieje", "NOT_FOUND", 404);
  }
  revalidatePath("/ingredients");
}

export async function createCategoryAction(formData: FormData) {
  const { householdId } = await requireActiveHouseholdEditor();
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

export async function deleteCategoryAction(id: string) {
  const { householdId } = await requireActiveHouseholdEditor();
  if (!(await deleteCategory(householdId, id))) {
    throw new AppError("Kategoria nie istnieje", "NOT_FOUND", 404);
  }
  revalidatePath("/ingredients");
}

export async function updateCategoryAction(id: string, formData: FormData) {
  const { householdId } = await requireActiveHouseholdEditor();
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }
  if (!(await updateCategory(householdId, id, parsed.data.name, parsed.data.sortOrder))) {
    throw new AppError("Kategoria nie istnieje", "NOT_FOUND", 404);
  }
  revalidatePath("/ingredients");
}

export async function createTagAction(formData: FormData) {
  const { householdId } = await requireActiveHouseholdEditor();
  const parsed = tagSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
  });
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }
  await createTag(householdId, parsed.data.name, parsed.data.type);
  revalidatePath("/ingredients");
}

export async function deleteTagAction(id: string) {
  const { householdId } = await requireActiveHouseholdEditor();
  if (!(await deleteTag(householdId, id))) {
    throw new AppError("Tag nie istnieje", "NOT_FOUND", 404);
  }
  revalidatePath("/ingredients");
}

export async function updateTagAction(id: string, formData: FormData) {
  const { householdId } = await requireActiveHouseholdEditor();
  const parsed = tagSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
  });
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }
  if (!(await updateTag(householdId, id, parsed.data.name))) {
    throw new AppError("Tag nie istnieje", "NOT_FOUND", 404);
  }
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
