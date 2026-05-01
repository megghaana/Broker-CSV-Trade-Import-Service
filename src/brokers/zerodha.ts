import { readCsvRows } from "../csv.js";
import { parseDdMmYyyy } from "../date.js";
import { parseRequiredNumber } from "../number.js";
import { TradeSchema } from "../schema.js";
import { humanizeError } from "../error.js";
import type { BrokerParser, ParseResult, RowError } from "../types.js";
import type { Trade } from "../schema.js";

// Infer currency from Indian exchange identifiers.
// NSE and BSE always settle in INR — it is never present in the CSV.
function inferCurrency(exchange: string): string {
  const upper = exchange.trim().toUpperCase();
  if (upper === "NSE" || upper === "BSE") return "INR";
  return "INR"; // default for unknown Indian exchanges
}

// Normalise side: Zerodha uses lowercase "buy"/"sell" but row 5 has "SELL"
function parseSide(value: string): "BUY" | "SELL" {
  const upper = value.trim().toUpperCase();
  if (upper === "BUY") return "BUY";
  if (upper === "SELL") return "SELL";
  throw new Error(`Unknown trade side: '${value}'`);
}

export const zerodhaParser: BrokerParser = {
  id: "zerodha",

  // These are the columns that uniquely identify a Zerodha CSV.
  // "isin" and "segment" are not in IBKR, so this set is unambiguous.
  requiredHeaders: ["symbol", "trade_date", "trade_type", "quantity", "price", "exchange", "segment"],

  parse(csvText: string): ParseResult {
    const rows = readCsvRows(csvText);
    const trades: Trade[] = [];
    const errors: RowError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      // row index in error messages is 1-based and skips the header row
      const rowNumber = i + 2;

      try {
        // --- Date ---
        const rawDate = row["trade_date"] ?? "";
        const executedAt = parseDdMmYyyy(rawDate);
        if (executedAt === null) {
          throw new Error(`Invalid date: '${rawDate}'`);
        }

        // --- Side ---
        const side = parseSide(row["trade_type"] ?? "");

        // --- Quantity (must be positive) ---
        const quantity = parseRequiredNumber(row["quantity"] ?? "", "quantity");
        if (quantity <= 0) {
          throw new Error(`Quantity must be positive, got ${quantity}`);
        }

        // --- Price ---
        const price = parseRequiredNumber(row["price"] ?? "", "price");

        // --- Symbol ---
        const symbol = (row["symbol"] ?? "").trim();
        if (symbol.length === 0) {
          throw new Error("symbol is required");
        }

        // --- Currency (inferred, never in CSV) ---
        const currency = inferCurrency(row["exchange"] ?? "");

        // --- totalAmount: negative for sells, positive for buys ---
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