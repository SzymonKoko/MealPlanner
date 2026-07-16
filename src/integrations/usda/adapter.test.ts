import { describe, expect, it } from "vitest";
import { mapUsdaFoodDetails, mapUsdaSearchResults } from "./adapter";

describe("USDA adapter", () => {
  it("maps search results and distinguishes raw vs cooked items", () => {
    const results = mapUsdaSearchResults([
      {
        fdcId: 1,
        description: "Rice, white, long-grain, regular, raw",
        foodCategory: "Cereal Grains and Pasta",
        dataType: "Foundation",
        foodNutrients: [{ nutrientName: "Energy", value: 365 }],
      },
      {
        fdcId: 2,
        description: "Rice, white, cooked",
        foodCategory: "Cereal Grains and Pasta",
        dataType: "SR Legacy",
      },
    ]);

    expect(results[0]).toMatchObject({
      externalId: "1",
      kcalPer100: "365",
      state: "raw",
    });
    expect(results[1]).toMatchObject({
      externalId: "2",
      state: "cooked",
    });
  });

  it("normalizes nutrient payload and converts sodium to salt", () => {
    const result = mapUsdaFoodDetails({
      fdcId: 10,
      description: "Egg, whole, raw",
      dataType: "Foundation",
      foodCategory: { description: "Dairy and Egg Products" },
      foodNutrients: [
        { nutrient: { name: "Energy" }, amount: 143 },
        { nutrient: { name: "Protein" }, amount: 12.56 },
        { nutrient: { name: "Carbohydrate, by difference" }, amount: 0.72 },
        { nutrient: { name: "Total lipid (fat)" }, amount: 9.51 },
        { nutrient: { name: "Fiber, total dietary" }, amount: 0 },
        { nutrient: { name: "Sodium, Na" }, amount: 142 },
      ],
    });

    expect(result).toMatchObject({
      externalId: "10",
      name: "Egg, whole, raw",
      nutritionBasis: "per100g",
      kcalPer100: "143",
      proteinPer100: "12.56",
      saltPer100: "0.355",
      dataSource: "usda",
    });
  });

  it("returns warnings for incomplete nutrient payloads", () => {
    const result = mapUsdaFoodDetails({
      fdcId: 99,
      description: "Mystery vegetable",
      foodNutrients: [],
    });

    expect(result.warnings).toContain("USDA nie zwróciło pełnych wartości odżywczych");
    expect(result.kcalPer100).toBeNull();
  });
});
