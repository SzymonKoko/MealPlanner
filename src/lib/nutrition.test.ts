import { describe, it, expect } from "vitest";
import {
  calculateNutritionForQuantity,
  calculateNutritionPerServing,
  sumNutrition,
  perServing,
  parseDecimal,
} from "@/lib/nutrition";
import { addQuantities, convertToBaseUnit, convertWithIngredientConversions } from "@/lib/units";
import { calculateRecipeNutrition, scaleRecipeIngredients } from "@/modules/recipes/services/nutrition-calculator";
import { hasMinimumRole } from "@/modules/households/services/role-checks";

describe("nutrition", () => {
  it("calculates nutrition for 200g ingredient with 100 kcal/100g", () => {
    const result = calculateNutritionForQuantity(
      {
        nutritionBasis: "per100g",
        kcalPer100: "100",
        proteinPer100: "10",
        carbsPer100: "20",
        fatPer100: "5",
        fiberPer100: "2",
        saltPer100: "0.5",
      },
      200,
      "g",
    );
    expect(result.kcal).toBe(200);
    expect(result.protein).toBe(20);
    expect(result.salt).toBe(1);
  });

  it("calculates 250 g of a 120 kcal per 100 g product", () => {
    const result = calculateNutritionForQuantity(
      { nutritionBasis: "per100g", kcalPer100: "120" },
      "250",
      "g",
    );
    expect(result.kcal).toBe(300);
  });

  it("calculates a per100ml product", () => {
    const result = calculateNutritionForQuantity(
      {
        nutritionBasis: "per100ml",
        kcalPer100: "64",
        proteinPer100: "3.2",
        saltPer100: "0.1",
      },
      "250",
      "ml",
    );
    expect(result).toMatchObject({ kcal: 160, protein: 8, salt: 0.25 });
  });

  it("uses density when quantity and nutrition basis use different dimensions", () => {
    const result = calculateNutritionForQuantity(
      {
        nutritionBasis: "per100g",
        kcalPer100: "100",
        densityGramsPerMl: "1.2",
      },
      "100",
      "ml",
    );
    expect(result.kcal).toBe(120);
  });

  it("rejects incompatible units without density instead of returning zero", () => {
    expect(() =>
      calculateNutritionForQuantity(
        { nutritionBasis: "per100g", kcalPer100: "100" },
        "100",
        "ml",
      ),
    ).toThrow(/bez gęstości/);
  });

  it("uses ingredient-specific conversions for pieces", () => {
    const result = calculateNutritionForQuantity(
      {
        nutritionBasis: "per100g",
        kcalPer100: "155",
        unitConversions: [{ unit: "szt", gramsEquivalent: 55 }],
      },
      "2",
      "szt",
    );
    expect(result.kcal).toBe(170.5);
  });

  it("uses package size for product package unit", () => {
    const result = calculateNutritionForQuantity(
      {
        nutritionBasis: "per100g",
        kcalPer100: "250",
        packageQuantity: "400",
        packageUnit: "g",
      },
      "0.5",
      "opakowanie",
    );
    expect(result.kcal).toBe(500);
  });

  it("sums nutrition values", () => {
    const total = sumNutrition([
      { kcal: 100, protein: 10, carbs: 20, fat: 5, fiber: 2, salt: 0.1 },
      { kcal: 50, protein: 5, carbs: 10, fat: 2, fiber: 1, salt: 0.2 },
    ]);
    expect(total.kcal).toBe(150);
    expect(total.salt).toBe(0.3);
  });

  it("calculates per serving", () => {
    const per = perServing(
      { kcal: 400, protein: 40, carbs: 80, fat: 20, fiber: 8, salt: 2 },
      4,
    );
    expect(per.kcal).toBe(100);
    expect(calculateNutritionPerServing(per, 3).kcal).toBe(33.3333);
  });

  it("parses decimals safely", () => {
    expect(parseDecimal("12.5")).toBe(12.5);
    expect(parseDecimal(null)).toBe(0);
    expect(parseDecimal("invalid")).toBe(0);
  });
});

describe("units", () => {
  it("converts kg to g", () => {
    expect(convertToBaseUnit(1, "kg", "g")).toBe(1000);
  });

  it("adds quantities with same unit", () => {
    expect(addQuantities({ quantity: 100, unit: "g" }, { quantity: 50, unit: "g" })).toEqual({
      quantity: 150,
      unit: "g",
    });
  });

  it("converts volume to mass when density is known", () => {
    expect(convertToBaseUnit(100, "ml", "g", 1.2)).toBe(120);
    expect(convertToBaseUnit(100, "ml", "g")).toBeNull();
  });

  it("does not use a global tablespoon conversion", () => {
    expect(convertWithIngredientConversions(1, "lyzka", "g")).toBeNull();
  });

  it("converts tablespoon only when ingredient-specific mapping exists", () => {
    expect(
      convertWithIngredientConversions(2, "lyzka", "g", null, [
        { unit: "lyzka", gramsEquivalent: 10 },
      ]),
    ).toBe(20);
  });
});

describe("recipe nutrition calculator", () => {
  it("calculates recipe nutrition from ingredients", () => {
    const result = calculateRecipeNutrition(
      [
        {
          quantity: "200",
          unit: "g",
          optional: false,
          nutritionBasis: "per100g",
          kcalPer100: "100",
          proteinPer100: "10",
          carbsPer100: "20",
          fatPer100: "5",
          fiberPer100: "2",
          saltPer100: "0.5",
        },
      ],
      2,
    );
    expect(result.total.kcal).toBe(200);
    expect(result.perServing.kcal).toBe(100);
    expect(result.total.salt).toBe(1);
  });

  it("calculates recipe nutrition with mixed recipe units", () => {
    const result = calculateRecipeNutrition(
      [
        {
          quantity: "2",
          unit: "szt",
          optional: false,
          nutritionBasis: "per100g",
          kcalPer100: "155",
          unitConversions: [{ unit: "szt", gramsEquivalent: 55 }],
        },
        {
          quantity: "3",
          unit: "lyzka",
          optional: false,
          nutritionBasis: "per100g",
          kcalPer100: "884",
          unitConversions: [{ unit: "lyzka", gramsEquivalent: 10 }],
        },
      ],
      2,
    );
    expect(result.total.kcal).toBe(435.7);
    expect(result.perServing.kcal).toBe(217.85);
  });

  it("scales recipe ingredients", () => {
    const scaled = scaleRecipeIngredients(
      [{ quantity: "100", unit: "g" }],
      2,
      4,
    );
    expect(scaled[0].quantity).toBe("200");
  });
});

describe("role checks", () => {
  it("owner has member permissions", () => {
    expect(hasMinimumRole("owner", "member")).toBe(true);
  });

  it("viewer cannot edit", () => {
    expect(hasMinimumRole("viewer", "member")).toBe(false);
  });
});
