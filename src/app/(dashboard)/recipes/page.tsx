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

interface RecipesPageProps {
  searchParams: Promise<{ q?: string; tag?: string }>;
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const { householdId, role } = await requireActiveHouseholdOrRedirect();
  const { q = "", tag = "" } = await searchParams;
  const search = q.trim();
  const [listedRecipes, tags] = await Promise.all([
    listRecipes(householdId, search || undefined),
    listTags(householdId, "recipe"),
  ]);
  const recipeTags = await getRecipeTagsForRecipes(listedRecipes.map((recipe) => recipe.id));
  const recipes = tag
    ? listedRecipes.filter((recipe) =>
        recipeTags.some((relation) => relation.recipeId === recipe.id && relation.tagId === tag),
      )
    : listedRecipes;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Przepisy</h1>
          {canEdit(role) ? (
            <Button asChild><Link href="/recipes/new">Nowy przepis</Link></Button>
          ) : null}
        </div>

        <form method="get" className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]">
          <Input name="q" defaultValue={search} placeholder="Szukaj przepisów" />
          <select name="tag" defaultValue={tag} className="h-11 rounded-lg border bg-background px-3">
            <option value="">Wszystkie tagi</option>
            {tags.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <Button type="submit" variant="secondary">Szukaj</Button>
        </form>

        {recipes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Brak przepisów. Dodaj pierwszy przepis.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
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
                    <p className="text-sm text-muted-foreground">{recipe.servings} porcji</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
