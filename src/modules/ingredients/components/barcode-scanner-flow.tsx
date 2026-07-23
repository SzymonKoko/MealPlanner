"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Flashlight, ImageUp, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveImportedProductAction,
  quickAddScannedProductToPlanAction,
} from "../actions/barcode-actions";
import { BulkBarcodeScanner } from "./bulk-barcode-scanner";
import { decodeBarcodeImage } from "../lib/decode-barcode-image";

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

interface ExtendedCameraCapabilities extends MediaTrackCapabilities {
  focusMode?: string[];
  torch?: boolean;
  zoom?: { min: number; max: number; step: number };
}

interface ExtendedConstraintSet extends MediaTrackConstraintSet {
  focusMode?: string;
  zoom?: number;
}

function createBarcodeReader() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR,
    BarcodeFormat.RSS_14,
    BarcodeFormat.RSS_EXPANDED,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 80,
    delayBetweenScanSuccess: 500,
  });
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

function QuickPlanProductForm({
  product,
  candidate,
  returnTo,
}: {
  product?: LookupProduct;
  candidate?: LookupCandidate;
  returnTo: string;
}) {
  const source = product ?? candidate;
  if (!source) return null;
  const defaultUnit = source.nutritionBasis === "per100ml" ? "ml" : "g";
  return (
    <Card>
      <CardHeader><CardTitle>Dodaj produkt do planu</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium">{source.name}</p>
          {source.brand ? <p className="text-sm text-muted-foreground">{source.brand}</p> : null}
          <p className="mt-2 text-sm text-muted-foreground">
            {source.kcalPer100 ? `${source.kcalPer100} kcal` : "— kcal"}
            {" · "}B {source.proteinPer100 ?? "—"} · W {source.carbsPer100 ?? "—"} · T {source.fatPer100 ?? "—"}
            {" / "}{source.nutritionBasis === "per100ml" ? "100 ml" : "100 g"}
          </p>
        </div>
        <form action={quickAddScannedProductToPlanAction} className="space-y-4">
          <input type="hidden" name="returnTo" value={returnTo} />
          {product ? <input type="hidden" name="existingProductId" value={product.id} /> : null}
          <input type="hidden" name="barcode" value={source.barcode} />
          <input type="hidden" name="name" value={source.name} />
          <input type="hidden" name="brand" value={source.brand ?? ""} />
          <input type="hidden" name="packageQuantity" value={source.packageQuantity ?? ""} />
          <input type="hidden" name="packageUnit" value={source.packageUnit ?? ""} />
          <input type="hidden" name="imageUrl" value={source.imageUrl ?? ""} />
          <input type="hidden" name="nutritionBasis" value={source.nutritionBasis} />
          <input type="hidden" name="kcalPer100" value={source.kcalPer100 ?? ""} />
          <input type="hidden" name="proteinPer100" value={source.proteinPer100 ?? ""} />
          <input type="hidden" name="carbsPer100" value={source.carbsPer100 ?? ""} />
          <input type="hidden" name="fatPer100" value={source.fatPer100 ?? ""} />
          <input type="hidden" name="fiberPer100" value={source.fiberPer100 ?? ""} />
          <input type="hidden" name="saltPer100" value={source.saltPer100 ?? ""} />
          <input type="hidden" name="externalId" value={source.externalId ?? ""} />
          <input type="hidden" name="sourceUpdatedAt" value={source.sourceUpdatedAt ?? ""} />
          <input type="hidden" name="dataSource" value={source.dataSource} />
          <div className="flex gap-2">
            <label className="block flex-1 space-y-1 text-sm">
              <span className="text-muted-foreground">Ilość</span>
              <Input name="quantity" type="number" inputMode="decimal" min="0.1" step="any" defaultValue="100" required />
            </label>
            <label className="block w-28 space-y-1 text-sm">
              <span className="text-muted-foreground">Jednostka</span>
              <select name="unit" defaultValue={defaultUnit} className="h-11 w-full rounded-lg border bg-background px-2 text-base">
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="szt">szt</option>
                <option value="opakowanie">opakowanie</option>
              </select>
            </label>
          </div>
          <Button type="submit" className="w-full">
            Dodaj do planu
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

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
  returnTo,
}: {
  ingredients: IngredientOption[];
  initialBarcode?: string;
  initialRefresh?: boolean;
  returnTo?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastSentRef = useRef<string | null>(null);
  const lookupRequestRef = useRef(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState(initialBarcode ?? "");
  const [lookupBarcode, setLookupBarcode] = useState(initialBarcode ?? "");
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoom, setZoom] = useState(1);

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
    return () => {
      lookupRequestRef.current += 1;
      controlsRef.current?.stop();
      controlsRef.current = null;
      readerRef.current = null;
    };
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
    const requestId = ++lookupRequestRef.current;
    setLoading(true);
    setLookupError(null);
    setResult(null);
    setManualMode(false);
    try {
      const response = await fetch(
        `/api/products/barcode/${encodeURIComponent(barcode)}${refresh ? "?refresh=1" : ""}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as LookupResponse & { error?: string; message?: string };
      if (requestId !== lookupRequestRef.current) return;
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
      if (requestId !== lookupRequestRef.current) return;
      setResult(null);
      setLookupError(error instanceof Error ? error.message : "Nie udało się pobrać produktu");
    } finally {
      if (requestId === lookupRequestRef.current) setLoading(false);
    }
  }

  async function startCamera() {
    stopCamera();
    setCameraError(null);
    lastSentRef.current = null;
    setCameraActive(true);
    try {
      // The preview is rendered conditionally, so give React a frame to mount it
      // before ZXing tries to attach the camera stream.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const video = videoRef.current;
      if (!video) throw new Error("Brak elementu podglądu aparatu");
      readerRef.current = createBarcodeReader();
      controlsRef.current = await readerRef.current.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 60 },
          },
        },
        video,
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

      const capabilities = controlsRef.current.streamVideoCapabilitiesGet?.(
        (track) => [track],
      ) as ExtendedCameraCapabilities | undefined;
      const supportsContinuousFocus = capabilities?.focusMode?.includes("continuous") ?? false;
      if (supportsContinuousFocus) {
        controlsRef.current.streamVideoConstraintsApply?.({
          advanced: [{ focusMode: "continuous" } as ExtendedConstraintSet],
        });
      }
      setTorchAvailable(Boolean(capabilities?.torch && controlsRef.current.switchTorch));
      if (capabilities?.zoom && capabilities.zoom.max > capabilities.zoom.min) {
        const initialZoom = Math.max(capabilities.zoom.min, Math.min(1, capabilities.zoom.max));
        setZoomRange(capabilities.zoom);
        setZoom(initialZoom);
      } else {
        setZoomRange(null);
      }
    } catch {
      controlsRef.current?.stop();
      controlsRef.current = null;
      readerRef.current = null;
      setCameraError("Brak dostępu do aparatu albo tylna kamera nie jest dostępna.");
      setCameraActive(false);
    }
  }

  function stopCamera() {
    if (torchOn) {
      void controlsRef.current?.switchTorch?.(false).catch(() => undefined);
    }
    controlsRef.current?.stop();
    controlsRef.current = null;
    readerRef.current = null;
    setCameraActive(false);
    setTorchAvailable(false);
    setTorchOn(false);
    setZoomRange(null);
  }

  async function toggleTorch() {
    if (!controlsRef.current?.switchTorch) return;
    const next = !torchOn;
    try {
      await controlsRef.current.switchTorch(next);
      setTorchOn(next);
    } catch {
      setCameraError("Latarka nie jest dostępna w tej przeglądarce.");
    }
  }

  function changeZoom(next: number) {
    setZoom(next);
    controlsRef.current?.streamVideoConstraintsApply?.({
      advanced: [{ zoom: next } as ExtendedConstraintSet],
    });
  }

  async function scanImage(file: File) {
    setCameraError(null);
    setLookupError(null);
    try {
      const resultFromImage = await decodeBarcodeImage(createBarcodeReader(), file);
      const barcode = resultFromImage.getText();
      setManualBarcode(barcode);
      setLookupBarcode(barcode);
      stopCamera();
      await runLookup(barcode, false);
    } catch {
      setCameraError("Nie udało się odczytać kodu ze zdjęcia. Zrób ostrzejsze zdjęcie w dobrym świetle.");
    }
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
      {!returnTo ? <BulkBarcodeScanner /> : null}
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
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-lg border bg-black">
                <video
                  ref={videoRef}
                  className="aspect-[4/3] w-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                <div className="pointer-events-none absolute inset-x-[7%] top-1/2 h-[34%] -translate-y-1/2 rounded-lg border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
                <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white drop-shadow">
                  Ustaw cały kod w ramce — poziomo lub pionowo
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {torchAvailable ? (
                  <Button type="button" variant={torchOn ? "default" : "outline"} size="sm" onClick={() => void toggleTorch()}>
                    <Flashlight aria-hidden="true" />
                    {torchOn ? "Wyłącz latarkę" : "Latarka"}
                  </Button>
                ) : null}
                {zoomRange ? (
                  <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border px-3 text-sm">
                    <ZoomIn className="size-4 shrink-0" aria-hidden="true" />
                    <span className="sr-only">Zoom aparatu</span>
                    <input
                      type="range"
                      min={zoomRange.min}
                      max={zoomRange.max}
                      step={zoomRange.step || 0.1}
                      value={zoom}
                      onChange={(event) => changeZoom(Number(event.target.value))}
                      className="min-w-24 flex-1"
                    />
                    <span className="w-9 text-right tabular-nums">{zoom.toFixed(1)}×</span>
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-accent">
            <ImageUp className="size-4" aria-hidden="true" />
            Skanuj ze zdjęcia
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void scanImage(file);
                event.target.value = "";
              }}
            />
          </label>
          {cameraError ? <p className="text-sm text-destructive">{cameraError}</p> : null}
          {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}
          {loading ? <p className="text-sm text-muted-foreground">Szukam produktu...</p> : null}
        </CardContent>
      </Card>

      {result?.status === "local" && currentProduct && returnTo ? (
        <QuickPlanProductForm product={currentProduct} returnTo={returnTo} />
      ) : result?.status === "local" && currentProduct ? (
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

      {result?.status === "external" && currentCandidate && returnTo ? (
        <QuickPlanProductForm candidate={currentCandidate} returnTo={returnTo} />
      ) : (manualMode || result?.status === "external") ? (
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
              {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
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
