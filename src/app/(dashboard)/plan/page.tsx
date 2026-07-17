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
import { formatDateISO, getWeekStart, parseDateParam } from "@/lib/dates";
import { canEdit } from "@/modules/households/services/role-checks";
import { addDays, format, parseISO } from "date-fns";
import {
  getRecipesKcalPerServing,
  sumPlannedNutritionByDate,
  calculateNutritionPerEntry,
} from "@/modules/nutrition/services/planned-nutrition";
import { EMPTY_NUTRITION } from "@/lib/nutrition";

interface PlanPageProps {
  searchParams: Promise<{ week?: string; view?: string; day?: string }>;
}

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const { householdId, role } = await requireActiveHouseholdOrRedirect();
  const params = await searchParams;

  const today = formatDateISO(new Date());
  const view = params.view === "week" ? "week" : "day";

  let weekStart = params.week ?? formatDateISO(getWeekStart());
  let selectedDay = params.day ?? today;

  if (params.day && parseDateParam(params.day)) {
    selectedDay = params.day;
    if (!params.week) {
      weekStart = formatDateISO(getWeekStart(parseISO(selectedDay)));
    }
  } else if (!params.day) {
    const weekDays = Array.from({ length: 7 }, (_, i) =>
      format(addDays(parseISO(weekStart), i), "yyyy-MM-dd"),
    );
    selectedDay = weekDays.includes(today) ? today : weekStart;
  }

  const [plan, recipes, ingredientRows, productRows, members] = await Promise.all([
    getMealPlanForWeek(householdId, weekStart),
    listRecipes(householdId),
    listIngredients(householdId),
    listProducts(householdId),
    getHouseholdMembers(householdId),
  ]);

  const entryNutritionSources = plan.entries.map((e) => ({
    id: e.entry.id,
    recipeId: e.entry.recipeId,
    ingredientId: e.entry.ingredientId,
    productId: e.entry.productId,
    servings: e.entry.servings,
    quantity: e.entry.quantity,
    unit: e.entry.unit,
    date: e.entry.date,
  }));

  const [recipeKcal, dayNutrition, entryNutrition] = await Promise.all([
    getRecipesKcalPerServing(
      householdId,
      recipes.map((recipe) => recipe.id),
    ),
    sumPlannedNutritionByDate(householdId, entryNutritionSources),
    calculateNutritionPerEntry(householdId, entryNutritionSources),
  ]);

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(weekStart), i), "yyyy-MM-dd"),
  );
  const dayTotals = Object.fromEntries(
    weekDays.map((day) => [
      day,
      {
        kcal: dayNutrition[day]?.kcal ?? 0,
        protein: dayNutrition[day]?.protein ?? 0,
        carbs: dayNutrition[day]?.carbs ?? 0,
        fat: dayNutrition[day]?.fat ?? 0,
        fiber: dayNutrition[day]?.fiber ?? EMPTY_NUTRITION.fiber,
      },
    ]),
  );

  const entries = plan.entries.map((e) => {
    const n = entryNutrition[e.entry.id];
    return {
      id: e.entry.id,
      recipeId: e.entry.recipeId,
      ingredientId: e.entry.ingredientId,
      productId: e.entry.productId,
      itemName: e.itemName,
      sourceType: e.sourceType,
      date: e.entry.date,
      mealType: e.entry.mealType,
      servings: e.entry.servings,
      quantity: e.entry.quantity != null ? Number.parseFloat(String(e.entry.quantity)) : null,
      unit: e.entry.unit,
      notes: e.entry.notes,
      isBatchCooking: e.entry.isBatchCooking,
      kcal: n?.kcal ?? 0,
      protein: n?.protein ?? 0,
      carbs: n?.carbs ?? 0,
      fat: n?.fat ?? 0,
    };
  });

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
      kcal: item.kcalPer100 ? Number.parseFloat(item.kcalPer100) : null,
      kcalLabel: item.kcalPer100
        ? `${Math.round(Number.parseFloat(item.kcalPer100))} / 100${item.nutritionBasis === "per100ml" ? "ml" : "g"}`
        : null,
    })),
    ...productRows.map((item) => ({
      id: item.id,
      name: item.name,
      kind: "product" as const,
      kcal: item.kcalPer100 ? Number.parseFloat(item.kcalPer100) : null,
      kcalLabel: item.kcalPer100
        ? `${Math.round(Number.parseFloat(item.kcalPer100))} / 100${item.nutritionBasis === "per100ml" ? "ml" : "g"}`
        : null,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name, "pl"));

  return (
    <DashboardShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Plan posiłków</h1>
        <MealPlanView
          weekStart={weekStart}
          selectedDay={selectedDay}
          view={view}
          entries={entries}
          assignments={assignments}
          dayTotals={dayTotals}
          recipes={recipes.map((r) => {
            const kcal = recipeKcal.get(r.id) ?? null;
            return {
              id: r.id,
              name: r.name,
              kind: "recipe" as const,
              kcal,
              kcalLabel: kcal != null ? `${Math.round(kcal)} / porcję` : null,
            };
          })}
          ingredients={catalogIngredients}
          members={members.map((m) => ({ userId: m.userId, displayName: m.displayName }))}
          editable={canEdit(role)}
        />
      </div>
    </DashboardShell>
  );
}
