import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHouseholdEditorOrRedirect } from "@/server/require-household-member";
import {
  listIngredients,
  listProducts,
  listTags,
  getIngredientUnitConversions,
} from "@/modules/ingredients/repository/ingredient-repository";
import { RecipeForm } from "@/modules/recipes/components/recipe-form";

export default async function NewRecipePage() {
  const { householdId } = await requireActiveHouseholdEditorOrRedirect();
  const [ingredients, products, tags] = await Promise.all([
    listIngredients(householdId),
    listProducts(householdId),
    listTags(householdId, "recipe"),
  ]);
  const ingredientConversions = await getIngredientUnitConversions(ingredients.map((ingredient) => ingredient.id));
  const conversionsByIngredient = new Map<string, typeof ingredientConversions>();
  for (const conversion of ingredientConversions) {
    const current = conversionsByIngredient.get(conversion.ingredientId) ?? [];
    current.push(conversion);
    conversionsByIngredient.set(conversion.ingredientId, current);
  }

  return (
    <DashboardShell>
      <RecipeForm
        sources={[
          ...ingredients.map((item) => ({
            id: item.id,
            name: item.name,
            type: "ingredient" as const,
            nutritionBasis: item.nutritionBasis,
            kcalPer100: item.kcalPer100,
            proteinPer100: item.proteinPer100,
            carbsPer100: item.carbsPer100,
            fatPer100: item.fatPer100,
            fiberPer100: item.fiberPer100,
            saltPer100: item.saltPer100,
            densityGramsPerMl: item.densityGramsPerMl,
            unitConversions: conversionsByIngredient.get(item.id) ?? [],
          })),
          ...products.map((item) => ({
            id: item.id,
            name: item.name,
            type: "product" as const,
            nutritionBasis: item.nutritionBasis,
            kcalPer100: item.kcalPer100,
            proteinPer100: item.proteinPer100,
            carbsPer100: item.carbsPer100,
            fatPer100: item.fatPer100,
            fiberPer100: item.fiberPer100,
            saltPer100: item.saltPer100,
            densityGramsPerMl:
              ingredients.find((ingredient) => ingredient.id === item.ingredientId)
                ?.densityGramsPerMl ?? null,
            unitConversions: item.ingredientId
              ? conversionsByIngredient.get(item.ingredientId) ?? []
              : [],
            packageQuantity: item.packageQuantity,
            packageUnit: item.packageUnit,
          })),
        ]}
        tags={tags.map((tag) => ({ id: tag.id, name: tag.name }))}
      />
    </DashboardShell>
  );
}
