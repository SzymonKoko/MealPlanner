import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHousehold } from "@/server/require-household-member";
import { getMealPlanForWeek } from "@/modules/meal-planner/repository/meal-plan-repository";
import { listRecipes } from "@/modules/recipes/repository/recipe-repository";
import { getHouseholdMembers } from "@/modules/households/repository/household-repository";
import { MealPlanView } from "@/modules/meal-planner/components/meal-plan-view";
import { formatDateISO, getWeekStart } from "@/lib/dates";

interface PlanPageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const { householdId } = await requireActiveHousehold();
  const params = await searchParams;
  const weekStart = params.week ?? formatDateISO(getWeekStart());

  const [plan, recipes, members] = await Promise.all([
    getMealPlanForWeek(householdId, weekStart),
    listRecipes(householdId),
    getHouseholdMembers(householdId),
  ]);

  const entries = plan.entries.map((e) => ({
    id: e.entry.id,
    recipeId: e.entry.recipeId,
    recipeName: e.recipeName,
    date: e.entry.date,
    mealType: e.entry.mealType,
    servings: e.entry.servings,
  }));

  const assignments = plan.assignments.map((a) => ({
    mealPlanEntryId: a.assignment.mealPlanEntryId,
    userId: a.assignment.userId,
    displayName: a.displayName,
    servings: a.assignment.servings,
  }));

  return (
    <DashboardShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Plan tygodniowy</h1>
        <MealPlanView
          weekStart={weekStart}
          entries={entries}
          assignments={assignments}
          recipes={recipes.map((r) => ({ id: r.id, name: r.name }))}
          members={members.map((m) => ({ userId: m.userId, displayName: m.displayName }))}
        />
      </div>
    </DashboardShell>
  );
}
