import { describe, expect, it } from "vitest";
import { ingredientSchema, productSchema } from "./ingredient-schemas";

describe("ingredient and product validation", () => {
  it("rejects negative nutrition values", () => {
    expect(ingredientSchema.safeParse({ name: "Mąka", kcalPer100: "-1" }).success).toBe(false);
    expect(productSchema.safeParse({ name: "Jogurt", proteinPer100: "-2" }).success).toBe(false);
  });

  it("normalizes decimal commas", () => {
    const result = ingredientSchema.parse({ name: "Mleko", fatPer100: "3,2" });
    expect(result.fatPer100).toBe("3.2");
  });
});
