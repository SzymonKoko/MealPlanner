"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ScaledIngredientListProps {
  baseServings: number;
  ingredients: Array<{
    id: string;
    name: string;
    quantity: string;
    unit: string;
    optional: boolean;
  }>;
}

export function ScaledIngredientList({
  baseServings,
  ingredients,
}: ScaledIngredientListProps) {
  const [servings, setServings] = useState(baseServings);
  const multiplier = servings / baseServings;

  return (
    <div className="space-y-4">
      <div className="max-w-40 space-y-2">
        <Label htmlFor="scaled-servings">Przelicz na porcje</Label>
        <Input
          id="scaled-servings"
          type="number"
          min={1}
          value={servings}
          onChange={(event) => setServings(Math.max(1, Number(event.target.value) || 1))}
        />
      </div>
      <ul className="space-y-2">
        {ingredients.map((ingredient) => {
          const quantity = Number.parseFloat(ingredient.quantity);
          const scaled = Number.isFinite(quantity)
            ? Math.round(quantity * multiplier * 100) / 100
            : ingredient.quantity;
          return (
            <li key={ingredient.id} className="text-sm">
              {scaled} {ingredient.unit} {ingredient.name}
              {ingredient.optional ? " (opcjonalny)" : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
