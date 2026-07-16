import { describe, expect, it } from "vitest";
import { mapOpenFoodFactsProduct } from "./adapter";

describe("Open Food Facts adapter", () => {
  it("maps a complete per-100g product", () => {
    const result = mapOpenFoodFactsProduct({
      code: "5901234123457",
      product: {
        product_name: "Skyr waniliowy",
        brands: "Piatnica",
        quantity: "150 g",
        image_url: "https://example.com/skyr.jpg",
        last_updated_t: 1700000000,
        nutriments: {
          "energy-kcal_100g": 120,
          proteins_100g: "10",
          carbohydrates_100g: "14.5",
          fat_100g: "1.2",
          fiber_100g: "0",
          salt_100g: "0.12",
        },
      },
    });

    expect(result).toMatchObject({
      barcode: "5901234123457",
      name: "Skyr waniliowy",
      brand: "Piatnica",
      packageQuantity: "150",
      packageUnit: "g",
      nutritionBasis: "per100g",
      kcalPer100: "120",
      proteinPer100: "10",
      carbsPer100: "14.5",
      fatPer100: "1.2",
      fiberPer100: "0",
      saltPer100: "0.12",
      dataSource: "open_food_facts",
      externalId: "5901234123457",
    });
  });

  it("supports partial per-100ml payloads and ignores invalid numeric strings", () => {
    const result = mapOpenFoodFactsProduct({
      code: "5900000000001",
      product: {
        product_name: "",
        quantity: "1 l",
        nutriments: {
          "energy-kcal_100ml": "64",
          proteins_100ml: "3,2",
          carbohydrates_100ml: "bad-value",
          salt_100ml: "0.10",
        },
      },
    });

    expect(result.nutritionBasis).toBe("per100ml");
    expect(result.kcalPer100).toBe("64");
    expect(result.proteinPer100).toBe("3.2");
    expect(result.carbsPer100).toBeNull();
    expect(result.packageUnit).toBe("l");
    expect(result.warnings).toContain("Brak nazwy produktu w Open Food Facts");
  });
});
