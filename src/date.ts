export function parseDdMmYyyy(value: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return toIsoUtc(Number(year), Number(month), Number(day));
}

export function parseIsoOrMmDdYyyy(value: string): string | null {
  const trimmed = value.trim();
  const isoDate = new Date(trimmed);

  if (!Number.isNaN(isoDate.getTime()) && /^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    return isoDate.toISOString();
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const [, month, day, year] = match;
  return toIsoUtc(Number(year), Number(month), Number(day));
}

function toIsoUtc(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}
