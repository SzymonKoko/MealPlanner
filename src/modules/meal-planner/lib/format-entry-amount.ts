export function formatPlanEntryAmount(entry: {
  sourceType?: "recipe" | "ingredient" | "product";
  recipeId?: string | null;
  servings: number;
  quantity?: number | string | null;
  unit?: string | null;
}): string {
  const isRecipe = entry.sourceType === "recipe" || (entry.recipeId != null && !entry.sourceType);
  if (isRecipe) {
    return entry.servings === 1 ? "1 porcja" : `${entry.servings} porcji`;
  }
  const quantity =
    entry.quantity != null ? Number.parseFloat(String(entry.quantity)) : entry.servings * 100;
  const unit = entry.unit ?? "g";
  const formatted = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);
  return `${formatted} ${unit}`;
}
