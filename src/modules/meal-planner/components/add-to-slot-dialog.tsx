"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MEAL_TYPE_LABELS } from "@/lib/meal-types";
import type { MealType } from "@/db/schema/meal-planner";

type SourceType = "recipe" | "ingredient" | "product";

export interface SlotPickerItem {
  id: string;
  name: string;
  kind: SourceType;
  kcalLabel: string | null;
}

interface AddToSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  mealType: MealType;
  recipes: SlotPickerItem[];
  ingredients: SlotPickerItem[];
  onPick: (kind: SourceType, itemId: string, itemName: string) => Promise<void>;
}

export function AddToSlotDialog({
  open,
  onOpenChange,
  date,
  mealType,
  recipes,
  ingredients,
  onPick,
}: AddToSlotDialogProps) {
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filteredRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((item) => item.name.toLowerCase().includes(q));
  }, [query, recipes]);

  const filteredIngredients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter((item) => item.name.toLowerCase().includes(q));
  }, [ingredients, query]);

  async function handlePick(item: SlotPickerItem) {
    setPendingId(`${item.kind}:${item.id}`);
    try {
      await onPick(item.kind, item.id, item.name);
      onOpenChange(false);
      setQuery("");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent>
        <DialogHeader className="flex items-start justify-between gap-2">
          <div>
            <DialogTitle>Dodaj posiłek</DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {date} · {MEAL_TYPE_LABELS[mealType]}
            </p>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Zamknij
            </Button>
          </DialogClose>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj przepisu lub składnika…"
            autoFocus
          />

          <section className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Przepisy</p>
            {filteredRecipes.length ? (
              <div className="space-y-1">
                {filteredRecipes.map((item) => (
                  <button
                    key={`recipe-${item.id}`}
                    type="button"
                    disabled={pendingId !== null}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-60"
                    onClick={() => void handlePick(item)}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {pendingId === `recipe:${item.id}`
                        ? "Dodaję…"
                        : item.kcalLabel
                          ? `${item.kcalLabel} kcal`
                          : "Dodaj"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Brak przepisów.</p>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Składniki</p>
            {filteredIngredients.length ? (
              <div className="space-y-1">
                {filteredIngredients.map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    disabled={pendingId !== null}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-60"
                    onClick={() => void handlePick(item)}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {pendingId === `${item.kind}:${item.id}`
                        ? "Dodaję…"
                        : item.kcalLabel
                          ? `${item.kcalLabel} kcal`
                          : "Dodaj"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Brak składników.</p>
            )}
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
