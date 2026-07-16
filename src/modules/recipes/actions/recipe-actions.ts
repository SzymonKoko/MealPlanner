"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireActiveHousehold,
  requireActiveHouseholdEditor,
} from "@/server/require-household-member";
import { recipeSchema } from "../validators/recipe-schemas";
import {
  createRecipe,
  updateRecipe,
  softDeleteRecipe,
  getRecipeWithIngredients,
  listRecipes,
} from "../repository/recipe-repository";
import { getIngredient } from "@/modules/ingredients/repository/ingredient-repository";
import { db } from "@/db/client";
import { products, tags } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { calculateRecipeNutrition } from "../services/nutrition-calculator";
import { AppError } from "@/lib/errors";

async function resolveNutritionSource(
  householdId: string,
  ingredientId?: string | null,
  productId?: string | null,
) {
  if (ingredientId) {
    const ingredient = await getIngredient(householdId, ingredientId);
    if (!ingredient) throw new AppError("Składnik nie istnieje", "NOT_FOUND", 404);
    return {
      nutrition: ingredient,
    };
  }

  if (productId) {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.householdId, householdId)))
      .limit(1);
    if (!product) {
      throw new AppError("Produkt nie istnieje", "NOT_FOUND", 404);
    }
    const linkedIngredient = product.ingredientId
      ? await getIngredient(householdId, product.ingredientId)
      : null;
    return {
      nutrition: {
        ...product,
        densityGramsPerMl: linkedIngredient?.densityGramsPerMl ?? null,
      },
    };
  }

  throw new AppError("Brak składnika lub produktu", "VALIDATION_ERROR");
}

function parseIngredients(value: FormDataEntryValue | null) {
  if (!value) return [];
  try {
    return JSON.parse(String(value));
  } catch {
    throw new AppError("Nieprawidłowa lista składników", "VALIDATION_ERROR");
  }
}

async function validateRecipeReferences(
  householdId: string,
  recipeIngredients: Array<{ ingredientId?: string | null; productId?: string | null }>,
  tagIds?: string[],
) {
  await Promise.all(
    recipeIngredients.map((item) =>
      resolveNutritionSource(householdId, item.ingredientId, item.productId),
    ),
  );

  if (tagIds?.length) {
    const householdTags = await db
      .select({ id: tags.id })
      .from(tags)
      .where(
        and(
          eq(tags.householdId, householdId),
          eq(tags.type, "recipe"),
          inArray(tags.id, tagIds),
        ),
      );
    if (householdTags.length !== new Set(tagIds).size) {
      throw new AppError("Co najmniej jeden tag nie należy do gospodarstwa", "VALIDATION_ERROR");
    }
  }
}

export async function createRecipeAction(formData: FormData) {
  const { user, householdId } = await requireActiveHouseholdEditor();

  const ingredientsJson = formData.get("ingredients");
  const parsed = recipeSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    instructions: formData.get("instructions") || undefined,
    servings: formData.get("servings") || 1,
    prepTimeMinutes: formData.get("prepTimeMinutes") || undefined,
    cookTimeMinutes: formData.get("cookTimeMinutes") || undefined,
    imageUrl: formData.get("imageUrl") || null,
    ingredients: parseIngredients(ingredientsJson),
    tagIds: formData.getAll("tagIds"),
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  await validateRecipeReferences(householdId, parsed.data.ingredients, parsed.data.tagIds);

  const recipe = await createRecipe(
    householdId,
    user.id,
    {
      name: parsed.data.name,
      description: parsed.data.description,
      instructions: parsed.data.instructions,
      servings: parsed.data.servings,
      prepTimeMinutes: parsed.data.prepTimeMinutes,
      cookTimeMinutes: parsed.data.cookTimeMinutes,
      imageUrl: parsed.data.imageUrl,
    },
    parsed.data.ingredients,
    parsed.data.tagIds,
  );

  revalidatePath("/recipes");
  return recipe;
}

export async function getRecipeNutritionAction(recipeId: string) {
  const { householdId } = await requireActiveHousehold();
  const data = await getRecipeWithIngredients(householdId, recipeId);
  if (!data) throw new AppError("Przepis nie istnieje", "NOT_FOUND", 404);

  const inputs = await Promise.all(
    data.ingredients.map(async (ri) => {
      const resolved = await resolveNutritionSource(householdId, ri.ingredientId, ri.productId);
      return {
        quantity: ri.quantity,
        unit: ri.unit,
        optional: ri.optional,
        ...resolved.nutrition,
      };
    }),
  );

  return calculateRecipeNutrition(inputs, data.recipe.servings);
}

export async function deleteRecipeAction(id: string) {
  const { householdId } = await requireActiveHouseholdEditor();
  if (!(await softDeleteRecipe(householdId, id))) {
    throw new AppError("Przepis nie istnieje", "NOT_FOUND", 404);
  }
  revalidatePath("/recipes");
}

export async function deleteRecipeFormAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") {
    throw new AppError("Brak ID przepisu", "VALIDATION_ERROR");
  }
  await deleteRecipeAction(id);
  redirect("/recipes");
}

export async function listRecipesAction(search?: string) {
  const { householdId } = await requireActiveHousehold();
  return listRecipes(householdId, search);
}

export async function updateRecipeAction(id: string, formData: FormData) {
  const { householdId } = await requireActiveHouseholdEditor();

  const ingredientsJson = formData.get("ingredients");
  const parsed = recipeSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    instructions: formData.get("instructions") || undefined,
    servings: formData.get("servings") || 1,
    prepTimeMinutes: formData.get("prepTimeMinutes") || undefined,
    cookTimeMinutes: formData.get("cookTimeMinutes") || undefined,
    imageUrl: formData.get("imageUrl") || null,
    ingredients: parseIngredients(ingredientsJson),
    tagIds: formData.getAll("tagIds"),
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  await validateRecipeReferences(householdId, parsed.data.ingredients, parsed.data.tagIds);

  const recipe = await updateRecipe(
    householdId,
    id,
    {
      name: parsed.data.name,
      description: parsed.data.description,
      instructions: parsed.data.instructions,
      servings: parsed.data.servings,
      prepTimeMinutes: parsed.data.prepTimeMinutes,
      cookTimeMinutes: parsed.data.cookTimeMinutes,
      imageUrl: parsed.data.imageUrl,
    },
    parsed.data.ingredients,
    parsed.data.tagIds,
  );
  if (!recipe) {
    throw new AppError("Przepis nie istnieje", "NOT_FOUND", 404);
  }

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
}
