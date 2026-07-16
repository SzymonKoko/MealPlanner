import { describe, expect, it } from "vitest";
import {
  generateShoppingListSchema,
  manualItemSchema,
} from "./shopping-schemas";

describe("shopping schemas", () => {
  it("rejects an inverted generation range", () => {
    expect(
      generateShoppingListSchema.safeParse({
        name: "Lista",
        dateFrom: "2026-07-20",
        dateTo: "2026-07-10",
      }).success,
    ).toBe(false);
  });

  it("normalizes a positive manual quantity", () => {
    const parsed = manualItemSchema.parse({
      shoppingListId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Mleko",
      quantityToBuy: "1,5",
      unit: "l",
    });
    expect(parsed.quantityToBuy).toBe("1.5");
  });

  it("rejects zero manual quantity", () => {
    expect(
      manualItemSchema.safeParse({
        shoppingListId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Mleko",
        quantityToBuy: "0",
        unit: "l",
      }).success,
    ).toBe(false);
  });
});
