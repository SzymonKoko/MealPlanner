"use server";

import { revalidatePath } from "next/cache";
import { requireActiveHousehold } from "@/server/require-household-member";
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
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { calculateRecipeNutrition } from "../services/nutrition-calculator";
import { AppError } from "@/lib/errors";

async function resolveIngredientBaseUnit(
  householdId: string,
  ingredientId?: string | null,
  productId?: string | null,
) {
  if (ingredientId) {
    const ingredient = await getIngredient(householdId, ingredientId);
    if (!ingredient) throw new AppError("Składnik nie istnieje", "NOT_FOUND", 404);
    return {
      nutrition: ingredient,
      baseUnit: ingredient.baseUnit,
    };
  }

  if (productId) {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!product || product.householdId !== householdId) {
      throw new AppError("Produkt nie istnieje", "NOT_FOUND", 404);
    }
    return {
      nutrition: product,
      baseUnit: product.packageUnit ?? "g",
    };
  }

  throw new AppError("Brak składnika lub produktu", "VALIDATION_ERROR");
}

export async function createRecipeAction(formData: FormData) {
  const { user, householdId } = await requireActiveHousehold();

  const ingredientsJson = formData.get("ingredients");
  const parsed = recipeSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    instructions: formData.get("instructions") || undefined,
    servings: formData.get("servings") || 1,
    prepTimeMinutes: formData.get("prepTimeMinutes") || undefined,
    cookTimeMinutes: formData.get("cookTimeMinutes") || undefined,
    imageUrl: formData.get("imageUrl") || null,
    ingredients: ingredientsJson ? JSON.parse(String(ingredientsJson)) : [],
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

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
      const resolved = await resolveIngredientBaseUnit(householdId, ri.ingredientId, ri.productId);
      return {
        quantity: ri.quantity,
        unit: ri.unit,
        optional: ri.optional,
        baseUnit: resolved.baseUnit,
        ...resolved.nutrition,
      };
    }),
  );

  return calculateRecipeNutrition(inputs, data.recipe.servings);
}

export async function deleteRecipeAction(id: string) {
  const { householdId } = await requireActiveHousehold();
  await softDeleteRecipe(householdId, id);
  revalidatePath("/recipes");
}

export async function listRecipesAction(search?: string) {
  const { householdId } = await requireActiveHousehold();
  return listRecipes(householdId, search);
}

export async function updateRecipeAction(id: string, formData: FormData) {
  const { householdId } = await requireActiveHousehold();

  const ingredientsJson = formData.get("ingredients");
  const parsed = recipeSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    instructions: formData.get("instructions") || undefined,
    servings: formData.get("servings") || 1,
    prepTimeMinutes: formData.get("prepTimeMinutes") || undefined,
    cookTimeMinutes: formData.get("cookTimeMinutes") || undefined,
    imageUrl: formData.get("imageUrl") || null,
    ingredients: ingredientsJson ? JSON.parse(String(ingredientsJson)) : [],
  });

  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? "Nieprawidłowe dane", "VALIDATION_ERROR");
  }

  await updateRecipe(
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

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
}
