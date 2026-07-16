import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHouseholdOrRedirect } from "@/server/require-household-member";
import { getRecipeWithIngredients } from "@/modules/recipes/repository/recipe-repository";
import {
  deleteRecipeFormAction,
  getRecipeNutritionAction,
} from "@/modules/recipes/actions/recipe-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { canEdit } from "@/modules/households/services/role-checks";
import { ScaledIngredientList } from "@/modules/recipes/components/scaled-ingredient-list";

interface RecipeDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const { householdId, role } = await requireActiveHouseholdOrRedirect();
  const { id } = await params;

  const data = await getRecipeWithIngredients(householdId, id);
  if (!data) notFound();
  const nutrition = await getRecipeNutritionAction(id);
  const editable = canEdit(role);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{data.recipe.name}</h1>
          <div className="flex gap-2">
            {editable ? (
              <>
                <Button variant="outline" asChild>
                  <Link href={`/recipes/${id}/edit`}>Edytuj</Link>
                </Button>
                <form action={deleteRecipeFormAction}>
                  <input type="hidden" name="id" value={id} />
                  <Button type="submit" variant="ghost" className="text-destructive">Usuń</Button>
                </form>
              </>
            ) : null}
            <Button variant="outline" asChild><Link href="/recipes">Powrót</Link></Button>
          </div>
        </div>

        {data.recipe.imageUrl ? (
          <Image
            src={data.recipe.imageUrl}
            alt=""
            width={1200}
            height={600}
            unoptimized
            className="max-h-80 w-full rounded-xl object-cover"
          />
        ) : null}
        {data.recipe.description ? <p className="text-muted-foreground">{data.recipe.description}</p> : null}

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
            <ScaledIngredientList
              baseServings={data.recipe.servings}
              ingredients={data.ingredients.map((item) => ({
                id: item.id,
                name:
                  "name" in (item.source ?? {})
                    ? (item.source as { name: string }).name
                    : "Brakujący składnik",
                quantity: item.quantity,
                unit: item.unit,
                optional: item.optional,
              }))}
            />
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
