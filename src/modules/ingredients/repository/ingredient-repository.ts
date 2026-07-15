import { db } from "@/db/client";
import {
  ingredients,
  products,
  categories,
  tags,
  ingredientTags,
} from "@/db/schema";
import { and, eq, ilike, isNull, inArray } from "drizzle-orm";

export async function listIngredients(householdId: string, search?: string) {
  const conditions = [
    eq(ingredients.householdId, householdId),
    isNull(ingredients.deletedAt),
  ];

  if (search) {
    conditions.push(ilike(ingredients.name, `%${search}%`));
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
  await db
    .update(ingredients)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(ingredients.id, id), eq(ingredients.householdId, householdId)));
}

export async function listProducts(householdId: string, search?: string) {
  const conditions = [eq(products.householdId, householdId)];
  if (search) conditions.push(ilike(products.name, `%${search}%`));

  return db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(products.name);
}

type ProductInput = Omit<
  typeof products.$inferInsert,
  "id" | "householdId" | "createdAt" | "updatedAt"
>;

export async function createProduct(householdId: string, data: ProductInput) {
  const [product] = await db.insert(products).values({ ...data, householdId }).returning();
  return product;
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

export async function listTags(householdId: string, type?: string) {
  const conditions = [eq(tags.householdId, householdId)];
  if (type) conditions.push(eq(tags.type, type));
  return db.select().from(tags).where(and(...conditions)).orderBy(tags.name);
}

export async function getIngredientTags(ingredientIds: string[]) {
  if (!ingredientIds.length) return [];
  return db.select().from(ingredientTags).where(inArray(ingredientTags.ingredientId, ingredientIds));
}
