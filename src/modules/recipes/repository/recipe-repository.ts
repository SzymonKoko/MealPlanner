import { db } from "@/db/client";
import { recipes, recipeIngredients, recipeTags, ingredients, products, compositionSections, compositionOptions } from "@/db/schema";
import { and, eq, isNull, ilike, inArray, ne } from "drizzle-orm";
import type { CompositionInput } from "../validators/composition-schemas";

export async function listRecipes(householdId: string, search?: string) {
  const conditions = [
    eq(recipes.householdId, householdId),
    isNull(recipes.deletedAt),
    ne(recipes.kind, "composition_instance" as const),
  ];
  if (search) conditions.push(ilike(recipes.name, `%${search}%`));

  return db
    .select()
    .from(recipes)
    .where(and(...conditions))
    .orderBy(recipes.name);
}

export async function getComposition(householdId: string, id: string) {
  const recipe = await getRecipe(householdId, id);
  if (!recipe || recipe.kind !== "composition") return null;
  const sections = await db
    .select()
    .from(compositionSections)
    .where(eq(compositionSections.recipeId, id))
    .orderBy(compositionSections.sortOrder);
  const options = sections.length
    ? await db
        .select()
        .from(compositionOptions)
        .where(inArray(compositionOptions.sectionId, sections.map((section) => section.id)))
        .orderBy(compositionOptions.sortOrder)
    : [];
  const sourceIds = options.flatMap((option) => [option.ingredientId, option.productId]).filter(Boolean) as string[];
  const [ingredientRows, productRows] = sourceIds.length
    ? await Promise.all([
        db.select().from(ingredients).where(and(inArray(ingredients.id, sourceIds), eq(ingredients.householdId, householdId))),
        db.select().from(products).where(and(inArray(products.id, sourceIds), eq(products.householdId, householdId))),
      ])
    : [[], []];
  const sourceById = new Map([...ingredientRows, ...productRows].map((source) => [source.id, source]));
  return {
    recipe,
    sections: sections.map((section) => ({
      ...section,
      options: options
        .filter((option) => option.sectionId === section.id)
        .map((option) => ({ ...option, source: sourceById.get(option.ingredientId ?? option.productId ?? "") ?? null })),
    })),
  };
}

export async function createComposition(householdId: string, userId: string, data: CompositionInput) {
  return db.transaction(async (tx) => {
    const [recipe] = await tx.insert(recipes).values({
      householdId,
      createdBy: userId,
      kind: "composition",
      name: data.name,
      description: data.description,
      servings: 1,
    }).returning();
    for (const [sectionIndex, section] of data.sections.entries()) {
      const [createdSection] = await tx.insert(compositionSections).values({
        recipeId: recipe.id,
        name: section.name,
        sortOrder: section.sortOrder ?? sectionIndex,
      }).returning();
      await tx.insert(compositionOptions).values(section.options.map((option, optionIndex) => ({
        sectionId: createdSection.id,
        ingredientId: option.ingredientId ?? null,
        productId: option.productId ?? null,
        quantity: String(option.quantity),
        unit: option.unit,
        sortOrder: option.sortOrder ?? optionIndex,
      })));
    }
    return recipe;
  });
}

export async function updateComposition(householdId: string, id: string, data: CompositionInput) {
  return db.transaction(async (tx) => {
    const [recipe] = await tx.update(recipes).set({
      name: data.name,
      description: data.description,
      updatedAt: new Date(),
    }).where(and(eq(recipes.id, id), eq(recipes.householdId, householdId), eq(recipes.kind, "composition"))).returning();
    if (!recipe) return null;
    await tx.delete(compositionSections).where(eq(compositionSections.recipeId, id));
    for (const [sectionIndex, section] of data.sections.entries()) {
      const [createdSection] = await tx.insert(compositionSections).values({
        recipeId: id,
        name: section.name,
        sortOrder: section.sortOrder ?? sectionIndex,
      }).returning();
      await tx.insert(compositionOptions).values(section.options.map((option, optionIndex) => ({
        sectionId: createdSection.id,
        ingredientId: option.ingredientId ?? null,
        productId: option.productId ?? null,
        quantity: String(option.quantity),
        unit: option.unit,
        sortOrder: option.sortOrder ?? optionIndex,
      })));
    }
    return recipe;
  });
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

export async function getRecipeTags(recipeId: string) {
  return db.select().from(recipeTags).where(eq(recipeTags.recipeId, recipeId));
}

export async function getRecipeTagsForRecipes(recipeIds: string[]) {
  if (!recipeIds.length) return [];
  return db.select().from(recipeTags).where(inArray(recipeTags.recipeId, recipeIds));
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
          .where(
            and(
              eq(ingredients.id, ri.ingredientId),
              eq(ingredients.householdId, householdId),
              isNull(ingredients.deletedAt),
            ),
          )
          .limit(1);
        return { ...ri, source: ingredient };
      }
      if (ri.productId) {
        const [product] = await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.id, ri.productId),
              eq(products.householdId, householdId),
            ),
          )
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

    if (!recipe) return null;

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
  const [recipe] = await db
    .update(recipes)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(recipes.id, id), eq(recipes.householdId, householdId)))
    .returning();
  return recipe ?? null;
}
