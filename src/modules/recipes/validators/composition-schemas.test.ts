import { describe, expect, it } from "vitest";
import { composeMealSchema, compositionSchema } from "./composition-schemas";

const ingredientId = "11111111-1111-4111-8111-111111111111";
const optionId = "22222222-2222-4222-8222-222222222222";

describe("compositionSchema", () => {
  it("accepts sections with ingredient variants and quantities", () => {
    const result = compositionSchema.safeParse({
      name: "Bowl",
      sections: [{ name: "Mięso", options: [{ ingredientId, quantity: "150", unit: "g" }] }],
    });
    expect(result.success).toBe(true);
  });

  it("requires at least one option in every section", () => {
    const result = compositionSchema.safeParse({ name: "Bowl", sections: [{ name: "Mięso", options: [] }] });
    expect(result.success).toBe(false);
  });

  it("rejects an option with two sources", () => {
    const result = compositionSchema.safeParse({
      name: "Bowl",
      sections: [{ name: "Mięso", options: [{ ingredientId, productId: optionId, quantity: 100, unit: "g" }] }],
    });
    expect(result.success).toBe(false);
  });
});

describe("composeMealSchema", () => {
  it("validates a configured meal target", () => {
    expect(composeMealSchema.safeParse({
      compositionId: ingredientId,
      optionIds: [optionId],
      date: "2026-07-21",
      mealType: "lunch",
      planScope: "mine",
    }).success).toBe(true);
  });
});
