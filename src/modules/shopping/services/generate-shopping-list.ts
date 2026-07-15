import { scaleRecipeIngredients } from "@/modules/recipes/services/nutrition-calculator";
import { getEntriesInDateRange } from "@/modules/meal-planner/repository/meal-plan-repository";
import { getRecipeIngredients } from "@/modules/recipes/repository/recipe-repository";
import { getIngredient } from "@/modules/ingredients/repository/ingredient-repository";
import { addQuantities } from "@/lib/units";
import { db } from "@/db/client";
import { recipes } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface AggregatedItem {
  ingredientId: string | null;
  productId: string | null;
  name: string;
  quantity: number;
  unit: string;
  categoryId: string | null;
}

export async function collectIngredientsFromPlan(
  householdId: string,
  dateFrom: string,
  dateTo: string,
): Promise<AggregatedItem[]> {
  const entries = await getEntriesInDateRange(householdId, dateFrom, dateTo);
  const aggregated = new Map<string, AggregatedItem>();

  for (const entry of entries) {
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, entry.recipeId))
      .limit(1);
    if (!recipe) continue;

    const recipeIngs = await getRecipeIngredients(entry.recipeId);
    const scaled = scaleRecipeIngredients(
      recipeIngs.map((ri) => ({ quantity: ri.quantity, unit: ri.unit })),
      recipe.servings,
      entry.servings,
    );

    for (let i = 0; i < recipeIngs.length; i++) {
      const ri = recipeIngs[i];
      const scaledIng = scaled[i];
      if (ri.optional) continue;

      let name = "Nieznany składnik";
      let categoryId: string | null = null;

      if (ri.ingredientId) {
        const ingredient = await getIngredient(householdId, ri.ingredientId);
        if (ingredient) {
          name = ingredient.name;
          categoryId = ingredient.categoryId;
        }
      }

      const key = `${ri.ingredientId ?? ri.productId}-${scaledIng.unit}`;
      const existing = aggregated.get(key);

      if (existing) {
        const added = addQuantities(
          { quantity: existing.quantity, unit: existing.unit },
          { quantity: Number.parseFloat(scaledIng.quantity), unit: scaledIng.unit },
        );
        if (added) {
          existing.quantity = added.quantity;
        }
      } else {
        aggregated.set(key, {
          ingredientId: ri.ingredientId,
          productId: ri.productId,
          name,
          quantity: Number.parseFloat(scaledIng.quantity),
          unit: scaledIng.unit,
          categoryId,
        });
      }
    }
  }

  return Array.from(aggregated.values());
}
