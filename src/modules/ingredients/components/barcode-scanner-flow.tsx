"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { approveImportedProductAction } from "../actions/barcode-actions";

interface IngredientOption {
  id: string;
  name: string;
}

interface LookupCandidate {
  barcode: string;
  name: string;
  brand: string | null;
  packageQuantity: string | null;
  packageUnit: string | null;
  nutritionBasis: "per100g" | "per100ml";
  kcalPer100: string | null;
  proteinPer100: string | null;
  carbsPer100: string | null;
  fatPer100: string | null;
  fiberPer100: string | null;
  saltPer100: string | null;
  imageUrl: string | null;
  dataSource: "open_food_facts";
  externalId: string;
  sourceUpdatedAt: string | null;
  warnings: string[];
}

interface LookupProduct extends Omit<LookupCandidate, "dataSource" | "externalId" | "sourceUpdatedAt" | "warnings"> {
  id: string;
  dataSource: string;
  externalId: string | null;
  importedAt: string | null;
  sourceUpdatedAt: string | null;
  verifiedByUser: boolean;
  manuallyModified: boolean;
  ingredientId: string | null;
}

interface LookupResponse {
  status: "local" | "external" | "not_found";
  product?: LookupProduct;
  candidate?: LookupCandidate;
  diffs?: string[];
}

function buildDraft(
  barcode: string,
  product?: LookupProduct,
  candidate?: LookupCandidate,
  manualMode = false,
) {
  return {
    barcode,
    name: product?.name ?? candidate?.name ?? "",
    brand: product?.brand ?? candidate?.brand ?? "",
    packageQuantity: product?.packageQuantity ?? candidate?.packageQuantity ?? "",
    packageUnit: product?.packageUnit ?? candidate?.packageUnit ?? "g",
    ingredientId: product?.ingredientId ?? "",
    imageUrl: product?.imageUrl ?? candidate?.imageUrl ?? "",
    nutritionBasis: product?.nutritionBasis ?? candidate?.nutritionBasis ?? "per100g",
    kcalPer100: product?.kcalPer100 ?? candidate?.kcalPer100 ?? "",
    proteinPer100: product?.proteinPer100 ?? candidate?.proteinPer100 ?? "",
    carbsPer100: product?.carbsPer100 ?? candidate?.carbsPer100 ?? "",
    fatPer100: product?.fatPer100 ?? candidate?.fatPer100 ?? "",
    fiberPer100: product?.fiberPer100 ?? candidate?.fiberPer100 ?? "",
    saltPer100: product?.saltPer100 ?? candidate?.saltPer100 ?? "",
    dataSource: manualMode ? "manual" : candidate?.dataSource ?? product?.dataSource ?? "manual",
  };
}

const fieldLabels: Record<string, string> = {
  name: "Nazwa",
  brand: "Marka",
  packageQuantity: "Ilość opakowania",
  packageUnit: "Jednostka opakowania",
  nutritionBasis: "Podstawa danych",
  kcalPer100: "Kalorie",
  proteinPer100: "Białko",
  carbsPer100: "Węgle",
  fatPer100: "Tłuszcze",
  fiberPer100: "Błonnik",
  saltPer100: "Sól",
  imageUrl: "Zdjęcie",
};

const nutritionFields = [
  ["kcalPer100", "kcal"],
  ["proteinPer100", "Białko"],
  ["carbsPer100", "Węgle"],
  ["fatPer100", "Tłuszcze"],
  ["fiberPer100", "Błonnik"],
  ["saltPer100", "Sól"],
] as const;

function getCandidateFieldValue(candidate: LookupCandidate, field: string) {
  return candidate[field as keyof LookupCandidate];
}

function getProductFieldValue(product: LookupProduct, field: string) {
  return product[field as keyof LookupProduct];
}

export function BarcodeScannerFlow({
  ingredients,
  initialBarcode,
  initialRefresh,
}: {
  ingredients: IngredientOption[];
  initialBarcode?: string;
  initialRefresh?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastSentRef = useRef<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState(initialBarcode ?? "");
  const [lookupBarcode, setLookupBarcode] = useState(initialBarcode ?? "");
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const currentBasis = draft.nutritionBasis ?? result?.candidate?.nutritionBasis ?? result?.product?.nutritionBasis ?? "per100g";
  const currentProduct = result?.product;
  const currentCandidate = result?.candidate;

  useEffect(() => {
    if (initialBarcode) {
      void runLookup(initialBarcode, Boolean(initialRefresh));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (manualMode) {
      setDraft(buildDraft(lookupBarcode || manualBarcode, undefined, undefined, true));
      return;
    }
    if (result) {
      setDraft(buildDraft(lookupBarcode || manualBarcode, result.product, result.candidate));
    }
  }, [lookupBarcode, manualBarcode, manualMode, result]);

  async function runLookup(barcode: string, refresh = false) {
    setLoading(true);
    setLookupError(null);
    setManualMode(false);
    try {
      const response = await fetch(
        `/api/products/barcode/${encodeURIComponent(barcode)}${refresh ? "?refresh=1" : ""}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as LookupResponse & { error?: string; message?: string };
      if (response.status === 404 && payload.status === "not_found") {
        setResult({ status: "not_found" });
        setManualMode(false);
        setDraft({});
        return;
      }
      if (!response.ok) {
        throw new Error(payload.message ?? "Nie udało się pobrać produktu");
      }
      setResult(payload);
      setDraft({});
    } catch (error) {
      setResult(null);
      setLookupError(error instanceof Error ? error.message : "Nie udało się pobrać produktu");
    } finally {
      setLoading(false);
    }
  }

  async function startCamera() {
    setCameraError(null);
    setCameraActive(true);
    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const preferredDevice =
        devices.find((device) => /back|rear|environment/i.test(device.label))?.deviceId ??
        devices[0]?.deviceId;
      readerRef.current = new BrowserMultiFormatReader();
      controlsRef.current = await readerRef.current.decodeFromVideoDevice(
        preferredDevice,
        videoRef.current!,
        (decoded, error) => {
          if (decoded) {
            const barcode = decoded.getText();
            if (lastSentRef.current === barcode) return;
            lastSentRef.current = barcode;
            setManualBarcode(barcode);
            setLookupBarcode(barcode);
            stopCamera();
            void runLookup(barcode, false);
          } else if (error && error.name !== "NotFoundException") {
            setCameraError("Nie udało się odczytać kodu. Spróbuj ponownie albo wpisz kod ręcznie.");
          }
        },
      );
    } catch {
      setCameraError("Brak dostępu do aparatu albo tylna kamera nie jest dostępna.");
      setCameraActive(false);
    }
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    readerRef.current = null;
    setCameraActive(false);
  }

  function applyImportedField(field: string) {
    const source = currentCandidate;
    if (!source) return;
    setDraft((current) => ({
      ...current,
      [field]: String(getCandidateFieldValue(source, field) ?? ""),
    }));
  }

  const diffFields = useMemo(() => new Set(result?.diffs ?? []), [result?.diffs]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Skanowanie kodu</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {!cameraActive ? (
              <Button type="button" onClick={() => void startCamera()}>Uruchom aparat</Button>
            ) : (
              <Button type="button" variant="outline" onClick={stopCamera}>Zatrzymaj aparat</Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setLookupBarcode(manualBarcode);
                lastSentRef.current = manualBarcode;
                void runLookup(manualBarcode, false);
              }}
              disabled={!manualBarcode || loading}
            >
              Szukaj po kodzie
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-barcode">Kod kreskowy</Label>
            <Input
              id="manual-barcode"
              value={manualBarcode}
              onChange={(event) => setManualBarcode(event.target.value)}
              placeholder="EAN / UPC / GTIN"
              inputMode="numeric"
            />
          </div>
          {cameraActive ? (
            <video ref={videoRef} className="aspect-video w-full rounded-lg border bg-black object-cover" muted playsInline />
          ) : null}
          {cameraError ? <p className="text-sm text-destructive">{cameraError}</p> : null}
          {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}
          {loading ? <p className="text-sm text-muted-foreground">Szukam produktu...</p> : null}
        </CardContent>
      </Card>

      {result?.status === "local" && currentProduct ? (
        <Card>
          <CardHeader><CardTitle>Produkt już istnieje lokalnie</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="font-medium">{currentProduct.name}</p>
            <p className="text-sm text-muted-foreground">
              {currentProduct.brand ? `${currentProduct.brand} · ` : ""}
              Źródło: {currentProduct.dataSource}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={`/ingredients?product=${currentProduct.id}`}>Wróć do produktów</Link>
              </Button>
              <Button type="button" onClick={() => void runLookup(currentProduct.barcode, true)}>
                Odśwież z Open Food Facts
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result?.status === "not_found" ? (
        <Card>
          <CardHeader><CardTitle>Nie znaleziono produktu dla tego kodu.</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setManualMode(true)}>Dodaj produkt ręcznie</Button>
              <Button type="button" variant="outline" onClick={() => void startCamera()}>Zeskanuj ponownie</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {(manualMode || result?.status === "external") ? (
        <Card>
          <CardHeader><CardTitle>{currentProduct ? "Porównaj i zatwierdź zmiany" : "Zatwierdź import produktu"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {currentCandidate?.warnings?.length ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                {currentCandidate.warnings.map((warning) => <p key={warning}>{warning}</p>)}
              </div>
            ) : null}
            {currentProduct && currentCandidate && diffFields.size > 0 ? (
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <p className="font-medium">Różnice przed odświeżeniem</p>
                {Array.from(diffFields).map((field) => (
                  <div key={field} className="flex flex-col gap-1 rounded-md border p-2">
                    <span className="font-medium">{fieldLabels[field] ?? field}</span>
                    <span className="text-muted-foreground">
                      Lokalnie: {String(getProductFieldValue(currentProduct, field) ?? "brak")}
                    </span>
                    <span className="text-muted-foreground">
                      Open Food Facts: {String(getCandidateFieldValue(currentCandidate, field) ?? "brak")}
                    </span>
                    <Button type="button" size="sm" variant="outline" onClick={() => applyImportedField(field)}>
                      Użyj danych z Open Food Facts
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            <form action={approveImportedProductAction} className="space-y-4">
              {currentProduct ? <input type="hidden" name="existingProductId" value={currentProduct.id} /> : null}
              <input type="hidden" name="barcode" value={lookupBarcode || manualBarcode} />
              <input type="hidden" name="externalId" value={currentCandidate?.externalId ?? ""} />
              <input type="hidden" name="sourceUpdatedAt" value={currentCandidate?.sourceUpdatedAt ?? ""} />
              <input type="hidden" name="dataSource" value={draft.dataSource ?? "manual"} />
              <input type="hidden" name="originalNutritionBasis" value={currentCandidate?.nutritionBasis ?? ""} />
              <input type="hidden" name="originalKcalPer100" value={currentCandidate?.kcalPer100 ?? ""} />
              <input type="hidden" name="originalProteinPer100" value={currentCandidate?.proteinPer100 ?? ""} />
              <input type="hidden" name="originalCarbsPer100" value={currentCandidate?.carbsPer100 ?? ""} />
              <input type="hidden" name="originalFatPer100" value={currentCandidate?.fatPer100 ?? ""} />
              <input type="hidden" name="originalFiberPer100" value={currentCandidate?.fiberPer100 ?? ""} />
              <input type="hidden" name="originalSaltPer100" value={currentCandidate?.saltPer100 ?? ""} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-name">Nazwa</Label>
                  <Input
                    id="product-name"
                    name="name"
                    value={draft.name ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-brand">Marka</Label>
                  <Input
                    id="product-brand"
                    name="brand"
                    value={draft.brand ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, brand: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-packageQuantity">Wielkość opakowania</Label>
                  <Input
                    id="product-packageQuantity"
                    name="packageQuantity"
                    value={draft.packageQuantity ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, packageQuantity: event.target.value }))}
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-packageUnit">Jednostka opakowania</Label>
                  <select
                    id="product-packageUnit"
                    name="packageUnit"
                    value={draft.packageUnit ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, packageUnit: event.target.value }))}
                    className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Brak</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="l">l</option>
                    <option value="szt">szt</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="product-ingredientId">Powiązany składnik</Label>
                  <select
                    id="product-ingredientId"
                    name="ingredientId"
                    value={draft.ingredientId ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, ingredientId: event.target.value }))}
                    className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Brak</option>
                    {ingredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="product-imageUrl">Zdjęcie</Label>
                  <Input
                    id="product-imageUrl"
                    name="imageUrl"
                    value={draft.imageUrl ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, imageUrl: event.target.value }))}
                  />
                </div>
              </div>

              <fieldset className="space-y-3 rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">
                  Wartości odżywcze (na {currentBasis === "per100ml" ? "100 ml" : "100 g"})
                </legend>
                <div className="space-y-2">
                  <Label htmlFor="product-nutritionBasis">Podstawa danych</Label>
                  <select
                    id="product-nutritionBasis"
                    name="nutritionBasis"
                    value={draft.nutritionBasis ?? currentBasis}
                    onChange={(event) => setDraft((current) => ({ ...current, nutritionBasis: event.target.value }))}
                    className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="per100g">na 100 g</option>
                    <option value="per100ml">na 100 ml</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
                  {nutritionFields.map(([field, label]) => (
                    <div key={field} className="flex min-w-0 flex-col gap-1">
                      <Label htmlFor={field} className="leading-tight">
                        {label}
                      </Label>
                      <Input
                        id={field}
                        name={field}
                        type="number"
                        step="0.0001"
                        min="0"
                        inputMode="decimal"
                        className="h-10"
                        value={draft[field] ?? ""}
                        onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>

              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="verifiedByUser" value="true" defaultChecked={currentProduct?.verifiedByUser ?? false} />
                Dane zostały ręcznie sprawdzone
              </label>

              <div className="flex flex-wrap gap-2">
                <Button type="submit">Zapisz produkt</Button>
                <Button type="button" variant="outline" onClick={() => { setResult(null); setManualMode(false); }}>
                  Anuluj
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
