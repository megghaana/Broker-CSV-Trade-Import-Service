import { CsvParseError } from "./csv.js";
import { detectBroker, UnknownBrokerError } from "./detect.js";
import type { ParseResult } from "./types.js";

export class ImportError extends Error {
  public readonly statusCode: number;

  public constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ImportError";
    this.statusCode = statusCode;
  }
}

export function importTrades(csvText: string): ParseResult {
  try {
    const parser = detectBroker(csvText);
    return parser.parse(csvText);
  } catch (error) {
    if (error instanceof UnknownBrokerError || error instanceof CsvParseError) {
      throw new ImportError(error.message, 400);
    }

    throw error;
  }
}
