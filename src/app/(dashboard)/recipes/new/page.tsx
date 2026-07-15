import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHousehold } from "@/server/require-household-member";
import { listIngredients } from "@/modules/ingredients/repository/ingredient-repository";
import { RecipeForm } from "@/modules/recipes/components/recipe-form";

export default async function NewRecipePage() {
  const { householdId } = await requireActiveHousehold();
  const ingredients = await listIngredients(householdId);

  return (
    <DashboardShell>
      <RecipeForm ingredients={ingredients.map((i) => ({ id: i.id, name: i.name }))} />
    </DashboardShell>
  );
}
