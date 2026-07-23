import type { BrowserMultiFormatReader } from "@zxing/browser";
import type { Result } from "@zxing/library";

interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nie udało się otworzyć zdjęcia."));
    image.src = url;
  });
}

function imageCrops(width: number, height: number): Crop[] {
  const crops: Crop[] = [{ x: 0, y: 0, width, height }];

  // Screenshots and label exports often contain text beside a relatively small
  // barcode. Overlapping crops let ZXing focus on that region without requiring
  // the user to crop the image manually.
  if (width > height * 1.8) {
    crops.push(
      { x: width * 0.3, y: 0, width: width * 0.7, height },
      { x: 0, y: 0, width: width * 0.7, height },
      { x: width * 0.2, y: 0, width: width * 0.6, height },
    );
  }
  if (height > width * 1.8) {
    crops.push(
      { x: 0, y: height * 0.3, width, height: height * 0.7 },
      { x: 0, y: 0, width, height: height * 0.7 },
      { x: 0, y: height * 0.2, width, height: height * 0.6 },
    );
  }
  return crops;
}

function renderCrop(image: HTMLImageElement, crop: Crop, highContrast: boolean) {
  const scale = Math.min(
    8,
    Math.max(2, 1000 / crop.width, 360 / crop.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.width * scale);
  canvas.height = Math.round(crop.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Przeglądarka nie obsługuje analizy zdjęć.");

  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  if (highContrast) context.filter = "grayscale(1) contrast(2)";
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

export async function decodeBarcodeImage(
  reader: BrowserMultiFormatReader,
  file: File,
): Promise<Result> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    let lastError: unknown;
    for (const crop of imageCrops(image.naturalWidth, image.naturalHeight)) {
      for (const highContrast of [false, true]) {
        try {
          return reader.decodeFromCanvas(renderCrop(image, crop, highContrast));
        } catch (error) {
          lastError = error;
        }
      }
    }
    throw lastError ?? new Error("Nie wykryto kodu kreskowego.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
