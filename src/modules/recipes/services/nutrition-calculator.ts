import {
  calculateNutritionForQuantity,
  perServing,
  sumNutrition,
  type NutritionValues,
} from "@/lib/nutrition";
import Decimal from "decimal.js";
import type { NutritionBasis } from "@/db/schema/ingredients";

export interface RecipeIngredientInput {
  quantity: string;
  unit: string;
  optional: boolean;
  kcalPer100?: string | null;
  proteinPer100?: string | null;
  carbsPer100?: string | null;
  fatPer100?: string | null;
  fiberPer100?: string | null;
  saltPer100?: string | null;
  nutritionBasis: NutritionBasis;
  densityGramsPerMl?: string | null;
}

export function calculateRecipeNutrition(
  ingredients: RecipeIngredientInput[],
  servings: number,
): { total: NutritionValues; perServing: NutritionValues } {
  const nonOptional = ingredients.filter((i) => !i.optional);

  const totals = sumNutrition(
    nonOptional.map((ingredient) =>
      calculateNutritionForQuantity(
        ingredient,
        ingredient.quantity,
        ingredient.unit,
      ),
    ),
  );

  return { total: totals, perServing: perServing(totals, servings) };
}

export function scaleRecipeIngredients(
  ingredients: { quantity: string; unit: string }[],
  fromServings: number,
  toServings: number,
) {
  if (fromServings <= 0) return ingredients;
  const factor = new Decimal(toServings).div(fromServings);
  return ingredients.map((i) => ({
    ...i,
    quantity: new Decimal(i.quantity)
      .mul(factor)
      .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
      .toString(),
  }));
}
