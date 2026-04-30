export function parseRequiredNumber(value: string, fieldName: string): number {
  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);

  if (normalized.length === 0 || Number.isNaN(parsed)) {
    throw new Error(`${fieldName} must be a number, got '${value}'`);
  }

  return parsed;
}
