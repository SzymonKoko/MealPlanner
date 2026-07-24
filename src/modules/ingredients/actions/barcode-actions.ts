"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { finishPlanReturnUrl, parsePlanReturnTarget, sanitizePlanReturnTo } from "@/lib/return-to";
import { AppError } from "@/lib/errors";
import { requireActiveHouseholdEditor } from "@/server/require-household-member";
import {
  getIngredient,
  getProduct,
  createProduct,
  updateProduct,
} from "../repository/ingredient-repository";
import { approveImportedProductSchema } from "../validators/barcode-import-schemas";
import {
  hasNutritionChanged,
  markManualNutritionUpdate,
} from "../services/nutrition-source";
import { z } from "zod";
import { db } from "@/db/client";
import { mealPlanAssignments, mealPlanEntries, products } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const quickScannedProductPlanSchema = z.intersection(approveImportedProductSchema, z.object({
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(20),
  returnTo: z.string().min(1),
}));

export async function quickAddScannedProductToPlanAction(formData: FormData) {
  const { user, householdId } = await requireActiveHouseholdEditor();
  const target = parsePlanReturnTarget(String(formData.get("returnTo") ?? ""));
  const packageUnit = formData.get("packageUnit") || undefined;
  const parsed = quickScannedProductPlanSchema.safeParse({
    existingProductId: formData.get("existingProductId") || undefined,
    barcode: formData.get("barcode"),
    name: formData.get("name"),
    brand: formData.get("brand") || undefined,
    packageQuantity: packageUnit ? formData.get("packageQuantity") || undefined : undefined,
    packageUnit,
    imageUrl: formData.get("imageUrl") || null,
    nutritionBasis: formData.get("nutritionBasis") || "per100g",
    kcalPer100: formData.get("kcalPer100") || undefined,
    proteinPer100: formData.get("proteinPer100") || undefined,
    carbsPer100: formData.get("carbsPer100") || undefined,
    fatPer100: formData.get("fatPer100") || undefined,
    fiberPer100: formData.get("fiberPer100") || undefined,
    saltPer100: formData.get("saltPer100") || undefined,
    sourceUpdatedAt: formData.get("sourceUpdatedAt") || undefined,
    externalId: formData.get("externalId") || undefined,
    dataSource: formData.get("dataSource") || "open_food_facts",
    verifiedByUser: false,
    quantity: formData.get("quantity"),
    unit: formData.get("unit"),
    returnTo: formData.get("returnTo"),
  });

  if (!target || !parsed.success) {
    throw new AppError(
      parsed.success ? "Nieprawidłowy cel planu" : parsed.error.errors[0]?.message ?? "Nieprawidłowe dane",
      "VALIDATION_ERROR",
    );
  }

  await db.transaction(async (tx) => {
    let product = parsed.data.existingProductId
      ? (await tx.select().from(products).where(and(
          eq(products.id, parsed.data.existingProductId),
          eq(products.householdId, householdId),
        )).limit(1))[0]
      : undefined;

    if (!product) {
      product = (await tx.select().from(products).where(and(
          eq(products.householdId, householdId),
          eq(products.barcode, parsed.data.barcode),
        )).limit(1))[0];
    }

    if (!product) {
      [product] = await tx.insert(products).values({
        householdId,
        name: parsed.data.name,
        brand: parsed.data.brand,
        barcode: parsed.data.barcode,
        packageQuantity: parsed.data.packageQuantity,
        packageUnit: parsed.data.packageUnit ?? null,
        nutritionBasis: parsed.data.nutritionBasis,
        kcalPer100: parsed.data.kcalPer100,
        proteinPer100: parsed.data.proteinPer100,
        carbsPer100: parsed.data.carbsPer100,
        fatPer100: parsed.data.fatPer100,
        fiberPer100: parsed.data.fiberPer100,
        saltPer100: parsed.data.saltPer100,
        imageUrl: parsed.data.imageUrl,
        dataSource: parsed.data.dataSource,
        externalId: parsed.data.externalId ?? null,
        importedAt: parsed.data.dataSource === "open_food_facts" ? new Date() : null,
        sourceUpdatedAt: parsed.data.sourceUpdatedAt ?? null,
        verifiedByUser: false,
        manuallyModified: false,
      }).returning();
    }

    const [entry] = await tx.insert(mealPlanEntries).values({
      householdId,
      createdBy: user.id,
      productId: product.id,
      date: target.date,
      mealType: target.mealType,
      servings: 1,
      quantity: String(parsed.data.quantity),
      unit: parsed.data.unit,
    }).returning();

    if (target.scope === "mine") {
      await tx.insert(mealPlanAssignments).values({
        mealPlanEntryId: entry.id,
        userId: user.id,
        share: "1",
      });
    }
  });

  revalidatePath("/ingredients");
  revalidatePath("/plan");
  revalidatePath("/today");
  redirect(finishPlanReturnUrl(target.returnTo));
}

export async function approveImportedProductAction(formData: FormData) {
  const { householdId } = await requireActiveHouseholdEditor();
  const parsed = approveImportedProductSchema.safeParse({
    existingProductId: formData.get("existingProductId") || undefined,
    ingredientId: formData.get("ingredientId") || null,
    barcode: formData.get("barcode"),
    name: formData.get("name"),
    brand: formData.get("brand") || undefined,
    packageQuantity: formData.get("packageQuantity") || undefined,
    packageUnit: formData.get("packageUnit") || undefined,
    imageUrl: formData.get("imageUrl") || null,
    nutritionBasis: formData.get("nutritionBasis") || "per100g",
    kcalPer100: formData.get("kcalPer100") || undefined,
    proteinPer100: formData.get("proteinPer100") || undefined,
    carbsPer100: formData.get("carbsPer100") || undefined,
    fatPer100: formData.get("fatPer100") || undefined,
    fiberPer100: formData.get("fiberPer100") || undefined,
    saltPer100: formData.get("saltPer100") || undefined,
    sourceUpdatedAt: formData.get("sourceUpdatedAt") || undefined,
    externalId: formData.get("externalId") || undefined,
    dataSource: formData.get("dataSource") || "manual",
    verifiedByUser: formData.get("verifiedByUser") === "true",
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  if (parsed.data.ingredientId && !(await getIngredient(householdId, parsed.data.ingredientId))) {
    throw new AppError("Składnik nie należy do gospodarstwa", "VALIDATION_ERROR");
  }

  const payload = {
    ingredientId: parsed.data.ingredientId,
    name: parsed.data.name,
    brand: parsed.data.brand,
    barcode: parsed.data.barcode,
    packageQuantity: parsed.data.packageQuantity,
    packageUnit: parsed.data.packageUnit ?? null,
    nutritionBasis: parsed.data.nutritionBasis,
    kcalPer100: parsed.data.kcalPer100,
    proteinPer100: parsed.data.proteinPer100,
    carbsPer100: parsed.data.carbsPer100,
    fatPer100: parsed.data.fatPer100,
    fiberPer100: parsed.data.fiberPer100,
    saltPer100: parsed.data.saltPer100,
    imageUrl: parsed.data.imageUrl,
    dataSource: parsed.data.dataSource,
    externalId: parsed.data.externalId ?? null,
    importedAt: parsed.data.dataSource === "open_food_facts" ? new Date() : null,
    sourceUpdatedAt: parsed.data.sourceUpdatedAt ?? null,
    verifiedByUser: parsed.data.verifiedByUser,
    manuallyModified: parsed.data.dataSource === "manual",
  };

  if (parsed.data.existingProductId) {
    const current = await getProduct(householdId, parsed.data.existingProductId);
    if (!current) throw new AppError("Produkt nie istnieje", "NOT_FOUND", 404);

    const sourceUpdate = markManualNutritionUpdate(current, parsed.data);
    await updateProduct(
      householdId,
      parsed.data.existingProductId,
      {
        ...payload,
        importedAt:
          parsed.data.dataSource === "open_food_facts"
            ? current.importedAt ?? new Date()
            : current.importedAt,
        manuallyModified: sourceUpdate.manuallyModified,
        dataSource: sourceUpdate.dataSource ?? payload.dataSource,
      },
    );
  } else {
    const importedSource = {
      nutritionBasis: String(formData.get("originalNutritionBasis") || parsed.data.nutritionBasis) as "per100g" | "per100ml",
      kcalPer100: (formData.get("originalKcalPer100") as string) || null,
      proteinPer100: (formData.get("originalProteinPer100") as string) || null,
      carbsPer100: (formData.get("originalCarbsPer100") as string) || null,
      fatPer100: (formData.get("originalFatPer100") as string) || null,
      fiberPer100: (formData.get("originalFiberPer100") as string) || null,
      saltPer100: (formData.get("originalSaltPer100") as string) || null,
    };
    const manuallyModified =
      parsed.data.dataSource === "manual"
        ? true
        : hasNutritionChanged(importedSource, parsed.data);

    await createProduct(householdId, {
      ...payload,
      manuallyModified,
      dataSource:
        manuallyModified && parsed.data.dataSource === "open_food_facts"
          ? "household_override"
          : payload.dataSource,
    });
  }

  revalidatePath("/ingredients");
  revalidatePath("/ingredients/scan");
  revalidatePath("/plan");
  if (formData.get("noRedirect") === "true") {
    return;
  }
  const returnTo = sanitizePlanReturnTo(String(formData.get("returnTo") ?? ""));
  redirect(returnTo ?? "/ingredients");
}
