import Link from "next/link";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHousehold } from "@/server/require-household-member";
import { listRecipes } from "@/modules/recipes/repository/recipe-repository";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function RecipesPage() {
  const { householdId } = await requireActiveHousehold();
  const recipes = await listRecipes(householdId);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Przepisy</h1>
          <Button asChild>
            <Link href="/recipes/new">Nowy przepis</Link>
          </Button>
        </div>

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
