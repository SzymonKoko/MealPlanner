import { convertToBaseUnit } from "./units";

export interface NutritionValues {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface NutritionPer100 {
  kcalPer100?: string | null;
  proteinPer100?: string | null;
  carbsPer100?: string | null;
  fatPer100?: string | null;
  fiberPer100?: string | null;
}

export function parseDecimal(value?: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateNutritionForQuantity(
  nutrition: NutritionPer100,
  quantity: number,
  unit: string,
  baseUnit: string,
): NutritionValues {
  const baseQuantity = convertToBaseUnit(quantity, unit, baseUnit);
  if (baseQuantity === null) {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  }

  const factor = baseQuantity / 100;

  return {
    kcal: parseDecimal(nutrition.kcalPer100) * factor,
    protein: parseDecimal(nutrition.proteinPer100) * factor,
    carbs: parseDecimal(nutrition.carbsPer100) * factor,
    fat: parseDecimal(nutrition.fatPer100) * factor,
    fiber: parseDecimal(nutrition.fiberPer100) * factor,
  };
}

export function sumNutrition(values: NutritionValues[]): NutritionValues {
  return values.reduce(
    (acc, v) => ({
      kcal: acc.kcal + v.kcal,
      protein: acc.protein + v.protein,
      carbs: acc.carbs + v.carbs,
      fat: acc.fat + v.fat,
      fiber: acc.fiber + v.fiber,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

export function scaleNutrition(nutrition: NutritionValues, factor: number): NutritionValues {
  return {
    kcal: nutrition.kcal * factor,
    protein: nutrition.protein * factor,
    carbs: nutrition.carbs * factor,
    fat: nutrition.fat * factor,
    fiber: nutrition.fiber * factor,
  };
}

export function perServing(total: NutritionValues, servings: number): NutritionValues {
  if (servings <= 0) return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  return scaleNutrition(total, 1 / servings);
}
