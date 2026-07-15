"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createRecipeAction } from "@/modules/recipes/actions/recipe-actions";
import { SUPPORTED_UNITS } from "@/lib/units";

interface IngredientOption {
  id: string;
  name: string;
}

interface RecipeFormProps {
  ingredients: IngredientOption[];
}

interface RecipeIngredientRow {
  ingredientId: string;
  quantity: string;
  unit: string;
}

export function RecipeForm({ ingredients }: RecipeFormProps) {
  const router = useRouter();
  const [rows, setRows] = useState<RecipeIngredientRow[]>([
    { ingredientId: "", quantity: "100", unit: "g" },
  ]);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set(
      "ingredients",
      JSON.stringify(
        rows
          .filter((r) => r.ingredientId)
          .map((r, i) => ({
            ingredientId: r.ingredientId,
            productId: null,
            quantity: r.quantity,
            unit: r.unit,
            optional: false,
            sortOrder: i,
          })),
      ),
    );
    try {
      const recipe = await createRecipeAction(formData);
      router.push(`/recipes/${recipe.id}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nowy przepis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="servings">Liczba porcji</Label>
            <Input id="servings" name="servings" type="number" min={1} defaultValue={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions">Instrukcja</Label>
            <textarea
              id="instructions"
              name="instructions"
              className="flex min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Składniki</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="flex flex-wrap gap-2">
              <select
                className="h-11 flex-1 min-w-32 rounded-lg border border-input bg-background px-3 text-sm"
                value={row.ingredientId}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...next[index], ingredientId: e.target.value };
                  setRows(next);
                }}
                required
              >
                <option value="">Wybierz składnik</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name}
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
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRows([...rows, { ingredientId: "", quantity: "100", unit: "g" }])}
          >
            + Składnik
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? "Zapisywanie..." : "Zapisz przepis"}
      </Button>
    </form>
  );
}
