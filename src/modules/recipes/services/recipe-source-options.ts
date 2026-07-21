import { getIngredientUnitConversions, listIngredients, listProducts } from "@/modules/ingredients/repository/ingredient-repository";

export async function getRecipeSourceOptions(householdId: string) {
  const [ingredients, products] = await Promise.all([
    listIngredients(householdId),
    listProducts(householdId),
  ]);
  const conversions = await getIngredientUnitConversions(ingredients.map((ingredient) => ingredient.id));
  const byIngredient = new Map<string, typeof conversions>();
  for (const conversion of conversions) {
    const current = byIngredient.get(conversion.ingredientId) ?? [];
    current.push(conversion);
    byIngredient.set(conversion.ingredientId, current);
  }
  return [
    ...ingredients.map((item) => ({
      id: item.id, name: item.name, type: "ingredient" as const,
      nutritionBasis: item.nutritionBasis, kcalPer100: item.kcalPer100,
      proteinPer100: item.proteinPer100, carbsPer100: item.carbsPer100,
      fatPer100: item.fatPer100, fiberPer100: item.fiberPer100, saltPer100: item.saltPer100,
      densityGramsPerMl: item.densityGramsPerMl, unitConversions: byIngredient.get(item.id) ?? [],
    })),
    ...products.map((item) => ({
      id: item.id, name: item.name, type: "product" as const,
      nutritionBasis: item.nutritionBasis, kcalPer100: item.kcalPer100,
      proteinPer100: item.proteinPer100, carbsPer100: item.carbsPer100,
      fatPer100: item.fatPer100, fiberPer100: item.fiberPer100, saltPer100: item.saltPer100,
      densityGramsPerMl: ingredients.find((ingredient) => ingredient.id === item.ingredientId)?.densityGramsPerMl ?? null,
      unitConversions: item.ingredientId ? byIngredient.get(item.ingredientId) ?? [] : [],
      packageQuantity: item.packageQuantity, packageUnit: item.packageUnit,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name, "pl"));
}
