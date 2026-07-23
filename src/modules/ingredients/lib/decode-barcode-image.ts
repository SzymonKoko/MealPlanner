import type { BrowserMultiFormatReader } from "@zxing/browser";

export interface DecodedBarcode {
  getText(): string;
}

interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NativeDetectedBarcode {
  rawValue: string;
}

interface NativeBarcodeDetector {
  detect(source: ImageBitmapSource): Promise<NativeDetectedBarcode[]>;
}

interface NativeBarcodeDetectorConstructor {
  new(options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?(): Promise<string[]>;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nie udało się otworzyć zdjęcia."));
    image.src = url;
  });
}

function addCrop(crops: Crop[], crop: Crop) {
  if (crop.width >= 40 && crop.height >= 40) crops.push(crop);
}

function imageCrops(width: number, height: number): Crop[] {
  const crops: Crop[] = [{ x: 0, y: 0, width, height }];

  // Three overlapping bands catch small barcodes surrounded by labels or
  // packaging. Four overlapping quadrants cover codes placed near a corner.
  if (width >= height) {
    addCrop(crops, { x: 0, y: 0, width: width * 0.6, height });
    addCrop(crops, { x: width * 0.2, y: 0, width: width * 0.6, height });
    addCrop(crops, { x: width * 0.4, y: 0, width: width * 0.6, height });
  } else {
    addCrop(crops, { x: 0, y: 0, width, height: height * 0.6 });
    addCrop(crops, { x: 0, y: height * 0.2, width, height: height * 0.6 });
    addCrop(crops, { x: 0, y: height * 0.4, width, height: height * 0.6 });
  }
  for (const y of [0, 0.35]) {
    for (const x of [0, 0.35]) {
      addCrop(crops, {
        x: width * x,
        y: height * y,
        width: width * 0.65,
        height: height * 0.65,
      });
    }
  }
  return crops;
}

type ImageMode = "normal" | "contrast" | "binary" | "inverted";

function renderCrop(
  image: HTMLImageElement,
  crop: Crop,
  rotation: 0 | 90 | 270,
  mode: ImageMode,
) {
  // Downscale huge camera photos to control memory, but enlarge tiny labels.
  const scale = Math.min(4, 1600 / crop.width, 1100 / crop.height);
  const sourceWidth = Math.max(1, Math.round(crop.width * scale));
  const sourceHeight = Math.max(1, Math.round(crop.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = rotation === 0 ? sourceWidth : sourceHeight;
  canvas.height = rotation === 0 ? sourceHeight : sourceWidth;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Przeglądarka nie obsługuje analizy zdjęć.");

  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  if (mode === "contrast") context.filter = "grayscale(1) contrast(2.2)";
  if (rotation === 90) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  } else if (rotation === 270) {
    context.translate(0, canvas.height);
    context.rotate(-Math.PI / 2);
  }
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );

  if (mode === "binary" || mode === "inverted") {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const luminance =
        pixels.data[index] * 0.299 +
        pixels.data[index + 1] * 0.587 +
        pixels.data[index + 2] * 0.114;
      const black = mode === "inverted" ? luminance >= 150 : luminance < 150;
      const value = black ? 0 : 255;
      pixels.data[index] = value;
      pixels.data[index + 1] = value;
      pixels.data[index + 2] = value;
      pixels.data[index + 3] = 255;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.putImageData(pixels, 0, 0);
  }
  return canvas;
}

function nativeDetector(): NativeBarcodeDetector | null {
  const Detector = (globalThis as typeof globalThis & {
    BarcodeDetector?: NativeBarcodeDetectorConstructor;
  }).BarcodeDetector;
  if (!Detector) return null;
  try {
    return new Detector({
      formats: [
        "ean_13",
        "ean_8",
        "upc_a",
        "upc_e",
        "code_128",
        "code_39",
        "itf",
        "codabar",
      ],
    });
  } catch {
    return new Detector();
  }
}

async function tryNative(
  detector: NativeBarcodeDetector | null,
  source: ImageBitmapSource,
): Promise<DecodedBarcode | null> {
  if (!detector) return null;
  try {
    const [result] = await detector.detect(source);
    return result?.rawValue ? { getText: () => result.rawValue } : null;
  } catch {
    return null;
  }
}

export async function decodeBarcodeImage(
  reader: BrowserMultiFormatReader,
  file: File,
): Promise<DecodedBarcode> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const detector = nativeDetector();
    const nativeOriginal = await tryNative(detector, image);
    if (nativeOriginal) return nativeOriginal;

    let lastError: unknown;
    for (const crop of imageCrops(image.naturalWidth, image.naturalHeight)) {
      for (const rotation of [0, 90, 270] as const) {
        for (const mode of ["normal", "contrast", "binary", "inverted"] as const) {
          const canvas = renderCrop(image, crop, rotation, mode);
          const nativeResult = await tryNative(detector, canvas);
          if (nativeResult) return nativeResult;
          try {
            return reader.decodeFromCanvas(canvas);
          } catch (error) {
            lastError = error;
          }
        }
      }
      // Keep the interface responsive while processing several large crops.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    throw lastError ?? new Error("Nie wykryto kodu kreskowego.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
