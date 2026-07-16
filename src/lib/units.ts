export const SUPPORTED_UNITS = ["g", "kg", "ml", "l", "szt"] as const;
export type SupportedUnit = (typeof SUPPORTED_UNITS)[number];

const TO_GRAMS: Record<SupportedUnit, number | null> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  szt: null,
};

export function convertToBaseUnit(
  quantity: number,
  unit: string,
  baseUnit: string,
  densityGramsPerMl?: number | null,
): number | null {
  const from = unit as SupportedUnit;
  const to = baseUnit as SupportedUnit;

  if (from === to) return quantity;

  const fromFactor = TO_GRAMS[from];
  const toFactor = TO_GRAMS[to];

  if (fromFactor == null || toFactor == null) return null;

  const fromIsMass = from === "g" || from === "kg";
  const toIsMass = to === "g" || to === "kg";
  const fromIsVolume = from === "ml" || from === "l";
  const toIsVolume = to === "ml" || to === "l";

  if (fromIsMass && toIsVolume) {
    if (!densityGramsPerMl || densityGramsPerMl <= 0) return null;
    const grams = quantity * fromFactor;
    const milliliters = grams / densityGramsPerMl;
    return milliliters / toFactor;
  }
  if (fromIsVolume && toIsMass) {
    if (!densityGramsPerMl || densityGramsPerMl <= 0) return null;
    const milliliters = quantity * fromFactor;
    const grams = milliliters * densityGramsPerMl;
    return grams / toFactor;
  }

  return (quantity * fromFactor) / toFactor;
}

export function addQuantities(
  a: { quantity: number; unit: string },
  b: { quantity: number; unit: string },
): { quantity: number; unit: string } | null {
  if (a.unit === b.unit) {
    return { quantity: a.quantity + b.quantity, unit: a.unit };
  }

  const converted = convertToBaseUnit(b.quantity, b.unit, a.unit);
  if (converted === null) return null;

  return { quantity: a.quantity + converted, unit: a.unit };
}
