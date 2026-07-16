import { mapUsdaFoodDetails, mapUsdaSearchResults } from "./adapter";
import {
  usdaFoodDetailsResponseSchema,
  usdaSearchResponseSchema,
} from "./schemas";
import { translateIngredientQuery } from "./dictionary";

const USDA_API_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const USDA_TIMEOUT_MS = 8000;
const USER_AGENT =
  "MealPlanner/1.0 (MealPlanner ingredient import; https://github.com/SzymonKoko/MealPlanner)";

export class UsdaError extends Error {
  constructor(
    message: string,
    public code: "CONFIG" | "TIMEOUT" | "RATE_LIMIT" | "NOT_FOUND" | "API_ERROR" | "BAD_RESPONSE",
  ) {
    super(message);
    this.name = "UsdaError";
  }
}

function getApiKey() {
  const key = process.env.USDA_API_KEY;
  if (!key) {
    throw new UsdaError("Brak konfiguracji USDA_API_KEY", "CONFIG");
  }
  return key;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), USDA_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new UsdaError("Przekroczono czas oczekiwania na USDA", "TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchUsdaFoods(query: string) {
  const apiKey = getApiKey();
  const translatedQuery = translateIngredientQuery(query);
  const response = await fetchWithTimeout(`${USDA_API_BASE_URL}/foods/search?api_key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    body: JSON.stringify({ query: translatedQuery, pageSize: 8 }),
    headers: { "Content-Type": "application/json" },
  });

  if (response.status === 429) throw new UsdaError("USDA chwilowo ogranicza liczbę zapytań", "RATE_LIMIT");
  if (response.status === 401 || response.status === 403) throw new UsdaError("Nieprawidłowy klucz USDA", "CONFIG");
  if (!response.ok) throw new UsdaError("USDA zwróciło błąd", "API_ERROR");

  const json = await response.json();
  const parsed = usdaSearchResponseSchema.safeParse(json);
  if (!parsed.success) throw new UsdaError("USDA zwróciło nieznaną strukturę wyszukiwania", "BAD_RESPONSE");

  return {
    translatedQuery,
    results: mapUsdaSearchResults(parsed.data.foods ?? []),
  };
}

export async function getUsdaFoodDetails(fdcId: number) {
  const apiKey = getApiKey();
  const response = await fetchWithTimeout(
    `${USDA_API_BASE_URL}/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`,
    { method: "GET" },
  );

  if (response.status === 404) throw new UsdaError("Nie znaleziono składnika w USDA", "NOT_FOUND");
  if (response.status === 429) throw new UsdaError("USDA chwilowo ogranicza liczbę zapytań", "RATE_LIMIT");
  if (response.status === 401 || response.status === 403) throw new UsdaError("Nieprawidłowy klucz USDA", "CONFIG");
  if (!response.ok) throw new UsdaError("USDA zwróciło błąd", "API_ERROR");

  const json = await response.json();
  const parsed = usdaFoodDetailsResponseSchema.safeParse(json);
  if (!parsed.success) throw new UsdaError("USDA zwróciło nieznaną strukturę szczegółów", "BAD_RESPONSE");

  return mapUsdaFoodDetails(parsed.data);
}
