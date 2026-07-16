import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHouseholdEditorOrRedirect } from "@/server/require-household-member";
import {
  listIngredients,
  listProducts,
  listTags,
} from "@/modules/ingredients/repository/ingredient-repository";
import { RecipeForm } from "@/modules/recipes/components/recipe-form";

export default async function NewRecipePage() {
  const { householdId } = await requireActiveHouseholdEditorOrRedirect();
  const [ingredients, products, tags] = await Promise.all([
    listIngredients(householdId),
    listProducts(householdId),
    listTags(householdId, "recipe"),
  ]);

  return (
    <DashboardShell>
      <RecipeForm
        sources={[
          ...ingredients.map((item) => ({
            id: item.id,
            name: item.name,
            type: "ingredient" as const,
            baseUnit: item.baseUnit,
            kcalPer100: item.kcalPer100,
            proteinPer100: item.proteinPer100,
            carbsPer100: item.carbsPer100,
            fatPer100: item.fatPer100,
            fiberPer100: item.fiberPer100,
            densityGramsPerMl: item.densityGramsPerMl,
          })),
          ...products.map((item) => ({
            id: item.id,
            name: item.name,
            type: "product" as const,
            baseUnit: item.packageUnit ?? "g",
            kcalPer100: item.kcalPer100,
            proteinPer100: item.proteinPer100,
            carbsPer100: item.carbsPer100,
            fatPer100: item.fatPer100,
            fiberPer100: item.fiberPer100,
          })),
        ]}
        tags={tags.map((tag) => ({ id: tag.id, name: tag.name }))}
      />
    </DashboardShell>
  );
}
