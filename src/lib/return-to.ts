/** Only allow in-app relative redirects to the meal planner. */
export function sanitizePlanReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/plan")) return null;
  if (trimmed.startsWith("//")) return null;
  return trimmed;
}
