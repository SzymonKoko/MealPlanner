import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHouseholdEditorOrRedirect } from "@/server/require-household-member";
import { listCategories, listTags } from "@/modules/ingredients/repository/ingredient-repository";
import { UsdaIngredientImportFlow } from "@/modules/ingredients/components/usda-ingredient-import-flow";

interface IngredientUsdaPageProps {
  searchParams: Promise<{ query?: string }>;
}

export default async function IngredientUsdaPage({ searchParams }: IngredientUsdaPageProps) {
  const { householdId } = await requireActiveHouseholdEditorOrRedirect();
  const { query = "" } = await searchParams;
  const [categories, tags] = await Promise.all([
    listCategories(householdId),
    listTags(householdId, "ingredient"),
  ]);

  return (
    <DashboardShell>
      <UsdaIngredientImportFlow
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        tags={tags.map((tag) => ({ id: tag.id, name: tag.name }))}
        initialQuery={query}
      />
    </DashboardShell>
  );
}
