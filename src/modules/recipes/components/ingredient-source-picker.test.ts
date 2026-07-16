import { describe, expect, it } from "vitest";
import { matchesSearchQuery, normalizeSearchText } from "./ingredient-source-picker";

describe("ingredient source search", () => {
  it("ignores case and polish diacritics", () => {
    expect(normalizeSearchText("Mąka Pszenna")).toBe("maka pszenna");
    expect(matchesSearchQuery("Pierś z kurczaka", "piers")).toBe(true);
    expect(matchesSearchQuery("Jajko", "JAJ")).toBe(true);
    expect(matchesSearchQuery("Ryż biały", "ryz")).toBe(true);
    expect(matchesSearchQuery("Oliwa", "maslo")).toBe(false);
  });
});
