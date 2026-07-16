"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { approveUsdaIngredientAction } from "@/modules/ingredients/actions/ingredient-actions";
import type {
  IngredientImportDto,
  IngredientImportSearchResultDto,
} from "@/integrations/usda";

interface UsdaIngredientImportFlowProps {
  categories: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  initialQuery?: string;
}

const EMPTY_CONVERSION_ROWS = [
  { unit: "szt", gramsEquivalent: "", label: "" },
  { unit: "lyzka", gramsEquivalent: "", label: "" },
  { unit: "lyzeczka", gramsEquivalent: "", label: "" },
  { unit: "szklanka", gramsEquivalent: "", label: "" },
];

function stateLabel(state: IngredientImportSearchResultDto["state"]) {
  switch (state) {
    case "raw":
      return "surowy";
    case "cooked":
      return "ugotowany / po obróbce";
    case "processed":
      return "przetworzony";
    default:
      return "nieznany stan";
  }
}

export function UsdaIngredientImportFlow({
  categories,
  tags,
  initialQuery = "",
}: UsdaIngredientImportFlowProps) {
  const [query, setQuery] = useState(initialQuery);
  const [translatedQuery, setTranslatedQuery] = useState(initialQuery);
  const [results, setResults] = useState<IngredientImportSearchResultDto[]>([]);
  const [selected, setSelected] = useState<IngredientImportDto | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultName = useMemo(() => query.trim() || selected?.name || "", [query, selected?.name]);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSelected(null);
    try {
      const response = await fetch(`/api/ingredients/usda/search?query=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as {
        translatedQuery?: string;
        results?: IngredientImportSearchResultDto[];
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? "Nie udało się wyszukać danych USDA");
      }
      setTranslatedQuery(payload.translatedQuery ?? query);
      setResults(payload.results ?? []);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Nie udało się wyszukać danych USDA");
    } finally {
      setPending(false);
    }
  }

  async function handleSelect(externalId: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/ingredients/usda/${encodeURIComponent(externalId)}`);
      const payload = (await response.json()) as IngredientImportDto & { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Nie udało się pobrać szczegółów USDA");
      }
      setSelected(payload);
    } catch (detailsError) {
      setError(detailsError instanceof Error ? detailsError.message : "Nie udało się pobrać szczegółów USDA");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Wyszukaj składnik w USDA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="usda-query">Fraza wyszukiwania</Label>
              <Input
                id="usda-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="np. ryż biały, chicken breast, egg"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              USDA działa najlepiej po angielsku. Aplikacja użyje lokalnego słownika dla najczęstszych składników, ale możesz ręcznie poprawić frazę.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Szukam..." : "Wyszukaj dane"}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href="/ingredients">Wróć do składników</Link>
              </Button>
            </div>
          </form>
          {translatedQuery && translatedQuery !== query ? (
            <p className="text-xs text-muted-foreground">
              Użyta fraza angielska: <strong>{translatedQuery}</strong>
            </p>
          ) : null}
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Wybierz właściwy stan produktu. `raw`, `cooked` i `processed` mogą mieć inne wartości odżywcze.
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wyniki USDA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!results.length ? (
            <p className="text-sm text-muted-foreground">Najpierw wyszukaj składnik.</p>
          ) : (
            results.map((result) => (
              <div key={result.externalId} className="rounded-lg border p-3">
                <div className="space-y-1">
                  <p className="font-medium">{result.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {result.description || "Brak dodatkowego opisu"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    USDA #{result.externalId}
                    {result.foodCategory ? ` · ${result.foodCategory}` : ""}
                    {result.dataType ? ` · ${result.dataType}` : ""}
                    {` · ${stateLabel(result.state)}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.kcalPer100 ? `${result.kcalPer100} kcal / 100 g` : "Brak kalorii w wyniku wyszukiwania"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={selected?.externalId === result.externalId ? "secondary" : "outline"}
                  className="mt-3"
                  onClick={() => handleSelect(result.externalId)}
                  disabled={pending}
                >
                  {selected?.externalId === result.externalId ? "Wybrano" : "Wybierz wynik"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>Zatwierdź składnik</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={approveUsdaIngredientAction} className="space-y-4">
              <input type="hidden" name="externalId" value={selected.externalId} />
              <input type="hidden" name="originalName" value={selected.originalName} />
              <input type="hidden" name="dataSource" value="usda" />
              <input type="hidden" name="translatedQuery" value={translatedQuery} />
              <input type="hidden" name="baselineDescription" value={selected.description ?? ""} />
              <input type="hidden" name="baselineKcalPer100" value={selected.kcalPer100 ?? ""} />
              <input type="hidden" name="baselineProteinPer100" value={selected.proteinPer100 ?? ""} />
              <input type="hidden" name="baselineCarbsPer100" value={selected.carbsPer100 ?? ""} />
              <input type="hidden" name="baselineFatPer100" value={selected.fatPer100 ?? ""} />
              <input type="hidden" name="baselineFiberPer100" value={selected.fiberPer100 ?? ""} />
              <input type="hidden" name="baselineSaltPer100" value={selected.saltPer100 ?? ""} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="approve-name">Polska nazwa składnika</Label>
                  <Input id="approve-name" name="name" defaultValue={defaultName} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approve-category">Kategoria lokalna</Label>
                  <select
                    id="approve-category"
                    name="categoryId"
                    defaultValue=""
                    className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Bez kategorii</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Oryginalna nazwa USDA</Label>
                  <Input value={selected.originalName} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approve-description">Opis lokalny</Label>
                  <Input
                    id="approve-description"
                    name="description"
                    defaultValue={selected.description ?? ""}
                    placeholder="np. surowy, bez skórki"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Źródło danych</Label>
                  <Input value="usda" readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approve-food-category">Kategoria USDA</Label>
                  <Input id="approve-food-category" name="foodCategory" defaultValue={selected.foodCategory ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approve-data-type">Typ danych USDA</Label>
                  <Input id="approve-data-type" name="dataType" defaultValue={selected.dataType ?? ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="approve-base-unit">Jednostka bazowa</Label>
                <select
                  id="approve-base-unit"
                  name="baseUnit"
                  defaultValue="g"
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(
                  [
                    ["kcalPer100", "kcal", selected.kcalPer100],
                    ["proteinPer100", "Białko", selected.proteinPer100],
                    ["carbsPer100", "Węglowodany", selected.carbsPer100],
                    ["fatPer100", "Tłuszcze", selected.fatPer100],
                    ["fiberPer100", "Błonnik", selected.fiberPer100],
                    ["saltPer100", "Sól", selected.saltPer100],
                  ] as Array<[string, string, string | null]>
                ).map(([name, label, value]) => (
                  <div className="space-y-2" key={name}>
                    <Label htmlFor={name}>{label} / 100 g</Label>
                    <Input id={name} name={name} defaultValue={value ?? ""} inputMode="decimal" />
                  </div>
                ))}
              </div>
              {selected.warnings.length ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {selected.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Konwersje jednostek domowych</p>
                <p className="text-xs text-muted-foreground">
                  Dodaj tylko wiarygodne przeliczniki dla tego konkretnego składnika, np. `1 szt = 55 g`.
                </p>
                {EMPTY_CONVERSION_ROWS.map((conversion, index) => (
                  <div key={`${conversion.unit}-${index}`} className="grid gap-2 sm:grid-cols-[10rem_1fr_1fr]">
                    <select
                      name="conversionUnit"
                      defaultValue={conversion.unit}
                      className="flex h-11 rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="szt">szt</option>
                      <option value="lyzka">łyżka</option>
                      <option value="lyzeczka">łyżeczka</option>
                      <option value="szklanka">szklanka</option>
                    </select>
                    <Input name="conversionGrams" defaultValue={conversion.gramsEquivalent} placeholder="gramów" />
                    <Input name="conversionLabel" defaultValue={conversion.label} placeholder="np. średnie jajko" />
                  </div>
                ))}
              </div>
              {tags.length ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Tagi</legend>
                  <div className="flex flex-wrap gap-3">
                    {tags.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="tagIds" value={tag.id} />
                        {tag.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="verifiedByUser" value="true" defaultChecked />
                Dane zostały przejrzane przed zapisem
              </label>
              <Button type="submit">Zapisz składnik lokalnie</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
