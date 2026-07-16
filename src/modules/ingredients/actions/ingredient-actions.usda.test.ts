import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  ingredientExists: true,
  createdPayloads: [] as unknown[],
  conversionPayloads: [] as unknown[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/server/require-household-member", () => ({
  requireActiveHousehold: vi.fn(async () => ({ householdId: "household-1" })),
  requireActiveHouseholdEditor: vi.fn(async () => ({
    householdId: "household-1",
    role: "owner",
    user: { id: "user-1" },
  })),
}));

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ id: "category-1" }]),
        })),
      })),
    })),
  },
}));

vi.mock("../repository/ingredient-repository", () => ({
  listIngredients: vi.fn(),
  getIngredient: vi.fn(async () => (state.ingredientExists ? { id: "ingredient-1" } : null)),
  getProduct: vi.fn(),
  createIngredient: vi.fn(async (_householdId: string, _userId: string, payload: unknown) => {
    state.createdPayloads.push(payload);
    return { id: "ingredient-1" };
  }),
  updateIngredient: vi.fn(),
  softDeleteIngredient: vi.fn(),
  createProduct: vi.fn(),
  createCategory: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  deleteCategory: vi.fn(),
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  updateCategory: vi.fn(),
  updateTag: vi.fn(),
  replaceIngredientUnitConversions: vi.fn(async (_id: string, payload: unknown) => {
    state.conversionPayloads.push(payload);
  }),
}));

import {
  approveUsdaIngredientAction,
  replaceIngredientUnitConversionsAction,
} from "./ingredient-actions";

beforeEach(() => {
  state.ingredientExists = true;
  state.createdPayloads = [];
  state.conversionPayloads = [];
});

describe("USDA ingredient actions", () => {
  it("saves approved USDA ingredient without override when nutrition stays unchanged", async () => {
    const form = new FormData();
    form.set("name", "jajko");
    form.set("originalName", "Egg, whole, raw");
    form.set("externalId", "10");
    form.set("baseUnit", "g");
    form.set("nutritionBasis", "per100g");
    form.set("kcalPer100", "143");
    form.set("proteinPer100", "12.56");
    form.set("carbsPer100", "0.72");
    form.set("fatPer100", "9.51");
    form.set("fiberPer100", "0");
    form.set("saltPer100", "0.355");
    form.set("baselineDescription", "");
    form.set("baselineKcalPer100", "143");
    form.set("baselineProteinPer100", "12.56");
    form.set("baselineCarbsPer100", "0.72");
    form.set("baselineFatPer100", "9.51");
    form.set("baselineFiberPer100", "0");
    form.set("baselineSaltPer100", "0.355");

    await approveUsdaIngredientAction(form);

    expect(state.createdPayloads[0]).toMatchObject({
      externalId: "10",
      dataSource: "usda",
      manuallyModified: false,
      verifiedByUser: true,
    });
  });

  it("marks USDA ingredient as household override when user changes nutrition and adds conversion", async () => {
    const form = new FormData();
    form.set("name", "jajko");
    form.set("originalName", "Egg, whole, raw");
    form.set("externalId", "10");
    form.set("baseUnit", "g");
    form.set("nutritionBasis", "per100g");
    form.set("kcalPer100", "150");
    form.set("baselineDescription", "");
    form.set("baselineKcalPer100", "143");
    form.set("baselineProteinPer100", "");
    form.set("baselineCarbsPer100", "");
    form.set("baselineFatPer100", "");
    form.set("baselineFiberPer100", "");
    form.set("baselineSaltPer100", "");
    form.set("conversionUnit", "szt");
    form.set("conversionGrams", "55");
    form.set("conversionLabel", "średnie jajko");

    await approveUsdaIngredientAction(form);

    expect(state.createdPayloads.at(-1)).toMatchObject({
      dataSource: "household_override",
      manuallyModified: true,
      kcalPer100: "150",
    });
    expect(state.conversionPayloads.at(-1)).toMatchObject([
      { unit: "szt", gramsEquivalent: "55" },
    ]);
  });

  it("blocks conversion changes for ingredient outside household", async () => {
    state.ingredientExists = false;
    const form = new FormData();
    form.set("conversionUnit", "szt");
    form.set("conversionGrams", "55");

    await expect(
      replaceIngredientUnitConversionsAction("550e8400-e29b-41d4-a716-446655440000", form),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
