import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHouseholdOrRedirect } from "@/server/require-household-member";
import { getMealPlanForWeek } from "@/modules/meal-planner/repository/meal-plan-repository";
import { listRecipes } from "@/modules/recipes/repository/recipe-repository";
import {
  listIngredients,
  listProducts,
} from "@/modules/ingredients/repository/ingredient-repository";
import { getHouseholdMembers } from "@/modules/households/repository/household-repository";
import { MealPlanView } from "@/modules/meal-planner/components/meal-plan-view";
import { formatDateISO, getWeekStart } from "@/lib/dates";
import { canEdit } from "@/modules/households/services/role-checks";

interface PlanPageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const { householdId, role } = await requireActiveHouseholdOrRedirect();
  const params = await searchParams;
  const weekStart = params.week ?? formatDateISO(getWeekStart());

  const [plan, recipes, ingredientRows, productRows, members] = await Promise.all([
    getMealPlanForWeek(householdId, weekStart),
    listRecipes(householdId),
    listIngredients(householdId),
    listProducts(householdId),
    getHouseholdMembers(householdId),
  ]);

  const entries = plan.entries.map((e) => ({
    id: e.entry.id,
    recipeId: e.entry.recipeId,
    ingredientId: e.entry.ingredientId,
    productId: e.entry.productId,
    itemName: e.itemName,
    sourceType: e.sourceType,
    date: e.entry.date,
    mealType: e.entry.mealType,
    servings: e.entry.servings,
    notes: e.entry.notes,
    status: e.entry.status,
    isBatchCooking: e.entry.isBatchCooking,
  }));

  const assignments = plan.assignments.map((a) => ({
    mealPlanEntryId: a.assignment.mealPlanEntryId,
    userId: a.assignment.userId,
    displayName: a.displayName,
    servings: a.assignment.servings,
  }));

  const catalogIngredients = [
    ...ingredientRows.map((item) => ({
      id: item.id,
      name: item.name,
      kind: "ingredient" as const,
    })),
    ...productRows.map((item) => ({
      id: item.id,
      name: item.name,
      kind: "product" as const,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name, "pl"));

  return (
    <DashboardShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Plan tygodniowy</h1>
        <MealPlanView
          weekStart={weekStart}
          entries={entries}
          assignments={assignments}
          recipes={recipes.map((r) => ({ id: r.id, name: r.name, kind: "recipe" as const }))}
          ingredients={catalogIngredients}
          members={members.map((m) => ({ userId: m.userId, displayName: m.displayName }))}
          editable={canEdit(role)}
        />
      </div>
    </DashboardShell>
  );
}
