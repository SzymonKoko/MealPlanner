import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUsdaFoodDetails, searchUsdaFoods } from "./client";

describe("USDA client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.USDA_API_KEY = "test-key";
  });

  it("searches USDA with local polish mapping", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          foods: [{ fdcId: 1, description: "Chicken breast, raw", dataType: "Foundation" }],
        }),
        { status: 200 },
      ),
    );

    const result = await searchUsdaFoods("pierś z kurczaka");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/foods/search?api_key=test-key"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: "chicken breast", pageSize: 8 }),
      }),
    );
    expect(result.translatedQuery).toBe("chicken breast");
    expect(result.results[0]?.externalId).toBe("1");
  });

  it("returns empty results without throwing when USDA finds nothing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ foods: [] }), { status: 200 }),
    );

    const result = await searchUsdaFoods("unknown");
    expect(result.results).toEqual([]);
  });

  it("throws config error for invalid USDA key", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "bad key" }), { status: 401 }),
    );

    await expect(searchUsdaFoods("egg")).rejects.toMatchObject({
      code: "CONFIG",
    });
  });

  it("throws timeout error when USDA request aborts", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(Object.assign(new Error("Aborted"), { name: "AbortError" }));

    await expect(getUsdaFoodDetails(10)).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });
});
