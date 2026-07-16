import { beforeEach, describe, expect, it, vi } from "vitest";
import { lookupBarcodeProduct } from "./barcode-import";

const state = vi.hoisted(() => ({
  localProduct: null as null | {
    id: string;
    barcode: string;
    name: string;
    brand: string | null;
    packageQuantity: string | null;
    packageUnit: string | null;
    nutritionBasis: "per100g" | "per100ml";
    kcalPer100: string | null;
    proteinPer100: string | null;
    carbsPer100: string | null;
    fatPer100: string | null;
    fiberPer100: string | null;
    saltPer100: string | null;
    imageUrl: string | null;
    dataSource: string;
    externalId: string | null;
    importedAt: string | null;
    sourceUpdatedAt: string | null;
    verifiedByUser: boolean;
    manuallyModified: boolean;
    ingredientId: string | null;
  },
  fetchCalls: 0,
  nextError: null as null | Error,
}));

const { MockOpenFoodFactsError } = vi.hoisted(() => ({
  MockOpenFoodFactsError: class MockOpenFoodFactsError extends Error {
    constructor(
      message: string,
      public code: "TIMEOUT" | "NOT_FOUND" | "RATE_LIMIT" | "BAD_RESPONSE" | "API_ERROR",
    ) {
      super(message);
    }
  },
}));

vi.mock("../repository/ingredient-repository", () => ({
  getProductByBarcode: vi.fn(async () => state.localProduct),
}));

vi.mock("@/integrations/open-food-facts", () => ({
  OpenFoodFactsError: MockOpenFoodFactsError,
  fetchOpenFoodFactsProduct: vi.fn(async () => {
    if (state.nextError) {
      const error = state.nextError;
      state.nextError = null;
      throw error;
    }
    state.fetchCalls += 1;
    return {
      barcode: "5901234123457",
      name: "Skyr",
      brand: "Piatnica",
      packageQuantity: "150",
      packageUnit: "g",
      servingSize: null,
      imageUrl: null,
      nutritionBasis: "per100g" as const,
      kcalPer100: "100",
      proteinPer100: "10",
      carbsPer100: "12",
      fatPer100: "2",
      fiberPer100: "0",
      saltPer100: "0.1",
      dataSource: "open_food_facts" as const,
      externalId: "5901234123457",
      sourceUpdatedAt: null,
      warnings: [],
    };
  }),
}));

beforeEach(() => {
  state.localProduct = null;
  state.fetchCalls = 0;
  state.nextError = null;
});

describe("barcode import lookup", () => {
  it("returns local product and skips Open Food Facts on cache hit", async () => {
    state.localProduct = {
      id: "product-1",
      barcode: "5901234123457",
      name: "Lokalny skyr",
      brand: "Piatnica",
      packageQuantity: "150",
      packageUnit: "g",
      nutritionBasis: "per100g",
      kcalPer100: "99",
      proteinPer100: "10",
      carbsPer100: "12",
      fatPer100: "2",
      fiberPer100: "0",
      saltPer100: "0.1",
      imageUrl: null,
      dataSource: "household_override",
      externalId: "5901234123457",
      importedAt: null,
      sourceUpdatedAt: null,
      verifiedByUser: true,
      manuallyModified: true,
      ingredientId: null,
    };

    const result = await lookupBarcodeProduct("household-1", "5901234123457");
    expect(result.status).toBe("local");
    expect(result.product?.name).toBe("Lokalny skyr");
    expect(state.fetchCalls).toBe(0);
  });

  it("fetches a missing product from Open Food Facts", async () => {
    const result = await lookupBarcodeProduct("household-1", "5901234123457");
    expect(result.status).toBe("external");
    expect(result.candidate?.externalId).toBe("5901234123457");
    expect(state.fetchCalls).toBe(1);
  });

  it("returns not_found when OFF cannot find a product", async () => {
    state.nextError = new MockOpenFoodFactsError("not found", "NOT_FOUND");

    const result = await lookupBarcodeProduct("household-1", "5901234123457");
    expect(result).toEqual({ status: "not_found" });
  });

  it("bubbles timeout errors when the source is unavailable", async () => {
    state.nextError = new MockOpenFoodFactsError("timeout", "TIMEOUT");

    await expect(lookupBarcodeProduct("household-1", "5901234123457")).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });

  it("shows field diffs during manual refresh of an existing product", async () => {
    state.localProduct = {
      id: "product-1",
      barcode: "5901234123457",
      name: "Lokalny skyr",
      brand: "Marka A",
      packageQuantity: "150",
      packageUnit: "g",
      nutritionBasis: "per100g",
      kcalPer100: "99",
      proteinPer100: "10",
      carbsPer100: "12",
      fatPer100: "2",
      fiberPer100: "0",
      saltPer100: "0.1",
      imageUrl: null,
      dataSource: "open_food_facts",
      externalId: "5901234123457",
      importedAt: null,
      sourceUpdatedAt: null,
      verifiedByUser: false,
      manuallyModified: false,
      ingredientId: null,
    };

    const result = await lookupBarcodeProduct("household-1", "5901234123457", true);
    expect(result.status).toBe("external");
    expect(result.diffs).toContain("name");
    expect(state.fetchCalls).toBe(1);
  });
});
