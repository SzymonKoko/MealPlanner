import { describe, expect, it } from "vitest";
import { recipeSchema } from "./recipe-schemas";

const ingredientId = "11111111-1111-4111-8111-111111111111";

describe("recipe validation", () => {
  it("accepts relative upload URLs", () => {
    const result = recipeSchema.safeParse({
      name: "Owsianka",
      servings: 2,
      imageUrl: "/api/uploads/example.webp",
      ingredients: [
        { ingredientId, quantity: "100", unit: "g", optional: false, sortOrder: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects zero and negative ingredient quantities", () => {
    for (const quantity of ["0", "-10"]) {
      expect(
        recipeSchema.safeParse({
          name: "Owsianka",
          ingredients: [
            { ingredientId, quantity, unit: "g", optional: false, sortOrder: 0 },
          ],
        }).success,
      ).toBe(false);
    }
  });
});
