import { parse } from "csv-parse/sync";

export type CsvRow = Record<string, string>;

export class CsvParseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

export function normalizeCsvText(csvText: string): string {
  return csvText
    .replace(/^\uFEFF/, "")
    .replace(/Buy\/\s*\r?\n\s*Sell/g, "Buy/Sell")
    .replace(/,CA\s*\r?\n\s*SH(?=\r?\n|$)/g, ",CASH")
    .trim();
}

export function readCsvRows(csvText: string): CsvRow[] {
  const normalized = normalizeCsvText(csvText);

  if (normalized.length === 0) {
    return [];
  }

  try {
    return parse(normalized, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true
    }) as CsvRow[];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse CSV";
    throw new CsvParseError(message);
  }
}

export function readCsvHeaders(csvText: string): string[] {
  const normalized = normalizeCsvText(csvText);

  if (normalized.length === 0) {
    return [];
  }

  try {
    const rows = parse(normalized, {
      to_line: 1,
      skip_empty_lines: true,
      trim: true,
      bom: true
    }) as string[][];

    return rows[0] ?? [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse CSV headers";
    throw new CsvParseError(message);
  }
}
