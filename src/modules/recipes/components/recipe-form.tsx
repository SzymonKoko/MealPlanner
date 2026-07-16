"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createRecipeAction,
  updateRecipeAction,
} from "@/modules/recipes/actions/recipe-actions";
import { RECIPE_SUPPORTED_UNITS } from "@/lib/units";
import type { IngredientUnitConversion } from "@/lib/units";
import {
  calculateNutritionForQuantity,
  EMPTY_NUTRITION,
  perServing,
  sumNutrition,
} from "@/lib/nutrition";
import type { NutritionBasis } from "@/db/schema/ingredients";
import { IngredientSourcePicker } from "./ingredient-source-picker";

interface RecipeSourceOption {
  id: string;
  name: string;
  type: "ingredient" | "product";
  nutritionBasis: NutritionBasis;
  kcalPer100: string | null;
  proteinPer100: string | null;
  carbsPer100: string | null;
  fatPer100: string | null;
  fiberPer100: string | null;
  saltPer100: string | null;
  densityGramsPerMl?: string | null;
  unitConversions?: IngredientUnitConversion[];
  packageQuantity?: string | null;
  packageUnit?: string | null;
}

interface RecipeFormProps {
  sources: RecipeSourceOption[];
  tags: { id: string; name: string }[];
  initialData?: {
    id: string;
    name: string;
    description: string | null;
    instructions: string | null;
    servings: number;
    prepTimeMinutes: number | null;
    cookTimeMinutes: number | null;
    imageUrl: string | null;
    tagIds: string[];
    ingredients: Array<{
      ingredientId: string | null;
      productId: string | null;
      quantity: string;
      unit: string;
      optional: boolean;
    }>;
  };
}

interface RecipeIngredientRow {
  sourceId: string;
  sourceType: "ingredient" | "product";
  quantity: string;
  unit: string;
  optional: boolean;
}

function unitLabel(unit: string) {
  switch (unit) {
    case "lyzka":
      return "łyżka";
    case "lyzeczka":
      return "łyżeczka";
    case "szklanka":
      return "szklanka";
    case "opakowanie":
      return "opak.";
    default:
      return unit;
  }
}

export function RecipeForm({ sources, tags, initialData }: RecipeFormProps) {
  const router = useRouter();
  const [rows, setRows] = useState<RecipeIngredientRow[]>(
    initialData?.ingredients.map((item) => ({
      sourceId: item.ingredientId ?? item.productId ?? "",
      sourceType: item.productId ? "product" : "ingredient",
      quantity: item.quantity,
      unit: item.unit,
      optional: item.optional,
    })) ?? [{ sourceId: "", sourceType: "ingredient", quantity: "100", unit: "g", optional: false }],
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servings, setServings] = useState(initialData?.servings ?? 2);
  const nutritionPreview = useMemo(() => {
    let warning: string | null = null;
    const total = sumNutrition(
      rows.map((row) => {
        if (row.optional) return { ...EMPTY_NUTRITION };
        const source = sources.find(
          (item) => item.id === row.sourceId && item.type === row.sourceType,
        );
        if (!source) return { ...EMPTY_NUTRITION };
        try {
          return calculateNutritionForQuantity(source, row.quantity || "0", row.unit);
        } catch (conversionError) {
          warning = conversionError instanceof Error ? conversionError.message : "Nie można przeliczyć jednostek";
          return { ...EMPTY_NUTRITION };
        }
      }),
    );
    return { values: perServing(total, servings), warning };
  }, [rows, servings, sources]);

  function updateRow(index: number, patch: Partial<RecipeIngredientRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const image = formData.get("image");
    formData.delete("image");
    formData.set(
      "ingredients",
      JSON.stringify(
        rows
          .filter((r) => r.sourceId)
          .map((r, i) => ({
            ingredientId: r.sourceType === "ingredient" ? r.sourceId : null,
            productId: r.sourceType === "product" ? r.sourceId : null,
            quantity: r.quantity,
            unit: r.unit,
            optional: r.optional,
            sortOrder: i,
          })),
      ),
    );
    try {
      if (image instanceof File && image.size > 0) {
        const upload = new FormData();
        upload.set("file", image);
        const response = await fetch("/api/uploads/recipes", { method: "POST", body: upload });
        const result = (await response.json()) as { imageUrl?: string; error?: string };
        if (!response.ok || !result.imageUrl) {
          throw new Error(result.error ?? "Nie udało się przesłać zdjęcia");
        }
        formData.set("imageUrl", result.imageUrl);
      } else if (initialData?.imageUrl) {
        formData.set("imageUrl", initialData.imageUrl);
      }

      if (initialData) {
        await updateRecipeAction(initialData.id, formData);
        toast.success("Zapisano przepis");
        router.push(`/recipes/${initialData.id}`);
      } else {
        const recipe = await createRecipeAction(formData);
        toast.success("Utworzono przepis");
        router.push(`/recipes/${recipe.id}`);
      }
      router.refresh();
    } catch (submissionError) {
      const message =
        submissionError instanceof Error ? submissionError.message : "Nie udało się zapisać przepisu";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{initialData ? "Edytuj przepis" : "Nowy przepis"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="name">Nazwa</Label>
            <Input id="name" name="name" className="h-9" defaultValue={initialData?.name} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Opis</Label>
            <textarea
              id="description"
              name="description"
              defaultValue={initialData?.description ?? ""}
              className="flex min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="servings">Porcje</Label>
              <Input
                id="servings"
                name="servings"
                type="number"
                min={1}
                className="h-9"
                value={servings}
                onChange={(event) => setServings(Math.max(1, Number(event.target.value) || 1))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="prepTimeMinutes">Przygotowanie (min)</Label>
              <Input
                id="prepTimeMinutes"
                name="prepTimeMinutes"
                type="number"
                min={0}
                className="h-9"
                defaultValue={initialData?.prepTimeMinutes ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cookTimeMinutes">Gotowanie (min)</Label>
              <Input
                id="cookTimeMinutes"
                name="cookTimeMinutes"
                type="number"
                min={0}
                className="h-9"
                defaultValue={initialData?.cookTimeMinutes ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="instructions">Instrukcja</Label>
            <textarea
              id="instructions"
              name="instructions"
              defaultValue={initialData?.instructions ?? ""}
              className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="image">Zdjęcie</Label>
            <Input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="h-9" />
            {initialData?.imageUrl ? (
              <p className="text-xs text-muted-foreground">Obecne zdjęcie zostanie zachowane, jeśli nie wybierzesz nowego.</p>
            ) : null}
          </div>
          {tags.length ? (
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">Tagi</legend>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {tags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      name="tagIds"
                      value={tag.id}
                      defaultChecked={initialData?.tagIds.includes(tag.id)}
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle>Składniki</CardTitle>
          <Button asChild type="button" variant="outline" size="sm">
            <Link href="/ingredients">Nowy składnik</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="hidden gap-2 px-1 text-xs text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_auto]">
            <span>Nazwa</span>
            <span>Ilość</span>
            <span>Jednostka</span>
            <span className="w-28 text-center">Opcj.</span>
          </div>
          {rows.map((row, index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_auto] sm:items-center sm:border-0 sm:p-0"
            >
              <IngredientSourcePicker
                sources={sources}
                value={{ sourceId: row.sourceId, sourceType: row.sourceType }}
                onChange={(next) => updateRow(index, next)}
              />
              <Input
                className="h-9 w-full sm:w-auto"
                value={row.quantity}
                inputMode="decimal"
                aria-label="Ilość"
                onChange={(e) => updateRow(index, { quantity: e.target.value })}
              />
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm sm:w-auto"
                value={row.unit}
                aria-label="Jednostka"
                onChange={(e) => updateRow(index, { unit: e.target.value })}
              >
                {RECIPE_SUPPORTED_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {unitLabel(u)}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-between gap-1 sm:w-28 sm:justify-end">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={row.optional}
                    onChange={(e) => updateRow(index, { optional: e.target.checked })}
                  />
                  opc.
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  disabled={index === 0}
                  onClick={() => {
                    const next = [...rows];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    setRows(next);
                  }}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  disabled={index === rows.length - 1}
                  onClick={() => {
                    const next = [...rows];
                    [next[index], next[index + 1]] = [next[index + 1], next[index]];
                    setRows(next);
                  }}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-destructive"
                  onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))}
                  disabled={rows.length === 1}
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setRows([...rows, { sourceId: "", sourceType: "ingredient", quantity: "100", unit: "g", optional: false }])
            }
          >
            + Składnik
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Makro / porcję</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>{Math.round(nutritionPreview.values.kcal)} kcal</span>
          <span>B {nutritionPreview.values.protein.toFixed(1)}</span>
          <span>W {nutritionPreview.values.carbs.toFixed(1)}</span>
          <span>T {nutritionPreview.values.fat.toFixed(1)}</span>
          <span>Bł {nutritionPreview.values.fiber.toFixed(1)}</span>
          <span>Sól {nutritionPreview.values.salt.toFixed(2)}</span>
          {nutritionPreview.warning ? (
            <p className="w-full text-destructive">{nutritionPreview.warning}</p>
          ) : null}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Zapisywanie..." : "Zapisz przepis"}
      </Button>
    </form>
  );
}
