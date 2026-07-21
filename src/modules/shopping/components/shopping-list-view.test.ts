import { describe, expect, it } from "vitest";
import { matchesShoppingQuery } from "../lib/shopping-search";

const item = { name: "Mąka pszenna", categoryName: "Artykuły sypkie", notes: "typ 450" };

describe("shopping list search", () => {
  it("matches product names without requiring Polish diacritics", () => {
    expect(matchesShoppingQuery(item, "maka")).toBe(true);
  });

  it("matches categories and notes", () => {
    expect(matchesShoppingQuery(item, "sypkie")).toBe(true);
    expect(matchesShoppingQuery(item, "450")).toBe(true);
  });

  it("rejects unrelated queries", () => {
    expect(matchesShoppingQuery(item, "mleko")).toBe(false);
  });
});
