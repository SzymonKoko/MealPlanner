export function safeInternalRedirect(value: string | undefined, fallback = "/today") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
