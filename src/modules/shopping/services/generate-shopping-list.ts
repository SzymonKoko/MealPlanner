import { scaleRecipeIngredients } from "@/modules/recipes/services/nutrition-calculator";
import { getEntriesInDateRange } from "@/modules/meal-planner/repository/meal-plan-repository";
import {
  getRecipe,
  getRecipeIngredients,
} from "@/modules/recipes/repository/recipe-repository";
import { getIngredient } from "@/modules/ingredients/repository/ingredient-repository";
import { convertToBaseUnit } from "@/lib/units";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export interface AggregatedItem {
  ingredientId: string | null;
  productId: string | null;
  name: string;
  quantity: number;
  unit: string;
  categoryId: string | null;
}

export function aggregateShoppingItems(items: AggregatedItem[]): AggregatedItem[] {
  const aggregated = new Map<string, AggregatedItem>();
  for (const item of items) {
    const targetUnit = item.unit === "kg" ? "g" : item.unit === "l" ? "ml" : item.unit;
    const normalizedQuantity =
      convertToBaseUnit(item.quantity, item.unit, targetUnit) ?? item.quantity;
    const key = `${item.ingredientId ?? item.productId}-${targetUnit}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += normalizedQuantity;
    } else {
      aggregated.set(key, { ...item, quantity: normalizedQuantity, unit: targetUnit });
    }
  }
  return Array.from(aggregated.values());
}

async function collectFromRecipeEntry(
  householdId: string,
  recipeId: string,
  servings: number,
): Promise<AggregatedItem[]> {
  const recipe = await getRecipe(householdId, recipeId);
  if (!recipe) return [];

  const recipeIngs = await getRecipeIngredients(recipeId);
  const scaled = scaleRecipeIngredients(
    recipeIngs.map((ri) => ({ quantity: ri.quantity, unit: ri.unit })),
    recipe.servings,
    servings,
  );

  const collected: AggregatedItem[] = [];
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
    } else if (ri.productId) {
      const [product] = await db
        .select()
        .from(products)
        .where(and(eq(products.id, ri.productId), eq(products.householdId, householdId)))
        .limit(1);
      if (product) {
        name = product.name;
      }
    }

    collected.push({
      ingredientId: ri.ingredientId,
      productId: ri.productId,
      name,
      quantity: Number.parseFloat(scaledIng.quantity),
      unit: scaledIng.unit,
      categoryId,
    });
  }
  return collected;
}

export async function collectIngredientsFromPlan(
  householdId: string,
  dateFrom: string,
  dateTo: string,
): Promise<AggregatedItem[]> {
  const entries = await getEntriesInDateRange(householdId, dateFrom, dateTo);
  const collected: AggregatedItem[] = [];

  for (const entry of entries) {
    if (entry.recipeId) {
      collected.push(...(await collectFromRecipeEntry(householdId, entry.recipeId, entry.servings)));
      continue;
    }

    if (entry.ingredientId) {
      const ingredient = await getIngredient(householdId, entry.ingredientId);
      if (!ingredient) continue;
      // Jedna porcja składnika ≈ 100 jednostek bazowych (g/ml).
      collected.push({
        ingredientId: ingredient.id,
        productId: null,
        name: ingredient.name,
        quantity: entry.servings * 100,
        unit: ingredient.baseUnit,
        categoryId: ingredient.categoryId,
      });
      continue;
    }

    if (entry.productId) {
      const [product] = await db
        .select()
        .from(products)
        .where(and(eq(products.id, entry.productId), eq(products.householdId, householdId)))
        .limit(1);
      if (!product) continue;
      if (product.packageQuantity && product.packageUnit) {
        collected.push({
          ingredientId: product.ingredientId,
          productId: product.id,
          name: product.name,
          quantity: entry.servings * Number.parseFloat(product.packageQuantity),
          unit: product.packageUnit,
          categoryId: null,
        });
      } else {
        collected.push({
          ingredientId: product.ingredientId,
          productId: product.id,
          name: product.name,
          quantity: entry.servings,
          unit: "szt",
          categoryId: null,
        });
      }
    }
  }

  return aggregateShoppingItems(collected);
}
