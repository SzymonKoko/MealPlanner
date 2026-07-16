import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  ingredientExists: true,
  existingProduct: null as null | {
    id: string;
    importedAt: Date | null;
    dataSource: "manual" | "open_food_facts" | "household_override";
    manuallyModified: boolean;
    nutritionBasis: "per100g" | "per100ml";
    kcalPer100?: string | null;
    proteinPer100?: string | null;
    carbsPer100?: string | null;
    fatPer100?: string | null;
    fiberPer100?: string | null;
    saltPer100?: string | null;
  },
  createdPayloads: [] as unknown[],
  updatedPayloads: [] as unknown[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/require-household-member", () => ({
  requireActiveHouseholdEditor: vi.fn(async () => ({
    householdId: "household-1",
    role: "owner",
    user: { id: "user-1" },
  })),
}));

vi.mock("../repository/ingredient-repository", () => ({
  getIngredient: vi.fn(async () => (state.ingredientExists ? { id: "ingredient-1" } : null)),
  getProduct: vi.fn(async () => state.existingProduct),
  createProduct: vi.fn(async (_householdId: string, payload: unknown) => {
    state.createdPayloads.push(payload);
    return { id: "product-1" };
  }),
  updateProduct: vi.fn(async (_householdId: string, _id: string, payload: unknown) => {
    state.updatedPayloads.push(payload);
    return { id: "product-1" };
  }),
}));

import { approveImportedProductAction } from "./barcode-actions";

beforeEach(() => {
  state.ingredientExists = true;
  state.existingProduct = null;
  state.createdPayloads = [];
  state.updatedPayloads = [];
});

describe("approve imported product action", () => {
  it("saves an imported product only after explicit approval", async () => {
    const form = new FormData();
    form.set("barcode", "5901234123457");
    form.set("name", "Skyr");
    form.set("brand", "Piatnica");
    form.set("packageQuantity", "150");
    form.set("packageUnit", "g");
    form.set("nutritionBasis", "per100g");
    form.set("kcalPer100", "100");
    form.set("dataSource", "open_food_facts");
    form.set("externalId", "5901234123457");
    form.set("originalNutritionBasis", "per100g");
    form.set("originalKcalPer100", "100");

    await approveImportedProductAction(form);

    expect(state.createdPayloads).toHaveLength(1);
    expect(state.createdPayloads[0]).toMatchObject({
      barcode: "5901234123457",
      name: "Skyr",
      dataSource: "open_food_facts",
      externalId: "5901234123457",
      manuallyModified: false,
    });
  });

  it("protects imported product when the user corrects nutrition before first save", async () => {
    const form = new FormData();
    form.set("barcode", "5901234123457");
    form.set("name", "Skyr");
    form.set("nutritionBasis", "per100g");
    form.set("kcalPer100", "110");
    form.set("dataSource", "open_food_facts");
    form.set("externalId", "5901234123457");
    form.set("originalNutritionBasis", "per100g");
    form.set("originalKcalPer100", "100");

    await approveImportedProductAction(form);

    expect(state.createdPayloads.at(-1)).toMatchObject({
      dataSource: "household_override",
      manuallyModified: true,
      kcalPer100: "110",
    });
  });

  it("does not touch another household ingredient relation", async () => {
    state.ingredientExists = false;
    const form = new FormData();
    form.set("barcode", "5901234123457");
    form.set("name", "Skyr");
    form.set("ingredientId", "550e8400-e29b-41d4-a716-446655440000");
    form.set("nutritionBasis", "per100g");

    await expect(approveImportedProductAction(form)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(state.createdPayloads).toHaveLength(0);
  });

  it("keeps manual override protection on refresh", async () => {
    state.existingProduct = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      importedAt: new Date("2026-01-01"),
      dataSource: "open_food_facts",
      manuallyModified: true,
      nutritionBasis: "per100g",
      kcalPer100: "90",
      proteinPer100: "10",
      carbsPer100: "12",
      fatPer100: "2",
      fiberPer100: "0",
      saltPer100: "0.1",
    };

    const form = new FormData();
    form.set("existingProductId", "550e8400-e29b-41d4-a716-446655440000");
    form.set("barcode", "5901234123457");
    form.set("name", "Skyr");
    form.set("nutritionBasis", "per100g");
    form.set("kcalPer100", "90");
    form.set("proteinPer100", "10");
    form.set("carbsPer100", "12");
    form.set("fatPer100", "2");
    form.set("fiberPer100", "0");
    form.set("saltPer100", "0.1");
    form.set("dataSource", "open_food_facts");
    form.set("externalId", "5901234123457");

    await approveImportedProductAction(form);

    expect(state.updatedPayloads).toHaveLength(1);
    expect(state.updatedPayloads[0]).toMatchObject({
      manuallyModified: true,
      dataSource: "open_food_facts",
    });
  });
});
