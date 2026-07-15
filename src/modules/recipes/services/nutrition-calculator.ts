import {
  calculateNutritionForQuantity,
  perServing,
  sumNutrition,
  type NutritionValues,
} from "@/lib/nutrition";

export interface RecipeIngredientInput {
  quantity: string;
  unit: string;
  optional: boolean;
  kcalPer100?: string | null;
  proteinPer100?: string | null;
  carbsPer100?: string | null;
  fatPer100?: string | null;
  fiberPer100?: string | null;
  baseUnit: string;
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
        Number.parseFloat(ingredient.quantity),
        ingredient.unit,
        ingredient.baseUnit,
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
  const factor = toServings / fromServings;
  return ingredients.map((i) => ({
    ...i,
    quantity: String(Number.parseFloat(i.quantity) * factor),
  }));
}
