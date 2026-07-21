import { DashboardShell } from "@/components/shared/dashboard-shell";
import { requireActiveHouseholdOrRedirect } from "@/server/require-household-member";
import { getMealPlanForWeek } from "@/modules/meal-planner/repository/meal-plan-repository";
import { getComposition, listRecipes } from "@/modules/recipes/repository/recipe-repository";
import { getRecipeSourceOptions } from "@/modules/recipes/services/recipe-source-options";
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
  calculateNutritionPerEntry,
} from "@/modules/nutrition/services/planned-nutrition";
import { mealTypeEnum } from "@/lib/meal-types";
import type { MealType } from "@/db/schema/meal-planner";
import { EMPTY_NUTRITION } from "@/lib/nutrition";

interface PlanPageProps {
  searchParams: Promise<{ week?: string; view?: string; day?: string; pick?: string; scope?: string }>;
}

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const { householdId, role, user } = await requireActiveHouseholdOrRedirect();
  const params = await searchParams;
  const scope = params.scope === "household" ? "household" : "mine";

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

  const shareByEntryId = new Map(
    plan.assignments
      .filter((row) => row.assignment.userId === user.id)
      .map((row) => [row.assignment.mealPlanEntryId, Number.parseFloat(row.assignment.share)]),
  );
  const visiblePlanEntries = scope === "mine"
    ? plan.entries.filter((row) => shareByEntryId.has(row.entry.id))
    : plan.entries;

  const entryNutritionSources = visiblePlanEntries.map((e) => ({
    id: e.entry.id,
    recipeId: e.entry.recipeId,
    ingredientId: e.entry.ingredientId,
    productId: e.entry.productId,
    servings: e.entry.servings,
    quantity: e.entry.quantity,
    unit: e.entry.unit,
    date: e.entry.date,
  }));

  const [recipeKcal, entryNutrition] = await Promise.all([
    getRecipesKcalPerServing(
      householdId,
      recipes.map((recipe) => recipe.id),
    ),
    calculateNutritionPerEntry(householdId, entryNutritionSources),
  ]);
  const [compositionRows, compositionSources] = await Promise.all([
    Promise.all(recipes.filter((recipe) => recipe.kind === "composition").map((recipe) => getComposition(householdId, recipe.id))),
    getRecipeSourceOptions(householdId),
  ]);

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(weekStart), i), "yyyy-MM-dd"),
  );
  const personalDayNutrition = Object.fromEntries(weekDays.map((day) => {
    const totals = visiblePlanEntries.filter((row) => row.entry.date === day).reduce(
      (sum, row) => {
        const nutrition = entryNutrition[row.entry.id] ?? EMPTY_NUTRITION;
        const factor = scope === "mine" ? (shareByEntryId.get(row.entry.id) ?? 0) : 1;
        return {
          kcal: sum.kcal + nutrition.kcal * factor,
          protein: sum.protein + nutrition.protein * factor,
          carbs: sum.carbs + nutrition.carbs * factor,
          fat: sum.fat + nutrition.fat * factor,
          fiber: sum.fiber + nutrition.fiber * factor,
        };
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    );
    return [day, totals];
  }));
  const dayTotals = Object.fromEntries(
    weekDays.map((day) => [
      day,
      {
        kcal: personalDayNutrition[day]?.kcal ?? 0,
        protein: personalDayNutrition[day]?.protein ?? 0,
        carbs: personalDayNutrition[day]?.carbs ?? 0,
        fat: personalDayNutrition[day]?.fat ?? 0,
        fiber: personalDayNutrition[day]?.fiber ?? EMPTY_NUTRITION.fiber,
      },
    ]),
  );

  const entries = visiblePlanEntries.map((e) => {
    const n = entryNutrition[e.entry.id];
    const factor = scope === "mine" ? (shareByEntryId.get(e.entry.id) ?? 0) : 1;
    const entryAssignments = plan.assignments.filter(
      (row) => row.assignment.mealPlanEntryId === e.entry.id,
    );
    return {
      id: e.entry.id,
      recipeId: e.entry.recipeId,
      ingredientId: e.entry.ingredientId,
      productId: e.entry.productId,
      itemName: e.itemName,
      sourceType: e.sourceType,
      date: e.entry.date,
      mealType: e.entry.mealType,
      servings: e.entry.servings * factor,
      quantity: e.entry.quantity != null ? Number.parseFloat(String(e.entry.quantity)) * factor : null,
      unit: e.entry.unit,
      notes: e.entry.notes,
      isBatchCooking: e.entry.isBatchCooking,
      kcal: (n?.kcal ?? 0) * factor,
      protein: (n?.protein ?? 0) * factor,
      carbs: (n?.carbs ?? 0) * factor,
      fat: (n?.fat ?? 0) * factor,
      editable: scope === "household" || (
        entryAssignments.length === 1 &&
        entryAssignments[0].assignment.userId === user.id &&
        Number.parseFloat(entryAssignments[0].assignment.share) === 1
      ),
    };
  });

  const assignments = plan.assignments.map((a) => ({
    mealPlanEntryId: a.assignment.mealPlanEntryId,
    userId: a.assignment.userId,
    displayName: a.displayName,
    share: Number.parseFloat(a.assignment.share),
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

  const pickMealType =
    params.pick && (mealTypeEnum as readonly string[]).includes(params.pick)
      ? (params.pick as MealType)
      : null;
  const editable = canEdit(role);

  return (
    <DashboardShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Plan posiłków</h1>
        <MealPlanView
          weekStart={weekStart}
          scope={scope}
          currentUserId={user.id}
          selectedDay={selectedDay}
          view={view}
          entries={entries}
          assignments={assignments}
          dayTotals={dayTotals}
          recipes={recipes.filter((r) => r.kind === "standard").map((r) => {
            const kcal = recipeKcal.get(r.id) ?? null;
            return {
              id: r.id,
              name: r.name,
              kind: "recipe" as const,
              kcal,
              kcalLabel: kcal != null ? `${Math.round(kcal)} / porcję` : null,
            };
          })}
          compositions={compositionRows.filter((item) => item !== null).map((item) => ({
            id: item.recipe.id,
            name: item.recipe.name,
            sections: item.sections.map((section) => ({
              id: section.id,
              name: section.name,
              options: section.options.map((option) => ({
                id: option.id,
                ingredientId: option.ingredientId,
                productId: option.productId,
                quantity: option.quantity,
                unit: option.unit,
              })),
            })),
          }))}
          compositionSources={compositionSources}
          ingredients={catalogIngredients}
          members={members.map((m) => ({ userId: m.userId, displayName: m.displayName }))}
          editable={editable}
          initialPick={
            pickMealType && editable ? { date: selectedDay, mealType: pickMealType } : null
          }
        />
      </div>
    </DashboardShell>
  );
}
