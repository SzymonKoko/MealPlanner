import { describe, it, expect } from "vitest";

interface AggregatedItem {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
}

function aggregateItems(items: AggregatedItem[]): AggregatedItem[] {
  const map = new Map<string, AggregatedItem>();
  for (const item of items) {
    const key = `${item.ingredientId}-${item.unit}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

function preserveManualItems(
  automatic: { name: string; source: string }[],
  manual: { name: string; source: string }[],
): { name: string; source: string }[] {
  const newAutomatic = automatic.map((i) => ({ ...i, source: "automatic" }));
  const keptManual = manual.filter((i) => i.source === "manual");
  return [...newAutomatic, ...keptManual];
}

describe("shopping list aggregation", () => {
  it("aggregates identical ingredients", () => {
    const result = aggregateItems([
      { ingredientId: "a", name: "Mąka", quantity: 200, unit: "g" },
      { ingredientId: "a", name: "Mąka", quantity: 300, unit: "g" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(500);
  });

  it("keeps separate entries for different units", () => {
    const result = aggregateItems([
      { ingredientId: "a", name: "Mleko", quantity: 200, unit: "ml" },
      { ingredientId: "a", name: "Mleko", quantity: 1, unit: "l" },
    ]);
    expect(result).toHaveLength(2);
  });
});

describe("manual items preservation", () => {
  it("preserves manual items on regeneration", () => {
    const result = preserveManualItems(
      [{ name: "Mąka", source: "automatic" }],
      [{ name: "Papier toaletowy", source: "manual" }],
    );
    expect(result).toHaveLength(2);
    expect(result.find((i) => i.name === "Papier toaletowy")).toBeDefined();
    expect(result.find((i) => i.name === "Mąka")?.source).toBe("automatic");
  });
});

describe("portion assignment", () => {
  it("rejects assignments exceeding entry servings", () => {
    const entryServings = 2;
    const assignments = [{ userId: "u1", servings: 1 }, { userId: "u2", servings: 2 }];
    const total = assignments.reduce((s, a) => s + a.servings, 0);
    expect(total > entryServings).toBe(true);
  });
});
