import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireAuth } from "@/server/require-auth";
import { listUserHouseholds } from "@/modules/households/repository/household-repository";
import { getTodayNutritionAction } from "@/modules/nutrition/actions/nutrition-actions";
import { requireActiveHouseholdOrRedirect } from "@/server/require-household-member";
import { formatDisplayDate, formatDateISO } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createHousehold } from "@/modules/households/actions/household-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEAL_TYPE_LABELS } from "@/lib/meal-types";
import Link from "next/link";
import { listRecipes } from "@/modules/recipes/repository/recipe-repository";
import { addMealPlanEntryAction } from "@/modules/meal-planner/actions/meal-plan-actions";
import { canEdit } from "@/modules/households/services/role-checks";

export default async function TodayPage() {
  const user = await requireAuth();
  const households = await listUserHouseholds(user.id);

  if (households.length === 0) {
    return (
      <DashboardShell>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Utwórz gospodarstwo domowe</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createHousehold} className="space-y-4">
              <Input name="name" placeholder="Nazwa gospodarstwa" required />
              <Button type="submit">Utwórz</Button>
            </form>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const household = await requireActiveHouseholdOrRedirect();

  const today = formatDateISO(new Date());
  const [nutrition, recipes] = await Promise.all([
    getTodayNutritionAction(today),
    listRecipes(household.householdId),
  ]);

  const progress = nutrition.progress;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dzisiaj</h1>
          <p className="text-muted-foreground">{formatDisplayDate(new Date())}</p>
          <div className="mt-3 flex gap-2">
            <Button asChild size="sm"><Link href="/plan">Otwórz planer</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/more">Ustaw cele</Link></Button>
          </div>
        </div>

        {canEdit(household.role) && recipes.length ? (
          <Card>
            <CardHeader><CardTitle>Szybko dodaj posiłek</CardTitle></CardHeader>
            <CardContent>
              <form action={addMealPlanEntryAction} className="grid gap-2 sm:grid-cols-[1fr_12rem_7rem_auto]">
                <select name="recipeId" className="h-11 rounded-lg border bg-background px-3" required>
                  <option value="">Wybierz przepis</option>
                  {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
                </select>
                <select name="mealType" defaultValue="lunch" className="h-11 rounded-lg border bg-background px-3">
                  {Object.entries(MEAL_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <Input name="servings" type="number" min="1" defaultValue="1" aria-label="Liczba porcji" />
                <input type="hidden" name="date" value={today} />
                <Button type="submit">Dodaj</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NutritionCard label="Kalorie" consumed={progress.kcal.consumed} target={progress.kcal.target} unit="kcal" />
          <NutritionCard label="Białko" consumed={progress.protein.consumed} target={progress.protein.target} unit="g" />
          <NutritionCard label="Węglowodany" consumed={progress.carbs.consumed} target={progress.carbs.target} unit="g" />
          <NutritionCard label="Tłuszcze" consumed={progress.fat.consumed} target={progress.fat.target} unit="g" />
          <NutritionCard label="Błonnik" consumed={progress.fiber.consumed} target={progress.fiber.target} unit="g" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Zaplanowane posiłki</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nutrition.meals.length === 0 ? (
              <p className="text-muted-foreground">Nie masz przypisanych porcji na dziś.</p>
            ) : (
              nutrition.meals.map((meal) => (
                <div key={meal.entryId} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{meal.recipeName}</p>
                    <p className="text-sm text-muted-foreground">
                      {MEAL_TYPE_LABELS[meal.mealType as keyof typeof MEAL_TYPE_LABELS]} · Twoje porcje: {meal.servings}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function NutritionCard({
  label,
  consumed,
  target,
  unit,
}: {
  label: string;
  consumed: number;
  target: number;
  unit: string;
}) {
  const percent = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;

  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">
          {Math.round(consumed)} / {target > 0 ? Math.round(target) : "—"} {unit}
        </p>
        {target > 0 ? (
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
