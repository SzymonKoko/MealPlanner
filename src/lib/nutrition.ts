import { convertToBaseUnit } from "./units";
import Decimal from "decimal.js";
import type { NutritionBasis } from "@/db/schema/ingredients";

export interface NutritionValues {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  salt: number;
}

export interface NutritionPer100 {
  kcalPer100?: string | null;
  proteinPer100?: string | null;
  carbsPer100?: string | null;
  fatPer100?: string | null;
  fiberPer100?: string | null;
  saltPer100?: string | null;
  nutritionBasis: NutritionBasis;
  densityGramsPerMl?: string | null;
}

export const EMPTY_NUTRITION: NutritionValues = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  salt: 0,
};

const DOMAIN_SCALE = 4;

function rounded(value: Decimal.Value): number {
  return new Decimal(value).toDecimalPlaces(DOMAIN_SCALE, Decimal.ROUND_HALF_UP).toNumber();
}

export function parseDecimal(value?: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateNutritionForQuantity(
  nutrition: NutritionPer100,
  quantity: number | string,
  unit: string,
): NutritionValues {
  const basisUnit = nutrition.nutritionBasis === "per100ml" ? "ml" : "g";
  const baseQuantity = convertToBaseUnit(
    new Decimal(quantity || 0).toNumber(),
    unit,
    basisUnit,
    parseDecimal(nutrition.densityGramsPerMl),
  );
  if (baseQuantity === null) {
    throw new Error(`Nie można przeliczyć jednostki ${unit} na ${basisUnit} bez gęstości`);
  }

  const factor = new Decimal(baseQuantity).div(100);

  return {
    kcal: rounded(new Decimal(parseDecimal(nutrition.kcalPer100)).mul(factor)),
    protein: rounded(new Decimal(parseDecimal(nutrition.proteinPer100)).mul(factor)),
    carbs: rounded(new Decimal(parseDecimal(nutrition.carbsPer100)).mul(factor)),
    fat: rounded(new Decimal(parseDecimal(nutrition.fatPer100)).mul(factor)),
    fiber: rounded(new Decimal(parseDecimal(nutrition.fiberPer100)).mul(factor)),
    salt: rounded(new Decimal(parseDecimal(nutrition.saltPer100)).mul(factor)),
  };
}

export function sumNutrition(values: NutritionValues[]): NutritionValues {
  const sum = (key: keyof NutritionValues) =>
    rounded(values.reduce((total, value) => total.plus(value[key]), new Decimal(0)));
  return {
    kcal: sum("kcal"),
    protein: sum("protein"),
    carbs: sum("carbs"),
    fat: sum("fat"),
    fiber: sum("fiber"),
    salt: sum("salt"),
  };
}

export function scaleNutrition(nutrition: NutritionValues, factor: number): NutritionValues {
  return {
    kcal: rounded(new Decimal(nutrition.kcal).mul(factor)),
    protein: rounded(new Decimal(nutrition.protein).mul(factor)),
    carbs: rounded(new Decimal(nutrition.carbs).mul(factor)),
    fat: rounded(new Decimal(nutrition.fat).mul(factor)),
    fiber: rounded(new Decimal(nutrition.fiber).mul(factor)),
    salt: rounded(new Decimal(nutrition.salt).mul(factor)),
  };
}

export function calculateNutritionPerServing(
  total: NutritionValues,
  servings: number,
): NutritionValues {
  if (servings <= 0) return { ...EMPTY_NUTRITION };
  const divisor = new Decimal(servings);
  return {
    kcal: rounded(new Decimal(total.kcal).div(divisor)),
    protein: rounded(new Decimal(total.protein).div(divisor)),
    carbs: rounded(new Decimal(total.carbs).div(divisor)),
    fat: rounded(new Decimal(total.fat).div(divisor)),
    fiber: rounded(new Decimal(total.fiber).div(divisor)),
    salt: rounded(new Decimal(total.salt).div(divisor)),
  };
}

export const perServing = calculateNutritionPerServing;
