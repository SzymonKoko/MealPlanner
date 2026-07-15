import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireAuth } from "@/server/require-auth";
import { listUserHouseholds } from "@/modules/households/repository/household-repository";
import { getTodayNutritionAction } from "@/modules/nutrition/actions/nutrition-actions";
import { getMealPlanForDate } from "@/modules/meal-planner/repository/meal-plan-repository";
import { requireActiveHousehold } from "@/server/require-household-member";
import { formatDisplayDate, formatDateISO } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { createHousehold } from "@/modules/households/actions/household-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEAL_TYPE_LABELS } from "@/lib/meal-types";

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

  let householdId: string;
  try {
    const ctx = await requireActiveHousehold();
    householdId = ctx.householdId;
  } catch {
    redirect("/more");
  }

  const today = formatDateISO(new Date());
  const [nutrition, meals] = await Promise.all([
    getTodayNutritionAction(today),
    getMealPlanForDate(householdId, today),
  ]);

  const progress = nutrition.progress;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dzisiaj</h1>
          <p className="text-muted-foreground">{formatDisplayDate(new Date())}</p>
        </div>

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
            {meals.length === 0 ? (
              <p className="text-muted-foreground">Brak zaplanowanych posiłków na dziś.</p>
            ) : (
              meals.map(({ entry, recipeName }) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{recipeName}</p>
                    <p className="text-sm text-muted-foreground">
                      {MEAL_TYPE_LABELS[entry.mealType as keyof typeof MEAL_TYPE_LABELS]} · {entry.servings} porcji
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
