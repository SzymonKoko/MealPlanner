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
import { toast } from "sonner";
import { quickCreateIngredientAction } from "@/modules/ingredients/actions/ingredient-actions";

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
  date,
  mealType,
  recipes,
  ingredients,
  onPick,
}: AddToSlotDialogProps) {
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [quantityItem, setQuantityItem] = useState<SlotPickerItem | null>(null);
  const [showCreateIngredient, setShowCreateIngredient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKcal, setNewKcal] = useState("");
  const [newProtein, setNewProtein] = useState("");
  const [newCarbs, setNewCarbs] = useState("");
  const [newFat, setNewFat] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [unit, setUnit] = useState("g");

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

  function reset() {
    setQuery("");
    setQuantityItem(null);
    setShowCreateIngredient(false);
    setNewName("");
    setNewKcal("");
    setNewProtein("");
    setNewCarbs("");
    setNewFat("");
    setQuantity("100");
    setUnit("g");
  }

  function openCreateIngredient() {
    setShowCreateIngredient(true);
    setNewName(query.trim());
  }

  async function handleCreateIngredient(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    setPendingId("create-ingredient");
    try {
      const formData = new FormData();
      formData.set("name", newName.trim());
      if (newKcal.trim()) formData.set("kcalPer100", newKcal.trim());
      if (newProtein.trim()) formData.set("proteinPer100", newProtein.trim());
      if (newCarbs.trim()) formData.set("carbsPer100", newCarbs.trim());
      if (newFat.trim()) formData.set("fatPer100", newFat.trim());
      const created = await quickCreateIngredientAction(formData);
      toast.success(`Dodano składnik „${created.name}"`);
      setQuantityItem({
        id: created.id,
        name: created.name,
        kind: "ingredient",
        kcalLabel: newKcal.trim() ? `${Math.round(Number.parseFloat(newKcal.replace(",", ".")))} / 100g` : null,
      });
      setShowCreateIngredient(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się dodać składnika";
      toast.error(message);
    } finally {
      setPendingId(null);
    }
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
              {quantityItem ? "Ilość" : showCreateIngredient ? "Nowy składnik" : "Dodaj posiłek"}
            </DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {quantityItem
                ? quantityItem.name
                : showCreateIngredient
                  ? `${date} · ${MEAL_TYPE_LABELS[mealType]}`
                  : `${date} · ${MEAL_TYPE_LABELS[mealType]}`}
            </p>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Zamknij
            </Button>
          </DialogClose>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {quantityItem ? (
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
          ) : showCreateIngredient ? (
            <form onSubmit={(event) => void handleCreateIngredient(event)} className="space-y-4">
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Nazwa składnika</span>
                <Input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="np. banan, skyr"
                  autoFocus
                  required
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">kcal / 100g</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={newKcal}
                    onChange={(event) => setNewKcal(event.target.value)}
                    placeholder="opcjonalnie"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">Białko / 100g</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={newProtein}
                    onChange={(event) => setNewProtein(event.target.value)}
                    placeholder="opcjonalnie"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">Węgle / 100g</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={newCarbs}
                    onChange={(event) => setNewCarbs(event.target.value)}
                    placeholder="opcjonalnie"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">Tłuszcz / 100g</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={newFat}
                    onChange={(event) => setNewFat(event.target.value)}
                    placeholder="opcjonalnie"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateIngredient(false)}>
                  Wstecz
                </Button>
                <Button type="submit" className="flex-1" disabled={pendingId !== null}>
                  {pendingId ? "Zapisuję…" : "Zapisz i wybierz ilość"}
                </Button>
              </div>
            </form>
          ) : (
            <>
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
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Składniki</p>
                  <Button type="button" variant="outline" size="sm" onClick={openCreateIngredient}>
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
                    <Button type="button" variant="secondary" size="sm" onClick={openCreateIngredient}>
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
