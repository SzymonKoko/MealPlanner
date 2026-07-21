/** Only allow in-app relative redirects to the meal planner. */
export function sanitizePlanReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed !== "/plan" && !trimmed.startsWith("/plan?")) return null;
  if (trimmed.startsWith("//")) return null;
  return trimmed;
}

export function parsePlanReturnTarget(value: string | null | undefined) {
  const returnTo = sanitizePlanReturnTo(value);
  if (!returnTo) return null;
  const url = new URL(returnTo, "https://mealplanner.local");
  const date = url.searchParams.get("day");
  const mealType = url.searchParams.get("pick");
  const scope = url.searchParams.get("scope") === "household" ? "household" as const : "mine" as const;
  if (!date?.match(/^\d{4}-\d{2}-\d{2}$/)) return null;
  if (!mealType || !["breakfast", "secondBreakfast", "lunch", "snack", "dinner"].includes(mealType)) {
    return null;
  }
  return {
    returnTo,
    date,
    mealType: mealType as "breakfast" | "secondBreakfast" | "lunch" | "snack" | "dinner",
    scope,
  };
}

export function finishPlanReturnUrl(value: string) {
  const url = new URL(value, "https://mealplanner.local");
  url.searchParams.delete("pick");
  return `${url.pathname}?${url.searchParams.toString()}`;
}
