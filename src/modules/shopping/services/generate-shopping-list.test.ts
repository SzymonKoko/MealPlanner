import { describe, it, expect } from "vitest";
import { aggregateShoppingItems } from "./generate-shopping-list";

const item = {
  ingredientId: "ingredient-a",
  productId: null,
  name: "Mąka",
  categoryId: null,
};

describe("shopping list aggregation", () => {
  it("aggregates identical ingredients", () => {
    const result = aggregateShoppingItems([
      { ...item, quantity: 200, unit: "g" },
      { ...item, quantity: 300, unit: "g" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(500);
  });

  it("normalizes compatible units before aggregation", () => {
    const result = aggregateShoppingItems([
      { ...item, name: "Mleko", quantity: 200, unit: "ml" },
      { ...item, name: "Mleko", quantity: 1, unit: "l" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ quantity: 1200, unit: "ml" });
  });

  it("keeps incompatible units separate", () => {
    const result = aggregateShoppingItems([
      { ...item, quantity: 200, unit: "g" },
      { ...item, quantity: 2, unit: "szt" },
    ]);
    expect(result).toHaveLength(2);
  });
});
