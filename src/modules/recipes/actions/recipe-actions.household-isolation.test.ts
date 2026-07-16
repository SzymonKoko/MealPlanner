import { describe, expect, it, vi } from "vitest";
import { getRecipeNutritionAction } from "./recipe-actions";

vi.mock("@/server/require-household-member", () => ({
  requireActiveHousehold: vi.fn(async () => ({
    householdId: "household-1",
    role: "owner",
    user: {
      id: "user-1",
      authProviderId: "p-1",
      email: "user@example.com",
      displayName: "User",
      avatarUrl: null,
      activeHouseholdId: "household-1",
    },
  })),
}));

vi.mock("../repository/recipe-repository", () => ({
  getRecipeWithIngredients: vi.fn(async () => ({
    recipe: { id: "recipe-1", servings: 2 },
    ingredients: [
      {
        ingredientId: "ingredient-foreign",
        productId: null,
        quantity: "100",
        unit: "g",
        optional: false,
      },
    ],
  })),
}));

vi.mock("@/modules/ingredients/repository/ingredient-repository", () => ({
  getIngredient: vi.fn(async () => null),
}));

describe("household isolation - recipe nutrition", () => {
  it("rejects nutrition when ingredient id belongs to another household", async () => {
    await expect(getRecipeNutritionAction("recipe-1")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});

