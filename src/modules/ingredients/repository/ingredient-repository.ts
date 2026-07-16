import { db } from "@/db/client";
import {
  ingredients,
  products,
  categories,
  tags,
  ingredientTags,
  productTags,
  ingredientUnitConversions,
} from "@/db/schema";
import { and, eq, ilike, isNull, inArray, or } from "drizzle-orm";

export async function listIngredients(householdId: string, search?: string, categoryId?: string) {
  const conditions = [
    eq(ingredients.householdId, householdId),
    isNull(ingredients.deletedAt),
  ];

  if (search) {
    conditions.push(ilike(ingredients.name, `%${search}%`));
  }
  if (categoryId) {
    conditions.push(eq(ingredients.categoryId, categoryId));
  }

  return db
    .select()
    .from(ingredients)
    .where(and(...conditions))
    .orderBy(ingredients.name);
}

export async function getIngredient(householdId: string, id: string) {
  const [ingredient] = await db
    .select()
    .from(ingredients)
    .where(
      and(
        eq(ingredients.id, id),
        eq(ingredients.householdId, householdId),
        isNull(ingredients.deletedAt),
      ),
    )
    .limit(1);
  return ingredient ?? null;
}

type IngredientInput = Omit<
  typeof ingredients.$inferInsert,
  "id" | "householdId" | "createdBy" | "createdAt" | "updatedAt"
>;

export async function createIngredient(
  householdId: string,
  userId: string,
  data: IngredientInput,
  tagIds?: string[],
) {
  return db.transaction(async (tx) => {
    const [ingredient] = await tx
      .insert(ingredients)
      .values({ ...data, householdId, createdBy: userId })
      .returning();

    if (tagIds?.length) {
      await tx.insert(ingredientTags).values(tagIds.map((tagId) => ({ ingredientId: ingredient.id, tagId })));
    }

    return ingredient;
  });
}

export async function updateIngredient(
  householdId: string,
  id: string,
  data: Partial<typeof ingredients.$inferInsert>,
  tagIds?: string[],
) {
  return db.transaction(async (tx) => {
    const [ingredient] = await tx
      .update(ingredients)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(ingredients.id, id), eq(ingredients.householdId, householdId)))
      .returning();

    if (!ingredient) return null;

    if (tagIds) {
      await tx.delete(ingredientTags).where(eq(ingredientTags.ingredientId, id));
      if (tagIds.length) {
        await tx.insert(ingredientTags).values(tagIds.map((tagId) => ({ ingredientId: id, tagId })));
      }
    }

    return ingredient;
  });
}

export async function softDeleteIngredient(householdId: string, id: string) {
  const [ingredient] = await db
    .update(ingredients)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(ingredients.id, id), eq(ingredients.householdId, householdId)))
    .returning();
  return ingredient ?? null;
}

export async function listProducts(householdId: string, search?: string) {
  const conditions = [eq(products.householdId, householdId)];
  if (search) {
    conditions.push(
      or(
        ilike(products.name, `%${search}%`),
        ilike(products.brand, `%${search}%`),
        ilike(products.barcode, `%${search}%`),
      )!,
    );
  }

  return db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(products.name);
}

export async function getProduct(householdId: string, id: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.householdId, householdId)))
    .limit(1);
  return product ?? null;
}

export async function getProductByBarcode(householdId: string, barcode: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.householdId, householdId), eq(products.barcode, barcode)))
    .limit(1);
  return product ?? null;
}

type ProductInput = Omit<
  typeof products.$inferInsert,
  "id" | "householdId" | "createdAt" | "updatedAt"
>;

export async function createProduct(householdId: string, data: ProductInput, tagIds?: string[]) {
  return db.transaction(async (tx) => {
    const [product] = await tx.insert(products).values({ ...data, householdId }).returning();
    if (tagIds?.length) {
      await tx.insert(productTags).values(tagIds.map((tagId) => ({ productId: product.id, tagId })));
    }
    return product;
  });
}

export async function updateProduct(
  householdId: string,
  id: string,
  data: Partial<ProductInput>,
  tagIds?: string[],
) {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(products.id, id), eq(products.householdId, householdId)))
      .returning();
    if (!product) return null;
    if (tagIds) {
      await tx.delete(productTags).where(eq(productTags.productId, id));
      if (tagIds.length) {
        await tx.insert(productTags).values(tagIds.map((tagId) => ({ productId: id, tagId })));
      }
    }
    return product;
  });
}

export async function deleteProduct(householdId: string, id: string) {
  const [product] = await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.householdId, householdId)))
    .returning();
  return product ?? null;
}

export async function listCategories(householdId: string) {
  return db
    .select()
    .from(categories)
    .where(eq(categories.householdId, householdId))
    .orderBy(categories.sortOrder, categories.name);
}

export async function createCategory(householdId: string, name: string, sortOrder = 0) {
  const [category] = await db
    .insert(categories)
    .values({ householdId, name, sortOrder })
    .returning();
  return category;
}

export async function deleteCategory(householdId: string, id: string) {
  const [category] = await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.householdId, householdId)))
    .returning();
  return category ?? null;
}

export async function updateCategory(
  householdId: string,
  id: string,
  name: string,
  sortOrder = 0,
) {
  const [category] = await db
    .update(categories)
    .set({ name, sortOrder })
    .where(and(eq(categories.id, id), eq(categories.householdId, householdId)))
    .returning();
  return category ?? null;
}

export async function listTags(householdId: string, type?: string) {
  const conditions = [eq(tags.householdId, householdId)];
  if (type) conditions.push(eq(tags.type, type));
  return db.select().from(tags).where(and(...conditions)).orderBy(tags.name);
}

export async function createTag(
  householdId: string,
  name: string,
  type: "ingredient" | "product" | "recipe",
) {
  const [tag] = await db.insert(tags).values({ householdId, name, type }).returning();
  return tag;
}

export async function deleteTag(householdId: string, id: string) {
  const [tag] = await db
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.householdId, householdId)))
    .returning();
  return tag ?? null;
}

export async function updateTag(
  householdId: string,
  id: string,
  name: string,
) {
  const [tag] = await db
    .update(tags)
    .set({ name })
    .where(and(eq(tags.id, id), eq(tags.householdId, householdId)))
    .returning();
  return tag ?? null;
}

export async function getIngredientTags(ingredientIds: string[]) {
  if (!ingredientIds.length) return [];
  return db.select().from(ingredientTags).where(inArray(ingredientTags.ingredientId, ingredientIds));
}

export async function getProductTags(productIds: string[]) {
  if (!productIds.length) return [];
  return db.select().from(productTags).where(inArray(productTags.productId, productIds));
}

export async function getIngredientUnitConversions(ingredientIds: string[]) {
  if (!ingredientIds.length) return [];
  return db
    .select()
    .from(ingredientUnitConversions)
    .where(inArray(ingredientUnitConversions.ingredientId, ingredientIds));
}

export async function replaceIngredientUnitConversions(
  ingredientId: string,
  conversions: Array<{
    unit: string;
    gramsEquivalent: string;
    label?: string;
    isDefault?: boolean;
  }>,
) {
  return db.transaction(async (tx) => {
    await tx.delete(ingredientUnitConversions).where(eq(ingredientUnitConversions.ingredientId, ingredientId));
    if (!conversions.length) return;
    await tx.insert(ingredientUnitConversions).values(
      conversions.map((conversion) => ({
        ingredientId,
        unit: conversion.unit,
        gramsEquivalent: conversion.gramsEquivalent,
        label: conversion.label ?? null,
        isDefault: conversion.isDefault ?? false,
      })),
    );
  });
}
