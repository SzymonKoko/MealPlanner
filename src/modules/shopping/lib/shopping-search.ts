export interface ShoppingSearchItem {
  name: string;
  categoryName: string;
  notes: string | null;
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("pl").replace(/ł/g, "l").normalize("NFD").replace(/\p{M}/gu, "");
}

export function matchesShoppingQuery(item: ShoppingSearchItem, query: string) {
  const normalized = normalizeSearch(query);
  if (!normalized) return true;
  return [item.name, item.categoryName, item.notes ?? ""].some((value) => normalizeSearch(value).includes(normalized));
}
