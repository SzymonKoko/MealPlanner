import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHousehold } from "@/server/require-household-member";
import { getRecipeWithIngredients } from "@/modules/recipes/repository/recipe-repository";
import { getRecipeNutritionAction } from "@/modules/recipes/actions/recipe-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface RecipeDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const { householdId } = await requireActiveHousehold();
  const { id } = await params;

  const [data, nutrition] = await Promise.all([
    getRecipeWithIngredients(householdId, id),
    getRecipeNutritionAction(id),
  ]);

  if (!data) notFound();

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{data.recipe.name}</h1>
          <Button variant="outline" asChild>
            <Link href="/recipes">Powrót</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informacje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Porcje: {data.recipe.servings}</p>
              {data.recipe.prepTimeMinutes ? <p>Przygotowanie: {data.recipe.prepTimeMinutes} min</p> : null}
              {data.recipe.cookTimeMinutes ? <p>Gotowanie: {data.recipe.cookTimeMinutes} min</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Makro na porcję</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Kalorie: {Math.round(nutrition.perServing.kcal)} kcal</p>
              <p>Białko: {Math.round(nutrition.perServing.protein)} g</p>
              <p>Węglowodany: {Math.round(nutrition.perServing.carbs)} g</p>
              <p>Tłuszcze: {Math.round(nutrition.perServing.fat)} g</p>
              <p>Błonnik: {Math.round(nutrition.perServing.fiber)} g</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Składniki</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.ingredients.map((ri) => (
                <li key={ri.id} className="text-sm">
                  {ri.quantity} {ri.unit}{" "}
                  {"name" in (ri.source ?? {})
                    ? (ri.source as { name: string }).name
                    : "Składnik"}
                  {ri.optional ? " (opcjonalny)" : ""}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {data.recipe.instructions ? (
          <Card>
            <CardHeader>
              <CardTitle>Instrukcja</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{data.recipe.instructions}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardShell>
  );
}
