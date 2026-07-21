"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RECIPE_SUPPORTED_UNITS } from "@/lib/units";
import { createCompositionAction, updateCompositionAction } from "../actions/composition-actions";
import { IngredientSourcePicker } from "./ingredient-source-picker";
import { IngredientAddInSlotPanel } from "@/modules/meal-planner/components/ingredient-add-in-slot";

type Source = { id: string; name: string; type: "ingredient" | "product" };
type OptionRow = { key: string; sourceId: string; sourceType: "ingredient" | "product"; quantity: string; unit: string };
type SectionRow = { key: string; name: string; options: OptionRow[] };

const newOption = (): OptionRow => ({
  key: crypto.randomUUID(), sourceId: "", sourceType: "ingredient", quantity: "100", unit: "g",
});
const newSection = (): SectionRow => ({ key: crypto.randomUUID(), name: "", options: [newOption()] });

export function CompositionForm({
  sources,
  initialData,
}: {
  sources: Source[];
  initialData?: { id: string; name: string; description: string | null; sections: Array<{
    id: string; name: string; options: Array<{
      id: string; ingredientId: string | null; productId: string | null; quantity: string; unit: string;
    }>;
  }> };
}) {
  const router = useRouter();
  const [availableSources, setAvailableSources] = useState(sources);
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [sections, setSections] = useState<SectionRow[]>(initialData?.sections.map((section) => ({
    key: section.id,
    name: section.name,
    options: section.options.map((option) => ({
      key: option.id,
      sourceId: option.ingredientId ?? option.productId ?? "",
      sourceType: option.productId ? "product" : "ingredient",
      quantity: option.quantity,
      unit: option.unit,
    })),
  })) ?? [newSection()]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAvailableSources((current) => {
      const known = new Set(current.map((source) => `${source.type}:${source.id}`));
      return [...current, ...sources.filter((source) => !known.has(`${source.type}:${source.id}`))];
    });
  }, [sources]);

  function updateSection(index: number, patch: Partial<SectionRow>) {
    setSections((current) => current.map((section, i) => i === index ? { ...section, ...patch } : section));
  }
  function updateOption(sectionIndex: number, optionIndex: number, patch: Partial<OptionRow>) {
    setSections((current) => current.map((section, i) => i !== sectionIndex ? section : {
      ...section,
      options: section.options.map((option, j) => j === optionIndex ? { ...option, ...patch } : option),
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("sections", JSON.stringify(sections.map((section, sectionIndex) => ({
      name: section.name,
      sortOrder: sectionIndex,
      options: section.options.filter((option) => option.sourceId).map((option, optionIndex) => ({
        ingredientId: option.sourceType === "ingredient" ? option.sourceId : null,
        productId: option.sourceType === "product" ? option.sourceId : null,
        quantity: option.quantity,
        unit: option.unit,
        sortOrder: optionIndex,
      })),
    }))));
    try {
      const saved = initialData
        ? await updateCompositionAction(initialData.id, formData)
        : await createCompositionAction(formData);
      toast.success(initialData ? "Zapisano kompozycję" : "Utworzono kompozycję");
      router.push(`/recipes/${saved.id}`);
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Nie udało się zapisać kompozycji";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div><CardTitle>Warianty</CardTitle><p className="mt-1 text-sm text-muted-foreground">Wybieraj z istniejących pozycji albo dodaj nową.</p></div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => router.refresh()}>Odśwież listę</Button>
            {!addingIngredient ? <Button type="button" variant="outline" onClick={() => setAddingIngredient(true)}>+ Nowy składnik</Button> : null}
          </div>
        </CardHeader>
        {addingIngredient ? (
          <CardContent>
            <IngredientAddInSlotPanel
              scanHref="/ingredients/scan"
              usdaPageHref="/ingredients/usda"
              externalToolsInNewTab
              onCreated={(item) => {
                setAvailableSources((current) => current.some((source) => source.id === item.id)
                  ? current
                  : [...current, { id: item.id, name: item.name, type: "ingredient" }]);
                setAddingIngredient(false);
              }}
              onBack={() => setAddingIngredient(false)}
            />
          </CardContent>
        ) : null}
      </Card>

      <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{initialData ? "Edytuj kompozycję" : "Nowa kompozycja"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1"><Label htmlFor="name">Nazwa</Label><Input id="name" name="name" defaultValue={initialData?.name} placeholder="np. Bowl" required /></div>
          <div className="space-y-1"><Label htmlFor="description">Opis</Label><textarea id="description" name="description" defaultValue={initialData?.description ?? ""} className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></div>
          <p className="text-sm text-muted-foreground">W każdej sekcji osoba układająca posiłek wybierze jeden lub kilka wariantów.</p>
        </CardContent>
      </Card>

      {sections.map((section, sectionIndex) => (
        <Card key={section.key}>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Input value={section.name} onChange={(event) => updateSection(sectionIndex, { name: event.target.value })} placeholder="Nazwa sekcji, np. Mięso" aria-label="Nazwa sekcji" required />
            <Button type="button" variant="ghost" className="text-destructive" disabled={sections.length === 1} onClick={() => setSections(sections.filter((_, i) => i !== sectionIndex))}>Usuń</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {section.options.map((option, optionIndex) => (
              <div key={option.key} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_5rem_6rem_auto] sm:items-center">
                <IngredientSourcePicker sources={availableSources} value={{ sourceId: option.sourceId, sourceType: option.sourceType }} onChange={(value) => updateOption(sectionIndex, optionIndex, value)} />
                <Input value={option.quantity} onChange={(event) => updateOption(sectionIndex, optionIndex, { quantity: event.target.value })} type="number" min="0.1" step="any" aria-label="Gramatura wariantu" required />
                <select value={option.unit} onChange={(event) => updateOption(sectionIndex, optionIndex, { unit: event.target.value })} className="h-9 rounded-lg border bg-background px-2 text-sm" aria-label="Jednostka">
                  {RECIPE_SUPPORTED_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
                <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={section.options.length === 1} onClick={() => updateSection(sectionIndex, { options: section.options.filter((_, i) => i !== optionIndex) })}>×</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => updateSection(sectionIndex, { options: [...section.options, newOption()] })}>+ Wariant</Button>
          </CardContent>
        </Card>
      ))}
      <Button type="button" variant="outline" onClick={() => setSections([...sections, newSection()])}>+ Sekcja</Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div><Button type="submit" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz kompozycję"}</Button></div>
      </form>
    </div>
  );
}
