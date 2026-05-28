export function num(value: string | undefined, fallback: number): number {
  if (value == null || value === "") return fallback;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function str(value: string | undefined, fallback: string): string {
  return value == null || value === "" ? fallback : value;
}
