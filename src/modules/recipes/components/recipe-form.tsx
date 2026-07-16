"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createRecipeAction,
  updateRecipeAction,
} from "@/modules/recipes/actions/recipe-actions";
import { SUPPORTED_UNITS } from "@/lib/units";
import {
  calculateNutritionForQuantity,
  EMPTY_NUTRITION,
  perServing,
  sumNutrition,
} from "@/lib/nutrition";
import type { NutritionBasis } from "@/db/schema/ingredients";

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
  const [sourceSearch, setSourceSearch] = useState("");
  const [servings, setServings] = useState(initialData?.servings ?? 2);
  const filteredSources = sources.filter((source) =>
    source.name.toLocaleLowerCase("pl").includes(sourceSearch.toLocaleLowerCase("pl")),
  );
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
        router.push(`/recipes/${initialData.id}`);
      } else {
        const recipe = await createRecipeAction(formData);
        router.push(`/recipes/${recipe.id}`);
      }
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Nie udało się zapisać przepisu");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{initialData ? "Edytuj przepis" : "Nowy przepis"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa</Label>
            <Input id="name" name="name" defaultValue={initialData?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Opis</Label>
            <textarea
              id="description"
              name="description"
              defaultValue={initialData?.description ?? ""}
              className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="servings">Liczba porcji</Label>
              <Input
                id="servings"
                name="servings"
                type="number"
                min={1}
                value={servings}
                onChange={(event) => setServings(Math.max(1, Number(event.target.value) || 1))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prepTimeMinutes">Przygotowanie (min)</Label>
              <Input id="prepTimeMinutes" name="prepTimeMinutes" type="number" min={0} defaultValue={initialData?.prepTimeMinutes ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cookTimeMinutes">Gotowanie (min)</Label>
              <Input id="cookTimeMinutes" name="cookTimeMinutes" type="number" min={0} defaultValue={initialData?.cookTimeMinutes ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions">Instrukcja</Label>
            <textarea
              id="instructions"
              name="instructions"
              defaultValue={initialData?.instructions ?? ""}
              className="flex min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image">Zdjęcie</Label>
            <Input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
            {initialData?.imageUrl ? <p className="text-xs text-muted-foreground">Obecne zdjęcie zostanie zachowane, jeśli nie wybierzesz nowego.</p> : null}
          </div>
          {tags.length ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Tagi</legend>
              <div className="flex flex-wrap gap-3">
                {tags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="tagIds" value={tag.id} defaultChecked={initialData?.tagIds.includes(tag.id)} />
                    {tag.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Składniki</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={sourceSearch}
              onChange={(event) => setSourceSearch(event.target.value)}
              placeholder="Szukaj składnika lub produktu"
              className="min-w-48 flex-1"
            />
            <Button asChild type="button" variant="outline">
              <Link href="/ingredients">Dodaj nowy składnik</Link>
            </Button>
          </div>
          {rows.map((row, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <select
                className="h-11 flex-1 min-w-32 rounded-lg border border-input bg-background px-3 text-sm"
                value={`${row.sourceType}:${row.sourceId}`}
                onChange={(e) => {
                  const next = [...rows];
                  const [sourceType, sourceId] = e.target.value.split(":") as ["ingredient" | "product", string];
                  next[index] = { ...next[index], sourceType, sourceId };
                  setRows(next);
                }}
                required
              >
                <option value="ingredient:">Wybierz składnik lub produkt</option>
                {sources
                  .filter((source) => filteredSources.includes(source) || source.id === row.sourceId)
                  .map((source) => (
                  <option key={`${source.type}:${source.id}`} value={`${source.type}:${source.id}`}>
                    {source.type === "product" ? "Produkt: " : ""}{source.name}
                  </option>
                  ))}
              </select>
              <Input
                className="w-24"
                value={row.quantity}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...next[index], quantity: e.target.value };
                  setRows(next);
                }}
              />
              <select
                className="h-11 w-20 rounded-lg border border-input bg-background px-2 text-sm"
                value={row.unit}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...next[index], unit: e.target.value };
                  setRows(next);
                }}
              >
                {SUPPORTED_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.optional}
                  onChange={(e) => {
                    const next = [...rows];
                    next[index] = { ...next[index], optional: e.target.checked };
                    setRows(next);
                  }}
                />
                Opcjonalny
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))}
                disabled={rows.length === 1}
              >
                Usuń
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
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
                disabled={index === rows.length - 1}
                onClick={() => {
                  const next = [...rows];
                  [next[index], next[index + 1]] = [next[index + 1], next[index]];
                  setRows(next);
                }}
              >
                ↓
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRows([...rows, { sourceId: "", sourceType: "ingredient", quantity: "100", unit: "g", optional: false }])}
          >
            + Składnik
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Makro na porcję — podgląd</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-6">
          <span>{Math.round(nutritionPreview.values.kcal)} kcal</span>
          <span>B: {nutritionPreview.values.protein.toFixed(1)} g</span>
          <span>W: {nutritionPreview.values.carbs.toFixed(1)} g</span>
          <span>T: {nutritionPreview.values.fat.toFixed(1)} g</span>
          <span>Bł: {nutritionPreview.values.fiber.toFixed(1)} g</span>
          <span>Sól: {nutritionPreview.values.salt.toFixed(2)} g</span>
          {nutritionPreview.warning ? (
            <p className="col-span-full text-destructive">{nutritionPreview.warning}</p>
          ) : null}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Zapisywanie..." : "Zapisz przepis"}</Button>
    </form>
  );
}
