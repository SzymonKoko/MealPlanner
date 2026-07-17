import { describe, expect, it } from "vitest";
import { calculatePersonalEntryNutrition } from "./personal-nutrition";

describe("personal planned nutrition", () => {
  it("scales all macros and either servings or quantity by the user's share", () => {
    expect(calculatePersonalEntryNutrition({
      nutrition: {
        kcal: 1000,
        protein: 80,
        carbs: 120,
        fat: 40,
        fiber: 20,
        salt: 4,
      },
      servings: 4,
      quantity: 600,
      share: 0.35,
    })).toEqual({
      nutrition: {
        kcal: 350,
        protein: 28,
        carbs: 42,
        fat: 14,
        fiber: 7,
        salt: 1.4,
      },
      servings: 1.4,
      quantity: 210,
    });
  });
});
