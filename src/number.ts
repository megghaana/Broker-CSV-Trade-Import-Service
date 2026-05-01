export function parseRequiredNumber(value: string, fieldName: string): number {
  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);

  if (normalized.length === 0 || Number.isNaN(parsed)) {
    throw new Error(`${fieldName} must be a number, got '${value}'`);
  }

  return parsed;
}

// Use this for optional numeric fields (e.g. IBKR Commission)
// Returns null if empty, throws if present but unparseable
export function parseOptionalNumber(
  value: string | undefined,
  fieldName: string
): number | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);

  if (Number.isNaN(parsed)) {
    throw new Error(`${fieldName} must be a number if provided, got '${value}'`);
  }

  return parsed;
}