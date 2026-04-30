import type { Trade } from "./schema.js";

export type BrokerId = "zerodha" | "ibkr";

export interface RowError {
  row: number;
  reason: string;
  rawData?: Record<string, unknown>;
}

export interface ParseResult {
  broker: BrokerId;
  trades: Trade[];
  errors: RowError[];
  summary: {
    total: number;
    valid: number;
    skipped: number;
  };
}

export interface BrokerParser {
  id: BrokerId;
  requiredHeaders: readonly string[];
  parse(csvText: string): ParseResult;
}
