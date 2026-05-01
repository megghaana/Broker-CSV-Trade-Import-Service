import { readCsvRows } from "../csv.js";
import { parseDdMmYyyy } from "../date.js";
import { parseRequiredNumber } from "../number.js";
import { TradeSchema } from "../schema.js";
import { humanizeError } from "../errors.js";
import type { BrokerParser, ParseResult, RowError } from "../types.js";
import type { Trade } from "../schema.js";

function inferCurrency(exchange: string): string {
  const upper = exchange.trim().toUpperCase();
  if (upper === "NSE" || upper === "BSE") return "INR";
  return "INR";
}

function parseSide(value: string): "BUY" | "SELL" {
  const upper = value.trim().toUpperCase();
  if (upper === "BUY") return "BUY";
  if (upper === "SELL") return "SELL";
  throw new Error(`Unknown trade side: '${value}'`);
}

export const zerodhaParser: BrokerParser = {
  id: "zerodha",

  requiredHeaders: ["symbol", "trade_date", "trade_type", "quantity", "price", "exchange", "segment"],

  parse(csvText: string): ParseResult {
    const rows = readCsvRows(csvText);
    const trades: Trade[] = [];
    const errors: RowError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNumber = i + 2;

      try {
        const rawDate = row["trade_date"] ?? "";
        const executedAt = parseDdMmYyyy(rawDate);
        if (executedAt === null) {
          throw new Error(`Invalid date: '${rawDate}'`);
        }

        const side = parseSide(row["trade_type"] ?? "");

        const quantity = parseRequiredNumber(row["quantity"] ?? "", "quantity");
        if (quantity <= 0) {
          throw new Error(`Quantity must be positive, got ${quantity}`);
        }

        const price = parseRequiredNumber(row["price"] ?? "", "price");

        const symbol = (row["symbol"] ?? "").trim();
        if (symbol.length === 0) {
          throw new Error("symbol is required");
        }

        const currency = inferCurrency(row["exchange"] ?? "");
        const totalAmount = side === "SELL" ? -(quantity * price) : quantity * price;

        const trade = TradeSchema.parse({
          symbol,
          side,
          quantity,
          price,
          totalAmount,
          currency,
          executedAt,
          broker: "zerodha",
          rawData: { ...row },
        });

        trades.push(trade);
      } catch (error) {
        errors.push({
          row: rowNumber,
          reason: humanizeError(error),
          rawData: { ...row },
        });
      }
    }

    return {
      broker: "zerodha",
      trades,
      errors,
      summary: {
        total: rows.length,
        valid: trades.length,
        skipped: errors.length,
      },
    };
  },
};
