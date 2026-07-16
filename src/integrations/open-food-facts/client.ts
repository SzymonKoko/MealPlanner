import { openFoodFactsResponseSchema } from "./schemas";
import { mapOpenFoodFactsProduct } from "./adapter";

const OPEN_FOOD_FACTS_TIMEOUT_MS = 8000;
const OPEN_FOOD_FACTS_BASE_URL = "https://world.openfoodfacts.org/api/v2/product";
const USER_AGENT =
  "MealPlanner/1.0 (MealPlanner barcode import; https://github.com/SzymonKoko/MealPlanner)";

export class OpenFoodFactsError extends Error {
  constructor(
    message: string,
    public code:
      | "TIMEOUT"
      | "NOT_FOUND"
      | "RATE_LIMIT"
      | "BAD_RESPONSE"
      | "API_ERROR",
  ) {
    super(message);
    this.name = "OpenFoodFactsError";
  }
}

export async function fetchOpenFoodFactsProduct(barcode: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPEN_FOOD_FACTS_TIMEOUT_MS);

  try {
    const response = await fetch(`${OPEN_FOOD_FACTS_BASE_URL}/${barcode}.json`, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 404) {
      throw new OpenFoodFactsError("Nie znaleziono produktu w Open Food Facts", "NOT_FOUND");
    }
    if (response.status === 429) {
      throw new OpenFoodFactsError("Open Food Facts chwilowo ogranicza liczbę zapytań", "RATE_LIMIT");
    }
    if (!response.ok) {
      throw new OpenFoodFactsError("Open Food Facts zwrócił błąd", "API_ERROR");
    }

    const json = await response.json();
    const parsed = openFoodFactsResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new OpenFoodFactsError("Open Food Facts zwrócił nieznaną strukturę", "BAD_RESPONSE");
    }
    if (parsed.data.status === 0 || !parsed.data.product) {
      throw new OpenFoodFactsError("Nie znaleziono produktu w Open Food Facts", "NOT_FOUND");
    }

    return mapOpenFoodFactsProduct({
      code: parsed.data.code ?? barcode,
      product: parsed.data.product,
    });
  } catch (error) {
    if (error instanceof OpenFoodFactsError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenFoodFactsError("Przekroczono czas oczekiwania na Open Food Facts", "TIMEOUT");
    }
    throw new OpenFoodFactsError("Nie udało się pobrać produktu z Open Food Facts", "API_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}
