"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sanitizePlanReturnTo } from "@/lib/return-to";
import {
  requireActiveHousehold,
  requireActiveHouseholdEditor,
} from "@/server/require-household-member";
import {
  ingredientCreateSchema,
  ingredientUpdateSchema,
  ingredientUnitConversionSchema,
  quickIngredientCreateSchema,
  productCreateSchema,
  productUpdateSchema,
  categorySchema,
  tagSchema,
} from "../validators/ingredient-schemas";
import { approveUsdaIngredientSchema } from "../validators/usda-import-schemas";
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
  replaceIngredientUnitConversions,
} from "../repository/ingredient-repository";
import { AppError } from "@/lib/errors";
import { db } from "@/db/client";
import { categories, tags } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getUsdaFoodDetails, UsdaError } from "@/integrations/usda";
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

/** Unified create: barcode present → product, otherwise → ingredient. */
export async function createCatalogItemAction(formData: FormData) {
  const barcode = String(formData.get("barcode") ?? "").trim();
  if (barcode) {
    await createProductAction(formData);
    return;
  }
  await createIngredientAction(formData);
}

function parseIngredientConversions(formData: FormData) {
  const units = formData.getAll("conversionUnit");
  const grams = formData.getAll("conversionGrams");
  const labels = formData.getAll("conversionLabel");
  const defaults = new Set(formData.getAll("conversionDefault").map(String));

  return units.flatMap((unit, index) => {
    const normalizedUnit = String(unit).trim();
    const normalizedGrams = String(grams[index] ?? "").trim();
    const normalizedLabel = String(labels[index] ?? "").trim();
    if (!normalizedUnit || !normalizedGrams) return [];
    const parsed = ingredientUnitConversionSchema.safeParse({
      unit: normalizedUnit,
      gramsEquivalent: normalizedGrams,
      label: normalizedLabel || undefined,
      isDefault: defaults.has(normalizedUnit),
    });
    if (!parsed.success) {
      throw new AppError(
        parsed.error.errors[0]?.message ?? "Nieprawidłowa konwersja jednostki",
        "VALIDATION_ERROR",
      );
    }
    return [parsed.data];
  });
}

export async function replaceIngredientUnitConversionsAction(id: string, formData: FormData) {
  const { householdId } = await requireActiveHouseholdEditor();
  const ingredient = await getIngredient(householdId, id);
  if (!ingredient) {
    throw new AppError("Składnik nie istnieje", "NOT_FOUND", 404);
  }
  const conversions = parseIngredientConversions(formData);
  await replaceIngredientUnitConversions(id, conversions.map((conversion) => ({
    unit: conversion.unit,
    gramsEquivalent: conversion.gramsEquivalent!,
    label: conversion.label,
    isDefault: conversion.isDefault,
  })));
  revalidatePath("/ingredients");
}

export async function approveUsdaIngredientAction(formData: FormData) {
  const { householdId, user } = await requireActiveHouseholdEditor();
  const parsed = approveUsdaIngredientSchema.safeParse({
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
    nutritionBasis: "per100g",
    densityGramsPerMl: formData.get("densityGramsPerMl") || undefined,
    allergens: formData.get("allergens") || undefined,
    verifiedByUser: formData.get("verifiedByUser") === "true",
    tagIds: formData.getAll("tagIds"),
    externalId: formData.get("externalId"),
    sourceUpdatedAt: formData.get("sourceUpdatedAt") || undefined,
    originalName: formData.get("originalName"),
    dataSource: "usda",
    foodCategory: formData.get("foodCategory") || undefined,
    dataType: formData.get("dataType") || undefined,
    translatedQuery: formData.get("translatedQuery") || undefined,
    conversions: parseIngredientConversions(formData),
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  const { tagIds, conversions, ...data } = parsed.data;
  await validateIngredientReferences(householdId, data.categoryId, tagIds);

  const descriptionParts = [data.description, data.foodCategory, data.dataType]
    .filter(Boolean)
    .map(String);
  const baselineMatches = (field: string, current?: string) =>
    String(formData.get(field) ?? "").trim() === String(current ?? "").trim();
  const manuallyModified =
    !baselineMatches("baselineDescription", data.description) ||
    !baselineMatches("baselineKcalPer100", data.kcalPer100) ||
    !baselineMatches("baselineProteinPer100", data.proteinPer100) ||
    !baselineMatches("baselineCarbsPer100", data.carbsPer100) ||
    !baselineMatches("baselineFatPer100", data.fatPer100) ||
    !baselineMatches("baselineFiberPer100", data.fiberPer100) ||
    !baselineMatches("baselineSaltPer100", data.saltPer100) ||
    Boolean(data.densityGramsPerMl) ||
    Boolean(data.allergens) ||
    (conversions?.length ?? 0) > 0 ||
    data.baseUnit !== "g";

  const ingredient = await createIngredient(
    householdId,
    user.id,
    {
      name: data.name,
      description: descriptionParts.join(" | ") || null,
      categoryId: data.categoryId,
      baseUnit: data.baseUnit,
      nutritionBasis: data.nutritionBasis,
      kcalPer100: data.kcalPer100,
      proteinPer100: data.proteinPer100,
      carbsPer100: data.carbsPer100,
      fatPer100: data.fatPer100,
      fiberPer100: data.fiberPer100,
      saltPer100: data.saltPer100,
      densityGramsPerMl: data.densityGramsPerMl,
      allergens: data.allergens,
      dataSource: manuallyModified ? "household_override" : "usda",
      externalId: data.externalId,
      importedAt: new Date(),
      sourceUpdatedAt: data.sourceUpdatedAt ?? null,
      verifiedByUser: true,
      manuallyModified,
    },
    tagIds,
  );

  if (conversions?.length) {
    await replaceIngredientUnitConversions(
      ingredient.id,
      conversions.map((conversion) => ({
        unit: conversion.unit,
        gramsEquivalent: conversion.gramsEquivalent!,
        label: conversion.label,
        isDefault: conversion.isDefault,
      })),
    );
  }

  revalidatePath("/ingredients");
  revalidatePath("/ingredients/usda");
  const returnTo = sanitizePlanReturnTo(String(formData.get("returnTo") ?? ""));
  redirect(returnTo ?? "/ingredients");
}

export async function quickAddUsdaIngredientAction(formData: FormData) {
  const { householdId, user } = await requireActiveHouseholdEditor();
  const externalId = String(formData.get("externalId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!externalId) {
    throw new AppError("Brak identyfikatora USDA", "VALIDATION_ERROR");
  }

  let details;
  try {
    details = await getUsdaFoodDetails(Number(externalId));
  } catch (error) {
    if (error instanceof UsdaError) {
      throw new AppError(error.message, "VALIDATION_ERROR");
    }
    throw error;
  }

  const ingredientName = name || details.name;
  const ingredient = await createIngredient(
    householdId,
    user.id,
    {
      name: ingredientName,
      description: [details.description, details.foodCategory, details.dataType]
        .filter(Boolean)
        .join(" | ") || null,
      categoryId: null,
      baseUnit: "g",
      nutritionBasis: "per100g",
      kcalPer100: details.kcalPer100,
      proteinPer100: details.proteinPer100,
      carbsPer100: details.carbsPer100,
      fatPer100: details.fatPer100,
      fiberPer100: details.fiberPer100,
      saltPer100: details.saltPer100,
      densityGramsPerMl: null,
      allergens: null,
      dataSource: "usda",
      externalId: details.externalId,
      importedAt: new Date(),
      sourceUpdatedAt: details.sourceUpdatedAt,
      verifiedByUser: true,
      manuallyModified: false,
    },
    [],
  );

  revalidatePath("/ingredients");
  revalidatePath("/ingredients/usda");
  revalidatePath("/plan");

  return {
    id: ingredient.id,
    name: ingredient.name,
    nutritionBasis: ingredient.nutritionBasis,
    kcalPer100: details.kcalPer100,
    proteinPer100: details.proteinPer100,
    carbsPer100: details.carbsPer100,
    fatPer100: details.fatPer100,
    fiberPer100: details.fiberPer100,
    saltPer100: details.saltPer100,
  };
}

export async function quickCreateIngredientAction(formData: FormData) {
  const { user, householdId } = await requireActiveHouseholdEditor();
  const parsed = quickIngredientCreateSchema.safeParse({
    name: formData.get("name"),
    kcalPer100: formData.get("kcalPer100") || undefined,
    proteinPer100: formData.get("proteinPer100") || undefined,
    carbsPer100: formData.get("carbsPer100") || undefined,
    fatPer100: formData.get("fatPer100") || undefined,
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  const ingredient = await createIngredient(
    householdId,
    user.id,
    {
      name: parsed.data.name,
      categoryId: null,
      baseUnit: "g",
      nutritionBasis: "per100g",
      kcalPer100: parsed.data.kcalPer100 ?? null,
      proteinPer100: parsed.data.proteinPer100 ?? null,
      carbsPer100: parsed.data.carbsPer100 ?? null,
      fatPer100: parsed.data.fatPer100 ?? null,
      dataSource: "manual",
      manuallyModified: true,
      verifiedByUser: false,
    },
    [],
  );

  revalidatePath("/ingredients");
  revalidatePath("/plan");

  return {
    id: ingredient.id,
    name: ingredient.name,
    nutritionBasis: ingredient.nutritionBasis,
    kcalPer100: ingredient.kcalPer100,
    proteinPer100: ingredient.proteinPer100,
    carbsPer100: ingredient.carbsPer100,
    fatPer100: ingredient.fatPer100,
    fiberPer100: ingredient.fiberPer100,
    saltPer100: ingredient.saltPer100,
  };
}
