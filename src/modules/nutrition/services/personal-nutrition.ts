import { scaleNutrition, type NutritionValues } from "@/lib/nutrition";

export function calculatePersonalEntryNutrition(input: {
  nutrition: NutritionValues;
  servings: number;
  quantity: number | null;
  share: number;
}) {
  return {
    nutrition: scaleNutrition(input.nutrition, input.share),
    servings: input.servings * input.share,
    quantity: input.quantity == null ? null : input.quantity * input.share,
  };
}
