export const SUPPORTED_UNITS = ["g", "kg", "ml", "l", "szt"] as const;
export type SupportedUnit = (typeof SUPPORTED_UNITS)[number];

const TO_GRAMS: Record<SupportedUnit, number | null> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  szt: null,
};

export function convertToBaseUnit(quantity: number, unit: string, baseUnit: string): number | null {
  const from = unit as SupportedUnit;
  const to = baseUnit as SupportedUnit;

  if (from === to) return quantity;

  const fromFactor = TO_GRAMS[from];
  const toFactor = TO_GRAMS[to];

  if (fromFactor === null || toFactor === null) return null;

  if ((from === "g" || from === "kg") && (to === "ml" || to === "l")) return null;
  if ((from === "ml" || from === "l") && (to === "g" || to === "kg")) return null;

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
