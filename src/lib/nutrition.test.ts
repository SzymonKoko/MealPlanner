import { describe, it, expect } from "vitest";
import {
  calculateNutritionForQuantity,
  sumNutrition,
  perServing,
  parseDecimal,
} from "@/lib/nutrition";
import { addQuantities, convertToBaseUnit } from "@/lib/units";
import { calculateRecipeNutrition, scaleRecipeIngredients } from "@/modules/recipes/services/nutrition-calculator";
import { hasMinimumRole } from "@/modules/households/services/role-checks";

describe("nutrition", () => {
  it("calculates nutrition for 200g ingredient with 100 kcal/100g", () => {
    const result = calculateNutritionForQuantity(
      { kcalPer100: "100", proteinPer100: "10", carbsPer100: "20", fatPer100: "5", fiberPer100: "2" },
      200,
      "g",
      "g",
    );
    expect(result.kcal).toBe(200);
    expect(result.protein).toBe(20);
  });

  it("sums nutrition values", () => {
    const total = sumNutrition([
      { kcal: 100, protein: 10, carbs: 20, fat: 5, fiber: 2 },
      { kcal: 50, protein: 5, carbs: 10, fat: 2, fiber: 1 },
    ]);
    expect(total.kcal).toBe(150);
  });

  it("calculates per serving", () => {
    const per = perServing(
      { kcal: 400, protein: 40, carbs: 80, fat: 20, fiber: 8 },
      4,
    );
    expect(per.kcal).toBe(100);
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
});

describe("recipe nutrition calculator", () => {
  it("calculates recipe nutrition from ingredients", () => {
    const result = calculateRecipeNutrition(
      [
        {
          quantity: "200",
          unit: "g",
          optional: false,
          baseUnit: "g",
          kcalPer100: "100",
          proteinPer100: "10",
          carbsPer100: "20",
          fatPer100: "5",
          fiberPer100: "2",
        },
      ],
      2,
    );
    expect(result.total.kcal).toBe(200);
    expect(result.perServing.kcal).toBe(100);
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
