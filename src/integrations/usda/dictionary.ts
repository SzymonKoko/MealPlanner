const POLISH_TO_ENGLISH: Record<string, string> = {
  "pierś z kurczaka": "chicken breast",
  "ryż biały": "white rice",
  "mąka pszenna": "wheat flour",
  "ziemniaki": "potatoes",
  "jajko": "egg",
  "banan": "banana",
  "oliwa": "olive oil",
  "marchew": "carrot",
};

export function translateIngredientQuery(query: string) {
  const normalized = query.trim().toLocaleLowerCase("pl");
  return POLISH_TO_ENGLISH[normalized] ?? query.trim();
}
