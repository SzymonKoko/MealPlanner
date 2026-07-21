"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MealType } from "@/db/schema/meal-planner";
import type { NutritionBasis } from "@/db/schema/ingredients";
import type { IngredientUnitConversion } from "@/lib/units";
import { MEAL_TYPE_LABELS } from "@/lib/meal-types";
import { calculateNutritionForQuantity, EMPTY_NUTRITION, sumNutrition } from "@/lib/nutrition";
import { addCompositionToPlanAction } from "../actions/composition-actions";
import { finishPlanReturnUrl } from "@/lib/return-to";

type NutritionSource = {
  id: string; name: string; nutritionBasis: NutritionBasis;
  kcalPer100: string | null; proteinPer100: string | null; carbsPer100: string | null;
  fatPer100: string | null; fiberPer100: string | null; saltPer100: string | null;
  densityGramsPerMl?: string | null; unitConversions?: IngredientUnitConversion[];
  packageQuantity?: string | null; packageUnit?: string | null;
};
type Option = { id: string; ingredientId: string | null; productId: string | null; quantity: string; unit: string };

export function CompositionBuilder({
  compositionId,
  sections,
  sources,
  today,
  initialTarget,
}: {
  compositionId: string;
  sections: Array<{ id: string; name: string; options: Option[] }>;
  sources: NutritionSource[];
  today: string;
  initialTarget?: { date: string; mealType: MealType; scope: "mine" | "household"; returnTo: string };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string[]>>(
    Object.fromEntries(sections.map((section) => [section.id, section.options[0]?.id ? [section.options[0].id] : []])),
  );
  const [date, setDate] = useState(initialTarget?.date ?? today);
  const [mealType, setMealType] = useState<MealType>(initialTarget?.mealType ?? "lunch");
  const [scope, setScope] = useState<"mine" | "household">(initialTarget?.scope ?? "mine");
  const [pending, setPending] = useState(false);

  const nutrition = useMemo(() => sumNutrition(sections.flatMap((section) =>
    section.options.filter((item) => selected[section.id]?.includes(item.id)).map((option) => {
      const source = sources.find((item) => item.id === (option.ingredientId ?? option.productId));
      if (!source) return { ...EMPTY_NUTRITION };
      try { return calculateNutritionForQuantity(source, option.quantity, option.unit); }
      catch { return { ...EMPTY_NUTRITION }; }
    }),
  )), [sections, selected, sources]);

  async function addToPlan() {
    setPending(true);
    try {
      await addCompositionToPlanAction({
        compositionId,
        optionIds: sections.flatMap((section) => selected[section.id] ?? []),
        date,
        mealType,
        planScope: scope,
      });
      toast.success("Dodano kompozycję do planera");
      router.push(initialTarget?.returnTo
        ? finishPlanReturnUrl(initialTarget.returnTo)
        : `/plan?view=day&day=${date}&scope=${scope}`);
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Nie udało się dodać posiłku");
    } finally { setPending(false); }
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader><CardTitle>{section.name}</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {section.options.map((option) => {
              const source = sources.find((item) => item.id === (option.ingredientId ?? option.productId));
              const active = selected[section.id]?.includes(option.id) ?? false;
              return (
                <button key={option.id} type="button" aria-pressed={active} onClick={() => setSelected((current) => ({
                  ...current,
                  [section.id]: active
                    ? (current[section.id] ?? []).filter((id) => id !== option.id)
                    : [...(current[section.id] ?? []), option.id],
                }))} className={`rounded-lg border p-3 text-left transition-colors ${active ? "border-primary bg-primary/10" : "hover:bg-accent"}`}>
                  <span className="font-medium">{source?.name ?? "Brakujący składnik"}</span>
                  <span className="block text-sm text-muted-foreground">{option.quantity} {option.unit}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader><CardTitle>Wybrany posiłek</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>{Math.round(nutrition.kcal)} kcal</span><span>B {nutrition.protein.toFixed(1)} g</span>
            <span>W {nutrition.carbs.toFixed(1)} g</span><span>T {nutrition.fat.toFixed(1)} g</span>
            <span>Bł {nutrition.fiber.toFixed(1)} g</span><span>Sól {nutrition.salt.toFixed(2)} g</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label htmlFor="composition-date">Data</Label><Input id="composition-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="composition-meal">Posiłek</Label><select id="composition-meal" value={mealType} onChange={(event) => setMealType(event.target.value as MealType)} className="h-11 w-full rounded-lg border bg-background px-3">{Object.entries(MEAL_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="composition-scope">Dla kogo</Label><select id="composition-scope" value={scope} onChange={(event) => setScope(event.target.value as "mine" | "household")} className="h-11 w-full rounded-lg border bg-background px-3"><option value="mine">Tylko dla mnie</option><option value="household">Całe gospodarstwo</option></select></div>
          </div>
          <Button onClick={() => void addToPlan()} disabled={pending || sections.some((section) => !selected[section.id]?.length)}>{pending ? "Dodawanie…" : "Dodaj do planera"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
