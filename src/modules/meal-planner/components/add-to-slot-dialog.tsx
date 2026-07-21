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
import { IngredientAddInSlotPanel } from "@/modules/meal-planner/components/ingredient-add-in-slot";
import { buildPlanPickerReturnUrl } from "@/modules/meal-planner/lib/plan-return-url";
import {
  CompositionBuilder,
  type CompositionNutritionSource,
  type CompositionSection,
} from "@/modules/recipes/components/composition-builder";

type SourceType = "recipe" | "ingredient" | "product";

export interface SlotPickerItem {
  id: string;
  name: string;
  kind: SourceType;
  kcalLabel: string | null;
  nutrition?: {
    nutritionBasis: "per100g" | "per100ml";
    kcalPer100: string | null;
    proteinPer100: string | null;
    carbsPer100: string | null;
    fatPer100: string | null;
    fiberPer100: string | null;
    saltPer100: string | null;
  };
}

interface AddToSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStart: string;
  date: string;
  mealType: MealType;
  scope: "mine" | "household";
  recipes: SlotPickerItem[];
  compositions: Array<{ id: string; name: string; sections: CompositionSection[] }>;
  compositionSources: CompositionNutritionSource[];
  ingredients: SlotPickerItem[];
  onPick: (
    kind: SourceType,
    itemId: string,
    itemName: string,
    quantity?: number,
    unit?: string,
  ) => Promise<void>;
}

const UNIT_OPTIONS = [
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
  { value: "szt", label: "szt" },
  { value: "opakowanie", label: "opakowanie" },
] as const;

interface QuantityPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  defaultQuantity?: number;
  defaultUnit?: string;
  onConfirm: (quantity: number, unit: string) => Promise<void>;
}

export function QuantityPromptDialog({
  open,
  onOpenChange,
  itemName,
  defaultQuantity = 100,
  defaultUnit = "g",
  onConfirm,
}: QuantityPromptDialogProps) {
  const [quantity, setQuantity] = useState(String(defaultQuantity));
  const [unit, setUnit] = useState(defaultUnit);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number.parseFloat(quantity.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setPending(true);
    try {
      await onConfirm(parsed, unit);
      onOpenChange(false);
      setQuantity(String(defaultQuantity));
      setUnit(defaultUnit);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) { setQuantity(String(defaultQuantity)); setUnit(defaultUnit); }
      }}
    >
      <DialogContent>
        <DialogHeader className="flex items-start justify-between gap-2">
          <div>
            <DialogTitle>Ilość</DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">{itemName}</p>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Anuluj
            </Button>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <div className="flex gap-2">
              <label className="block flex-1 space-y-1 text-sm">
                <span className="text-muted-foreground">Ilość</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step="any"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  autoFocus
                  required
                />
              </label>
              <label className="block w-28 space-y-1 text-sm">
                <span className="text-muted-foreground">Jednostka</span>
                <select
                  className="h-11 w-full rounded-lg border bg-background px-2 text-base"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                >
                  {UNIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Dodaję…" : "Dodaj do planu"}
            </Button>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function AddToSlotDialog({
  open,
  onOpenChange,
  weekStart,
  date,
  mealType,
  scope,
  recipes,
  compositions,
  compositionSources,
  ingredients,
  onPick,
}: AddToSlotDialogProps) {
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [quantityItem, setQuantityItem] = useState<SlotPickerItem | null>(null);
  const [ingredientAddMode, setIngredientAddMode] = useState(false);
  const [selectedCompositionId, setSelectedCompositionId] = useState<string | null>(null);
  const [ingredientAddSeed, setIngredientAddSeed] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [unit, setUnit] = useState("g");

  const planReturnUrl = buildPlanPickerReturnUrl(weekStart, date, mealType, scope);
  const scanHref = `/ingredients/scan?return=${encodeURIComponent(planReturnUrl)}`;
  const usdaPageHref = `/ingredients/usda?return=${encodeURIComponent(planReturnUrl)}&query=${encodeURIComponent(query.trim())}`;

  const filteredRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((item) => item.name.toLowerCase().includes(q));
  }, [query, recipes]);

  const filteredCompositions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return compositions;
    return compositions.filter((item) => item.name.toLowerCase().includes(q));
  }, [compositions, query]);

  const filteredIngredients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter((item) => item.name.toLowerCase().includes(q));
  }, [ingredients, query]);

  function reset() {
    setQuery("");
    setQuantityItem(null);
    setIngredientAddMode(false);
    setSelectedCompositionId(null);
    setIngredientAddSeed("");
    setQuantity("100");
    setUnit("g");
  }

  function openIngredientAdd(seed = query.trim()) {
    setIngredientAddSeed(seed);
    setIngredientAddMode(true);
  }

  function handleIngredientCreated(item: SlotPickerItem) {
    setIngredientAddMode(false);
    setQuantityItem(item);
  }

  async function handlePick(item: SlotPickerItem) {
    if (item.kind === "recipe") {
      setPendingId(`${item.kind}:${item.id}`);
      try {
        await onPick(item.kind, item.id, item.name);
        onOpenChange(false);
        reset();
      } finally {
        setPendingId(null);
      }
      return;
    }
    setQuantityItem(item);
  }

  async function handleQuantitySubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!quantityItem) return;
    const parsed = Number.parseFloat(quantity.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setPendingId(`${quantityItem.kind}:${quantityItem.id}`);
    try {
      await onPick(quantityItem.kind, quantityItem.id, quantityItem.name, parsed, unit);
      onOpenChange(false);
      reset();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader className="flex items-start justify-between gap-2">
          <div>
            <DialogTitle>
              {selectedCompositionId ? "Wybierz warianty" : quantityItem ? "Ilość" : ingredientAddMode ? "Nowy składnik" : "Dodaj posiłek"}
            </DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {quantityItem ? quantityItem.name : `${date} · ${MEAL_TYPE_LABELS[mealType]}`}
            </p>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Zamknij
            </Button>
          </DialogClose>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {selectedCompositionId ? (() => {
            const composition = compositions.find((item) => item.id === selectedCompositionId);
            if (!composition) return null;
            return (
              <div className="space-y-3">
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCompositionId(null)}>← Wstecz</Button>
                <CompositionBuilder
                  compositionId={composition.id}
                  sections={composition.sections}
                  sources={compositionSources}
                  today={date}
                  initialTarget={{ date, mealType, scope, returnTo: planReturnUrl }}
                  lockTarget
                  onAdded={() => {
                    onOpenChange(false);
                    reset();
                  }}
                />
              </div>
            );
          })() : quantityItem ? (
            <form onSubmit={(event) => void handleQuantitySubmit(event)} className="space-y-4">
              <div className="flex gap-2">
                <label className="block flex-1 space-y-1 text-sm">
                  <span className="text-muted-foreground">Ilość</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0.1"
                    step="any"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    autoFocus
                    required
                  />
                </label>
                <label className="block w-28 space-y-1 text-sm">
                  <span className="text-muted-foreground">Jednostka</span>
                  <select
                    className="h-11 w-full rounded-lg border bg-background px-2 text-base"
                    value={unit}
                    onChange={(event) => setUnit(event.target.value)}
                  >
                    {UNIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setQuantityItem(null)}>
                  Wstecz
                </Button>
                <Button type="submit" className="flex-1" disabled={pendingId !== null}>
                  {pendingId ? "Dodaję…" : "Dodaj do planu"}
                </Button>
              </div>
            </form>
          ) : ingredientAddMode ? (
            <IngredientAddInSlotPanel
              key={ingredientAddSeed}
              initialName={ingredientAddSeed}
              scanHref={scanHref}
              usdaPageHref={usdaPageHref}
              onCreated={handleIngredientCreated}
              onBack={() => setIngredientAddMode(false)}
            />
          ) : (
            <>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Szukaj przepisu lub składnika…"
                autoFocus
              />

              <section className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kompozycje</p>
                {filteredCompositions.length ? (
                  <div className="space-y-1">
                    {filteredCompositions.map((item) => (
                      <button
                        key={`composition-${item.id}`}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => setSelectedCompositionId(item.id)}
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">Wybierz warianty</span>
                      </button>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Brak kompozycji.</p>}
              </section>

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
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Składniki</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => openIngredientAdd()}>
                    + Nowy składnik
                  </Button>
                </div>
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
                ) : query.trim() ? (
                  <div className="space-y-2 rounded-lg border border-dashed p-3">
                    <p className="text-sm text-muted-foreground">Brak wyników dla „{query.trim()}”.</p>
                    <Button type="button" variant="secondary" size="sm" onClick={() => openIngredientAdd(query.trim())}>
                      Dodaj „{query.trim()}” jako składnik
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Brak składników.</p>
                )}
              </section>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
