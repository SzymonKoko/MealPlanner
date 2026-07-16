import { describe, expect, it } from "vitest";
import {
  barcodeSchema,
  ingredientCreateSchema,
  ingredientSchema,
  productCreateSchema,
  productSchema,
} from "./ingredient-schemas";

describe("ingredient and product validation", () => {
  it("rejects negative nutrition values", () => {
    expect(ingredientSchema.safeParse({ name: "Mąka", kcalPer100: "-1" }).success).toBe(false);
    expect(productSchema.safeParse({ name: "Jogurt", proteinPer100: "-2" }).success).toBe(false);
  });

  it("normalizes decimal commas", () => {
    const result = ingredientSchema.parse({
      name: "Mleko",
      nutritionBasis: "per100ml",
      fatPer100: "3,2",
      saltPer100: "0,10",
    });
    expect(result.fatPer100).toBe("3.2");
    expect(result.saltPer100).toBe("0.10");
    expect(result.nutritionBasis).toBe("per100ml");
  });

  it("validates GTIN check digits", () => {
    expect(barcodeSchema.parse("5901234123457")).toBe("5901234123457");
    expect(barcodeSchema.safeParse("5901234123458").success).toBe(false);
    expect(barcodeSchema.safeParse("ABC123").success).toBe(false);
  });

  it("requires a package unit when package quantity is provided", () => {
    expect(
      productCreateSchema.safeParse({ name: "Skyr", packageQuantity: "150" }).success,
    ).toBe(false);
    expect(
      productCreateSchema.safeParse({
        name: "Skyr",
        packageQuantity: "150",
        packageUnit: "g",
      }).success,
    ).toBe(true);
  });

  it("accepts explicit create schemas for both separate entities", () => {
    expect(
      ingredientCreateSchema.safeParse({ name: "Ryż", nutritionBasis: "per100g" }).success,
    ).toBe(true);
    expect(
      productCreateSchema.safeParse({
        name: "Mleko",
        nutritionBasis: "per100ml",
        packageQuantity: "1",
        packageUnit: "l",
      }).success,
    ).toBe(true);
  });
});
