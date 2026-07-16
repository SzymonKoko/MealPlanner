import type {
  NutritionBasis,
  NutritionDataSource,
} from "@/db/schema/ingredients";

export interface NutritionRecord {
  nutritionBasis: NutritionBasis;
  kcalPer100?: string | null;
  proteinPer100?: string | null;
  carbsPer100?: string | null;
  fatPer100?: string | null;
  fiberPer100?: string | null;
  saltPer100?: string | null;
}

export interface NutritionSourceState extends NutritionRecord {
  dataSource: NutritionDataSource;
  externalId?: string | null;
  importedAt?: Date | null;
  sourceUpdatedAt?: Date | null;
  verifiedByUser: boolean;
  manuallyModified: boolean;
}

const nutritionKeys: Array<keyof NutritionRecord> = [
  "nutritionBasis",
  "kcalPer100",
  "proteinPer100",
  "carbsPer100",
  "fatPer100",
  "fiberPer100",
  "saltPer100",
];

function normalized(value: unknown) {
  return value == null || value === "" ? null : String(value);
}

export function hasNutritionChanged(
  current: NutritionRecord,
  next: NutritionRecord,
) {
  return nutritionKeys.some((key) => normalized(current[key]) !== normalized(next[key]));
}

export function markManualNutritionUpdate(
  current: NutritionSourceState,
  next: NutritionRecord,
) {
  const changed = hasNutritionChanged(current, next);
  return {
    manuallyModified: current.manuallyModified || changed,
    dataSource:
      changed && current.dataSource !== "manual"
        ? ("household_override" as const)
        : current.dataSource,
  };
}

export function mergeExternalNutrition(
  current: NutritionSourceState,
  incoming: NutritionRecord & {
    dataSource: Exclude<NutritionDataSource, "manual" | "household_override">;
    externalId: string;
    sourceUpdatedAt?: Date | null;
  },
  importedAt = new Date(),
): NutritionSourceState {
  if (current.manuallyModified) return current;
  return {
    ...current,
    ...incoming,
    importedAt,
    sourceUpdatedAt: incoming.sourceUpdatedAt ?? importedAt,
    verifiedByUser: false,
    manuallyModified: false,
  };
}
