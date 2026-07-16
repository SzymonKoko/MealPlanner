import Link from "next/link";
import Image from "next/image";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHouseholdOrRedirect } from "@/server/require-household-member";
import {
  getRecipeTagsForRecipes,
  listRecipes,
} from "@/modules/recipes/repository/recipe-repository";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canEdit } from "@/modules/households/services/role-checks";
import { listTags } from "@/modules/ingredients/repository/ingredient-repository";
import { getRecipesKcalPerServing } from "@/modules/nutrition/services/planned-nutrition";

interface RecipesPageProps {
  searchParams: Promise<{ q?: string; tag?: string; sort?: string; maxKcal?: string }>;
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const { householdId, role } = await requireActiveHouseholdOrRedirect();
  const { q = "", tag = "", sort = "name", maxKcal = "" } = await searchParams;
  const search = q.trim();
  const maxKcalValue = maxKcal.trim() ? Number.parseFloat(maxKcal) : null;
  const [listedRecipes, tags] = await Promise.all([
    listRecipes(householdId, search || undefined),
    listTags(householdId, "recipe"),
  ]);
  const recipeTags = await getRecipeTagsForRecipes(listedRecipes.map((recipe) => recipe.id));
  let recipes = tag
    ? listedRecipes.filter((recipe) =>
        recipeTags.some((relation) => relation.recipeId === recipe.id && relation.tagId === tag),
      )
    : listedRecipes;

  const recipeKcal = await getRecipesKcalPerServing(
    householdId,
    recipes.map((recipe) => recipe.id),
  );

  if (maxKcalValue != null && Number.isFinite(maxKcalValue)) {
    recipes = recipes.filter((recipe) => {
      const kcal = recipeKcal.get(recipe.id);
      return kcal != null && kcal <= maxKcalValue;
    });
  }

  if (sort === "kcal-asc") {
    recipes = [...recipes].sort(
      (a, b) =>
        (recipeKcal.get(a.id) ?? Number.POSITIVE_INFINITY) -
        (recipeKcal.get(b.id) ?? Number.POSITIVE_INFINITY),
    );
  } else if (sort === "kcal-desc") {
    recipes = [...recipes].sort(
      (a, b) => (recipeKcal.get(b.id) ?? -1) - (recipeKcal.get(a.id) ?? -1),
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Przepisy</h1>
          {canEdit(role) ? (
            <Button asChild><Link href="/recipes/new">Nowy przepis</Link></Button>
          ) : null}
        </div>

        <form method="get" className="grid gap-2 sm:grid-cols-[1fr_10rem_10rem_8rem_auto]">
          <Input name="q" defaultValue={search} placeholder="Szukaj przepisów" />
          <select name="tag" defaultValue={tag} className="h-11 rounded-lg border bg-background px-3">
            <option value="">Wszystkie tagi</option>
            {tags.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select name="sort" defaultValue={sort} className="h-11 rounded-lg border bg-background px-3">
            <option value="name">Sortuj: nazwa</option>
            <option value="kcal-asc">Sortuj: kcal ↑</option>
            <option value="kcal-desc">Sortuj: kcal ↓</option>
          </select>
          <Input name="maxKcal" type="number" min="0" defaultValue={maxKcal} placeholder="Max kcal" />
          <Button type="submit" variant="secondary">Filtruj</Button>
        </form>

        {recipes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Brak przepisów. Dodaj pierwszy przepis.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => {
              const kcal = recipeKcal.get(recipe.id);
              return (
                <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
                  <Card className="transition-colors hover:bg-accent/50">
                    <CardContent className="p-4">
                      {recipe.imageUrl ? (
                        <Image
                          src={recipe.imageUrl}
                          alt=""
                          width={600}
                          height={320}
                          unoptimized
                          className="mb-3 h-36 w-full rounded-lg object-cover"
                        />
                      ) : null}
                      <p className="font-medium">{recipe.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {recipe.servings} porcji
                        {kcal != null ? ` · ${Math.round(kcal)} kcal/porcję` : ""}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
