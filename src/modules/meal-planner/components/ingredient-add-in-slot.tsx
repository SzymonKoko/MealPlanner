"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  quickAddUsdaIngredientAction,
  quickCreateIngredientAction,
} from "@/modules/ingredients/actions/ingredient-actions";
import type { IngredientImportSearchResultDto } from "@/integrations/usda";
import type { SlotPickerItem } from "@/modules/meal-planner/components/add-to-slot-dialog";

type AddMode = "chooser" | "manual" | "usda";

function kcalLabelFrom100(value: string | null | undefined): string | null {
  if (!value) return null;
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? `${Math.round(num)} / 100g` : null;
}

function formatMacro(value: string | null) {
  if (!value) return "—";
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? String(Math.round(num * 10) / 10) : "—";
}

interface IngredientAddInSlotPanelProps {
  initialName?: string;
  scanHref: string;
  usdaPageHref: string;
  onCreated: (item: SlotPickerItem) => void;
  onBack: () => void;
}

export function IngredientAddInSlotPanel({
  initialName = "",
  scanHref,
  usdaPageHref,
  onCreated,
  onBack,
}: IngredientAddInSlotPanelProps) {
  const [mode, setMode] = useState<AddMode>("chooser");
  const [pending, setPending] = useState(false);
  const [newName, setNewName] = useState(initialName);
  const [newKcal, setNewKcal] = useState("");
  const [newProtein, setNewProtein] = useState("");
  const [newCarbs, setNewCarbs] = useState("");
  const [newFat, setNewFat] = useState("");
  const [usdaQuery, setUsdaQuery] = useState(initialName);
  const [usdaResults, setUsdaResults] = useState<IngredientImportSearchResultDto[]>([]);
  const [usdaError, setUsdaError] = useState<string | null>(null);
  const [addingUsdaId, setAddingUsdaId] = useState<string | null>(null);

  function openManual() {
    setNewName(initialName || newName);
    setMode("manual");
  }

  function openUsda() {
    setUsdaQuery(initialName || usdaQuery);
    setUsdaResults([]);
    setUsdaError(null);
    setMode("usda");
  }

  async function handleCreateManual(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("name", newName.trim());
      if (newKcal.trim()) formData.set("kcalPer100", newKcal.trim());
      if (newProtein.trim()) formData.set("proteinPer100", newProtein.trim());
      if (newCarbs.trim()) formData.set("carbsPer100", newCarbs.trim());
      if (newFat.trim()) formData.set("fatPer100", newFat.trim());
      const created = await quickCreateIngredientAction(formData);
      toast.success(`Dodano składnik „${created.name}"`);
      onCreated({
        id: created.id,
        name: created.name,
        kind: "ingredient",
        kcalLabel: kcalLabelFrom100(newKcal.trim() || created.kcalPer100),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się dodać składnika");
    } finally {
      setPending(false);
    }
  }

  async function handleUsdaSearch(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setUsdaError(null);
    setUsdaResults([]);
    try {
      const response = await fetch(`/api/ingredients/usda/search?query=${encodeURIComponent(usdaQuery)}`);
      const payload = (await response.json()) as {
        results?: IngredientImportSearchResultDto[];
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? "Nie udało się wyszukać w USDA");
      }
      setUsdaResults(payload.results ?? []);
    } catch (error) {
      setUsdaError(error instanceof Error ? error.message : "Nie udało się wyszukać w USDA");
    } finally {
      setPending(false);
    }
  }

  async function handleUsdaQuickAdd(result: IngredientImportSearchResultDto) {
    setAddingUsdaId(result.externalId);
    setUsdaError(null);
    try {
      const formData = new FormData();
      formData.set("externalId", result.externalId);
      formData.set("name", usdaQuery.trim() || result.name);
      const created = await quickAddUsdaIngredientAction(formData);
      toast.success(`Dodano „${created.name}"`);
      onCreated({
        id: created.id,
        name: created.name,
        kind: "ingredient",
        kcalLabel: kcalLabelFrom100(created.kcalPer100 ?? result.kcalPer100),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się dodać składnika";
      setUsdaError(message);
      toast.error(message);
    } finally {
      setAddingUsdaId(null);
    }
  }

  if (mode === "chooser") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Jak chcesz dodać składnik?</p>
        <div className="grid gap-2">
          <Button asChild className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left">
            <Link href={scanHref}>
              <span className="block font-medium">Skanuj kod</span>
              <span className="mt-0.5 block text-xs font-normal opacity-90">Produkt sklepowy (Open Food Facts)</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left"
            onClick={openUsda}
          >
            <span className="block font-medium">Wyszukaj w bazie</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Ogólny składnik (USDA)</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left"
            onClick={openManual}
          >
            <span className="block font-medium">Dodaj manualnie</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Wpisz wartości sam</span>
          </Button>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Wstecz
        </Button>
      </div>
    );
  }

  if (mode === "manual") {
    return (
      <form onSubmit={(event) => void handleCreateManual(event)} className="space-y-4">
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
            <Input type="number" min="0" step="any" value={newKcal} onChange={(e) => setNewKcal(e.target.value)} placeholder="opcjonalnie" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Białko / 100g</span>
            <Input type="number" min="0" step="any" value={newProtein} onChange={(e) => setNewProtein(e.target.value)} placeholder="opcjonalnie" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Węgle / 100g</span>
            <Input type="number" min="0" step="any" value={newCarbs} onChange={(e) => setNewCarbs(e.target.value)} placeholder="opcjonalnie" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Tłuszcz / 100g</span>
            <Input type="number" min="0" step="any" value={newFat} onChange={(e) => setNewFat(e.target.value)} placeholder="opcjonalnie" />
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setMode("chooser")}>
            Wstecz
          </Button>
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending ? "Zapisuję…" : "Zapisz i wybierz ilość"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(event) => void handleUsdaSearch(event)} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Fraza wyszukiwania (USDA)</span>
          <Input
            value={usdaQuery}
            onChange={(event) => setUsdaQuery(event.target.value)}
            placeholder="np. banana, chicken breast"
            autoFocus
            required
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Szukam…" : "Wyszukaj"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setMode("chooser")}>
            Wstecz
          </Button>
          <Button asChild type="button" variant="ghost" size="sm">
            <Link href={usdaPageHref}>Pełna strona USDA</Link>
          </Button>
        </div>
      </form>
      {usdaError ? <p className="text-sm text-destructive">{usdaError}</p> : null}
      {usdaResults.length ? (
        <div className="max-h-52 space-y-2 overflow-y-auto">
          {usdaResults.map((result) => (
            <div key={result.externalId} className="rounded-lg border p-2 text-sm">
              <p className="font-medium">{result.name}</p>
              <p className="text-xs text-muted-foreground">
                {result.kcalPer100 ? `${formatMacro(result.kcalPer100)} kcal / 100g` : "— kcal"}
                {" · "}B {formatMacro(result.proteinPer100)} · W {formatMacro(result.carbsPer100)} · T{" "}
                {formatMacro(result.fatPer100)}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-2"
                disabled={addingUsdaId !== null}
                onClick={() => void handleUsdaQuickAdd(result)}
              >
                {addingUsdaId === result.externalId ? "Dodaję…" : "Dodaj"}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
