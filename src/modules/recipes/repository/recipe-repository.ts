import { db } from "@/db/client";
import { recipes, recipeIngredients, recipeTags, ingredients, products } from "@/db/schema";
import { and, eq, isNull, ilike } from "drizzle-orm";

export async function listRecipes(householdId: string, search?: string) {
  const conditions = [eq(recipes.householdId, householdId), isNull(recipes.deletedAt)];
  if (search) conditions.push(ilike(recipes.name, `%${search}%`));

  return db
    .select()
    .from(recipes)
    .where(and(...conditions))
    .orderBy(recipes.name);
}

export async function getRecipe(householdId: string, id: string) {
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.householdId, householdId), isNull(recipes.deletedAt)))
    .limit(1);
  return recipe ?? null;
}

export async function getRecipeIngredients(recipeId: string) {
  return db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(recipeIngredients.sortOrder);
}

export async function getRecipeWithIngredients(householdId: string, id: string) {
  const recipe = await getRecipe(householdId, id);
  if (!recipe) return null;

  const recipeIngs = await getRecipeIngredients(id);
  const enriched = await Promise.all(
    recipeIngs.map(async (ri) => {
      if (ri.ingredientId) {
        const [ingredient] = await db
          .select()
          .from(ingredients)
          .where(eq(ingredients.id, ri.ingredientId))
          .limit(1);
        return { ...ri, source: ingredient };
      }
      if (ri.productId) {
        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.id, ri.productId))
          .limit(1);
        return { ...ri, source: product };
      }
      return { ...ri, source: null };
    }),
  );

  return { recipe, ingredients: enriched };
}

type RecipeInput = Omit<
  typeof recipes.$inferInsert,
  "id" | "householdId" | "createdBy" | "createdAt" | "updatedAt"
>;

type RecipeIngredientInput = Omit<
  typeof recipeIngredients.$inferInsert,
  "id" | "recipeId"
>;

export async function createRecipe(
  householdId: string,
  userId: string,
  data: RecipeInput,
  ingredientsData: RecipeIngredientInput[],
  tagIds?: string[],
) {
  return db.transaction(async (tx) => {
    const [recipe] = await tx
      .insert(recipes)
      .values({ ...data, householdId, createdBy: userId })
      .returning();

    if (ingredientsData.length) {
      await tx.insert(recipeIngredients).values(
        ingredientsData.map((ing, index) => ({
          ...ing,
          recipeId: recipe.id,
          sortOrder: ing.sortOrder ?? index,
        })),
      );
    }

    if (tagIds?.length) {
      await tx.insert(recipeTags).values(tagIds.map((tagId) => ({ recipeId: recipe.id, tagId })));
    }

    return recipe;
  });
}

export async function updateRecipe(
  householdId: string,
  id: string,
  data: Partial<RecipeInput>,
  ingredientsData?: RecipeIngredientInput[],
  tagIds?: string[],
) {
  return db.transaction(async (tx) => {
    const [recipe] = await tx
      .update(recipes)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(recipes.id, id), eq(recipes.householdId, householdId)))
      .returning();

    if (ingredientsData) {
      await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
      if (ingredientsData.length) {
        await tx.insert(recipeIngredients).values(
          ingredientsData.map((ing, index) => ({
            ...ing,
            recipeId: id,
            sortOrder: ing.sortOrder ?? index,
          })),
        );
      }
    }

    if (tagIds) {
      await tx.delete(recipeTags).where(eq(recipeTags.recipeId, id));
      if (tagIds.length) {
        await tx.insert(recipeTags).values(tagIds.map((tagId) => ({ recipeId: id, tagId })));
      }
    }

    return recipe;
  });
}

export async function softDeleteRecipe(householdId: string, id: string) {
  await db
    .update(recipes)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(recipes.id, id), eq(recipes.householdId, householdId)));
}
