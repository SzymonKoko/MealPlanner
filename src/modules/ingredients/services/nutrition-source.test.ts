import { describe, expect, it } from "vitest";
import {
  markManualNutritionUpdate,
  mergeExternalNutrition,
  type NutritionSourceState,
} from "./nutrition-source";

const imported: NutritionSourceState = {
  nutritionBasis: "per100g",
  kcalPer100: "100",
  proteinPer100: "10",
  carbsPer100: "12",
  fatPer100: "3",
  fiberPer100: "2",
  saltPer100: "0.5",
  dataSource: "open_food_facts",
  externalId: "123",
  importedAt: new Date("2026-01-01"),
  sourceUpdatedAt: new Date("2026-01-01"),
  verifiedByUser: true,
  manuallyModified: true,
};

describe("nutrition source protection", () => {
  it("does not overwrite manually modified nutrition", () => {
    const merged = mergeExternalNutrition(imported, {
      nutritionBasis: "per100g",
      kcalPer100: "999",
      dataSource: "open_food_facts",
      externalId: "123",
    });
    expect(merged).toEqual(imported);
  });

  it("marks an external record as a household override after a manual change", () => {
    const result = markManualNutritionUpdate(imported, {
      ...imported,
      kcalPer100: "110",
    });
    expect(result).toEqual({
      dataSource: "household_override",
      manuallyModified: true,
    });
  });
});
