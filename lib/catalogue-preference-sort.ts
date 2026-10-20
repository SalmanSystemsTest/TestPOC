/** Preferred values first (in saved order), then the rest A–Z. */
export function sortByBuyerPreference(
  options: string[],
  preferred: string[] | null | undefined
): string[] {
  if (!preferred?.length) {
    return [...options].sort((a, b) => a.localeCompare(b));
  }
  const preferredSet = new Set(preferred);
  const top = preferred.filter((entry) => options.includes(entry));
  const rest = options
    .filter((entry) => !preferredSet.has(entry))
    .sort((a, b) => a.localeCompare(b));
  return [...top, ...rest];
}
