import Link from "next/link";
import { sanitizePlanReturnTo } from "@/lib/return-to";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { Button } from "@/components/ui/button";
import { requireActiveHouseholdEditorOrRedirect } from "@/server/require-household-member";
import { listCategories, listTags } from "@/modules/ingredients/repository/ingredient-repository";
import { UsdaIngredientImportFlow } from "@/modules/ingredients/components/usda-ingredient-import-flow";

interface IngredientUsdaPageProps {
  searchParams: Promise<{ query?: string; return?: string }>;
}

export default async function IngredientUsdaPage({ searchParams }: IngredientUsdaPageProps) {
  const { householdId } = await requireActiveHouseholdEditorOrRedirect();
  const params = await searchParams;
  const query = params.query ?? "";
  const returnTo = sanitizePlanReturnTo(params.return);
  const [categories, tags] = await Promise.all([
    listCategories(householdId),
    listTags(householdId, "ingredient"),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Baza USDA</h1>
          <Button asChild variant="outline">
            <Link href={returnTo ?? "/ingredients"}>
              {returnTo ? "Wróć do planera" : "Wróć do składników"}
            </Link>
          </Button>
        </div>
        <UsdaIngredientImportFlow
          categories={categories.map((category) => ({ id: category.id, name: category.name }))}
          tags={tags.map((tag) => ({ id: tag.id, name: tag.name }))}
          initialQuery={query}
          returnTo={returnTo}
        />
      </div>
    </DashboardShell>
  );
}
