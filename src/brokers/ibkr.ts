import { readCsvRows } from "../csv.js";
import { parseIsoOrMmDdYyyy } from "../date.js";
import { humanizeError } from "../errors.js";
import { parseRequiredNumber } from "../number.js";
import { TradeSchema, type Trade, type TradeSide } from "../schema.js";
import type { BrokerParser, ParseResult, RowError } from "../types.js";

const BROKER_ID = "ibkr" as const;

export const ibkrParser: BrokerParser = {
  id: BROKER_ID,
  requiredHeaders: ["TradeID", "Symbol", "DateTime", "Buy/Sell", "Quantity", "TradePrice", "Currency"],
  parse(csvText: string): ParseResult {
    const rows = readCsvRows(csvText);
    const trades: Trade[] = [];
    const errors: RowError[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 1;

      try {
        const side = parseSide(row["Buy/Sell"] ?? "");
        const quantity = parseRequiredNumber(row.Quantity ?? "", "Quantity");
        const price = parseRequiredNumber(row.TradePrice ?? "", "Price");
        const executedAt = parseIsoOrMmDdYyyy(row.DateTime ?? "");

        if (!executedAt) {
          throw new Error(`Invalid DateTime: '${row.DateTime ?? ""}'`);
        }

        const trade = TradeSchema.parse({
          symbol: normalizeSymbol(row.Symbol ?? ""),
          side,
          quantity,
          price,
          totalAmount: side === "SELL" ? -(quantity * price) : quantity * price,
          currency: (row.Currency ?? "").trim().toUpperCase(),
          executedAt,
          broker: BROKER_ID,
          rawData: row
        });

        trades.push(trade);
      } catch (error) {
        errors.push({
          row: rowNumber,
          reason: humanizeError(error),
          rawData: row
        });
      }
    });

    return buildResult(trades, errors, rows.length);
  }
};

function parseSide(value: string): TradeSide {
  const normalized = value.trim().toUpperCase();

  if (normalized === "BOT") {
    return "BUY";
  }

  if (normalized === "SLD") {
    return "SELL";
  }

  throw new Error(`Invalid Buy/Sell value: '${value}'`);
}

function normalizeSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();

  if (/^[A-Z]{3}\.[A-Z]{3}$/.test(symbol)) {
    return symbol.replace(".", "/");
  }

  return symbol;
}

function buildResult(trades: Trade[], errors: RowError[], total: number): ParseResult {
  return {
    broker: BROKER_ID,
    trades,
    errors,
    summary: {
      total,
      valid: trades.length,
      skipped: errors.length
    }
  };
}
