import { readCsvRows } from "../csv.js";
import { parseDdMmYyyy } from "../date.js";
import { humanizeError } from "../errors.js";
import { parseRequiredNumber } from "../number.js";
import { TradeSchema, type Trade, type TradeSide } from "../schema.js";
import type { BrokerParser, ParseResult, RowError } from "../types.js";

const BROKER_ID = "zerodha" as const;

export const zerodhaParser: BrokerParser = {
  id: BROKER_ID,
  requiredHeaders: ["symbol", "trade_date", "trade_type", "quantity", "price", "exchange"],
  parse(csvText: string): ParseResult {
    const rows = readCsvRows(csvText);
    const trades: Trade[] = [];
    const errors: RowError[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 1;

      try {
        const symbol = row.symbol?.trim();
        const side = parseSide(row.trade_type ?? "");
        const quantity = parseRequiredNumber(row.quantity ?? "", "Quantity");
        const price = parseRequiredNumber(row.price ?? "", "Price");
        const executedAt = parseDdMmYyyy(row.trade_date ?? "");

        if (!executedAt) {
          throw new Error(`Invalid date: '${row.trade_date ?? ""}'`);
        }

        const trade = TradeSchema.parse({
          symbol,
          side,
          quantity,
          price,
          totalAmount: side === "SELL" ? -(quantity * price) : quantity * price,
          currency: inferCurrency(row.exchange ?? ""),
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

  if (normalized === "BUY" || normalized === "SELL") {
    return normalized;
  }

  throw new Error(`Invalid trade_type: '${value}'`);
}

function inferCurrency(exchange: string): string {
  const normalized = exchange.trim().toUpperCase();

  if (normalized === "NSE" || normalized === "BSE") {
    return "INR";
  }

  throw new Error(`Cannot infer currency from exchange: '${exchange}'`);
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
