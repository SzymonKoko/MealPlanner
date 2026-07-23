"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Camera, Images, Loader2, ScanBarcode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { approveImportedProductAction } from "../actions/barcode-actions";

interface ProductSource {
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
  dataSource: string;
  externalId: string | null;
  sourceUpdatedAt: string | null;
  id?: string;
}

interface LookupResponse {
  status: "local" | "external" | "not_found";
  product?: ProductSource;
  candidate?: ProductSource;
}

interface BatchItem {
  key: string;
  fileName: string;
  barcode?: string;
  source?: ProductSource;
  status: "reading" | "ready" | "existing" | "not_found" | "error" | "adding" | "added";
  message?: string;
}

function createReader() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 80,
    delayBetweenScanSuccess: 500,
  });
}

async function lookupBarcode(barcode: string): Promise<LookupResponse> {
  const response = await fetch(`/api/products/barcode/${encodeURIComponent(barcode)}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as LookupResponse & { message?: string };
  if (response.status === 404 && payload.status === "not_found") return payload;
  if (!response.ok) throw new Error(payload.message ?? "Nie udało się wyszukać produktu");
  return payload;
}

function getSource(result: LookupResponse): ProductSource | undefined {
  return result.product ?? result.candidate;
}

function productFormData(source: ProductSource) {
  const formData = new FormData();
  if (source.id) formData.set("existingProductId", source.id);
  formData.set("barcode", source.barcode);
  formData.set("name", source.name);
  formData.set("brand", source.brand ?? "");
  formData.set("packageQuantity", source.packageUnit ? source.packageQuantity ?? "" : "");
  formData.set("packageUnit", source.packageUnit ?? "");
  formData.set("imageUrl", source.imageUrl ?? "");
  formData.set("nutritionBasis", source.nutritionBasis);
  formData.set("kcalPer100", source.kcalPer100 ?? "");
  formData.set("proteinPer100", source.proteinPer100 ?? "");
  formData.set("carbsPer100", source.carbsPer100 ?? "");
  formData.set("fatPer100", source.fatPer100 ?? "");
  formData.set("fiberPer100", source.fiberPer100 ?? "");
  formData.set("saltPer100", source.saltPer100 ?? "");
  formData.set("externalId", source.externalId ?? "");
  formData.set("sourceUpdatedAt", source.sourceUpdatedAt ?? "");
  formData.set("dataSource", source.dataSource);
  formData.set("verifiedByUser", "false");
  formData.set("originalNutritionBasis", source.nutritionBasis);
  formData.set("originalKcalPer100", source.kcalPer100 ?? "");
  formData.set("originalProteinPer100", source.proteinPer100 ?? "");
  formData.set("originalCarbsPer100", source.carbsPer100 ?? "");
  formData.set("originalFatPer100", source.fatPer100 ?? "");
  formData.set("originalFiberPer100", source.fiberPer100 ?? "");
  formData.set("originalSaltPer100", source.saltPer100 ?? "");
  return formData;
}

export function BulkBarcodeScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const blockedBarcodeRef = useRef<string | null>(null);
  const lookupInProgressRef = useRef(false);
  const popupOpenRef = useRef(false);
  const [mode, setMode] = useState<"closed" | "camera" | "images">("closed");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ barcode: string; source?: ProductSource; error?: string } | null>(null);
  const [addingCurrent, setAddingCurrent] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [processingImages, setProcessingImages] = useState(false);
  const [addingBatch, setAddingBatch] = useState(false);

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }

  useEffect(() => () => stopCamera(), []);

  async function startContinuousCamera() {
    stopCamera();
    setMode("camera");
    setCameraError(null);
    blockedBarcodeRef.current = null;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      if (!videoRef.current) throw new Error("Brak podglądu aparatu");
      controlsRef.current = await createReader().decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        videoRef.current,
        (decoded, error) => {
          if (decoded) void handleContinuousCode(decoded.getText());
          else if (error && error.name !== "NotFoundException") {
            setCameraError("Nie udało się odczytać kodu.");
          }
        },
      );
    } catch {
      stopCamera();
      setCameraError("Brak dostępu do aparatu albo tylna kamera nie jest dostępna.");
    }
  }

  async function handleContinuousCode(barcode: string) {
    if (lookupInProgressRef.current || popupOpenRef.current) return;
    if (blockedBarcodeRef.current === barcode) return;
    blockedBarcodeRef.current = barcode;
    lookupInProgressRef.current = true;
    popupOpenRef.current = true;
    try {
      const result = await lookupBarcode(barcode);
      const source = getSource(result);
      setCurrent(source
        ? { barcode, source }
        : { barcode, error: "Nie znaleziono produktu w bazie." });
    } catch (error) {
      setCurrent({
        barcode,
        error: error instanceof Error ? error.message : "Nie udało się wyszukać produktu.",
      });
    } finally {
      lookupInProgressRef.current = false;
    }
  }

  function closeCurrent() {
    popupOpenRef.current = false;
    setCurrent(null);
  }

  async function addCurrent() {
    if (!current?.source) return;
    setAddingCurrent(true);
    try {
      if (!current.source.id) {
        await approveImportedProductAction(productFormData(current.source));
      }
      setAddedCount((count) => count + 1);
      toast.success(`Dodano „${current.source.name}”`);
      closeCurrent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się dodać produktu");
    } finally {
      setAddingCurrent(false);
    }
  }

  async function readImages(files: File[]) {
    if (!files.length) return;
    setMode("images");
    setProcessingImages(true);
    const initial = files.map((file, index) => ({
      key: `${file.name}-${file.lastModified}-${index}`,
      fileName: file.name,
      status: "reading" as const,
    }));
    setBatch(initial);

    const completed: BatchItem[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const item = initial[index];
      const url = URL.createObjectURL(file);
      let next: BatchItem;
      try {
        const decoded = await createReader().decodeFromImageUrl(url);
        const barcode = decoded.getText();
        if (seen.has(barcode)) {
          next = { ...item, barcode, status: "error", message: "Ten kod występuje już w paczce." };
        } else {
          seen.add(barcode);
          const result = await lookupBarcode(barcode);
          const source = getSource(result);
          next = source
            ? {
                ...item,
                barcode,
                source,
                status: source.id ? "existing" : "ready",
                message: source.id ? "Produkt już istnieje w lokalnej bazie." : undefined,
              }
            : { ...item, barcode, status: "not_found", message: "Nie znaleziono produktu w bazie." };
        }
      } catch (error) {
        next = {
          ...item,
          status: "error",
          message: error instanceof Error ? error.message : "Nie udało się odczytać kodu.",
        };
      } finally {
        URL.revokeObjectURL(url);
      }
      completed.push(next);
      setBatch([...completed, ...initial.slice(index + 1)]);
    }
    setProcessingImages(false);
  }

  async function addAll() {
    const readyItems = batch.filter((item) => item.status === "ready" && item.source);
    setAddingBatch(true);
    for (const item of readyItems) {
      setBatch((items) => items.map((candidate) => candidate.key === item.key
        ? { ...candidate, status: "adding" }
        : candidate));
      try {
        if (!item.source!.id) {
          await approveImportedProductAction(productFormData(item.source!));
        }
        setBatch((items) => items.map((candidate) => candidate.key === item.key
          ? { ...candidate, status: "added" }
          : candidate));
      } catch (error) {
        setBatch((items) => items.map((candidate) => candidate.key === item.key
          ? {
              ...candidate,
              status: "error",
              message: error instanceof Error ? error.message : "Nie udało się dodać produktu.",
            }
          : candidate));
      }
    }
    setAddingBatch(false);
    toast.success("Zakończono zbiorcze dodawanie produktów");
  }

  if (mode === "closed") {
    return (
      <Card>
        <CardHeader><CardTitle>Dodawanie zbiorowe</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Button type="button" className="h-auto justify-start gap-3 py-4 text-left" onClick={() => void startContinuousCamera()}>
            <ScanBarcode className="size-5 shrink-0" />
            <span>
              <span className="block">Skanuj jeden po drugim</span>
              <span className="block text-xs font-normal opacity-85">Aparat pozostaje włączony</span>
            </span>
          </Button>
          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-accent">
            <Images className="size-5 shrink-0" />
            <span>
              <span className="block">Dodaj zdjęcia kodów</span>
              <span className="block text-xs font-normal text-muted-foreground">Wybierz kilka lub kilkanaście zdjęć</span>
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(event) => {
                void readImages(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </label>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>{mode === "camera" ? "Skanowanie ciągłe" : "Kody ze zdjęć"}</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={() => {
          stopCamera();
          setMode("closed");
        }}>
          Zakończ
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === "camera" ? (
          <>
            <div className="relative overflow-hidden rounded-lg border bg-black">
              <video ref={videoRef} className="aspect-[4/3] w-full object-cover" autoPlay muted playsInline />
              <div className="pointer-events-none absolute inset-x-[7%] top-1/2 h-[34%] -translate-y-1/2 rounded-lg border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
              <p className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white">
                Kamera pozostaje włączona · dodano: {addedCount}
              </p>
            </div>
            {cameraError ? <p className="text-sm text-destructive">{cameraError}</p> : null}
          </>
        ) : (
          <>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-medium hover:bg-accent">
              <Images className="size-4" />
              Wybierz inne zdjęcia
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(event) => {
                  void readImages(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </label>
            <div className="space-y-2">
              {batch.map((item) => (
                <div key={item.key} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  {item.status === "reading" || item.status === "adding"
                    ? <Loader2 className="size-4 shrink-0 animate-spin" />
                    : item.status === "added" || item.status === "existing"
                      ? <span className="text-green-600">✓</span>
                      : <Camera className="size-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.source?.name ?? item.fileName}</p>
                    <p className={item.status === "error" || item.status === "not_found"
                      ? "text-xs text-destructive"
                      : "text-xs text-muted-foreground"}>
                      {item.message ?? item.barcode ?? "Odczytuję kod…"}
                    </p>
                  </div>
                  {item.status !== "adding" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={`Usuń ${item.fileName}`}
                      onClick={() => setBatch((items) => items.filter((candidate) => candidate.key !== item.key))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={processingImages || addingBatch || !batch.some((item) => item.status === "ready")}
              onClick={() => void addAll()}
            >
              {processingImages
                ? "Rozpoznaję zdjęcia…"
                : addingBatch
                  ? "Dodaję produkty…"
                  : `Dodaj znalezione (${batch.filter((item) => item.status === "ready").length})`}
            </Button>
          </>
        )}
      </CardContent>

      <Dialog open={Boolean(current)} onOpenChange={(open) => {
        if (!open && !addingCurrent) closeCurrent();
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Zeskanowany produkt</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            {current?.source ? (
              <>
                <div>
                  <p className="text-lg font-semibold">{current.source.name}</p>
                  {current.source.brand ? <p className="text-sm text-muted-foreground">{current.source.brand}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">Kod: {current.barcode}</p>
                  {current.source.id ? (
                    <p className="mt-3 rounded-lg border border-green-600/30 bg-green-600/10 p-3 text-sm text-green-700">
                      Ten produkt już istnieje w lokalnej bazie.
                    </p>
                  ) : null}
                </div>
                {current.source.id ? (
                  <Button type="button" className="w-full" onClick={closeCurrent}>
                    Skanuj dalej
                  </Button>
                ) : <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" disabled={addingCurrent} onClick={closeCurrent}>
                    Pomiń
                  </Button>
                  <Button type="button" className="flex-1" disabled={addingCurrent} onClick={() => void addCurrent()}>
                    {addingCurrent ? "Dodaję…" : "Dodaj"}
                  </Button>
                </div>}
              </>
            ) : (
              <>
                <p className="text-sm text-destructive">{current?.error}</p>
                <p className="text-xs text-muted-foreground">Kod: {current?.barcode}</p>
                <Button type="button" className="w-full" onClick={closeCurrent}>Skanuj dalej</Button>
              </>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
