import { readCsvRows } from "../csv.js";
import { parseIsoOrMmDdYyyy } from "../date.js";
import { parseRequiredNumber, parseOptionalNumber } from "../number.js";
import { TradeSchema } from "../schema.js";
import { humanizeError } from "../errors.js";
import type { BrokerParser, ParseResult, RowError } from "../types.js";
import type { Trade } from "../schema.js";

function parseSide(value: string): "BUY" | "SELL" {
  const upper = value.trim().toUpperCase();
  if (upper === "BOT") return "BUY";
  if (upper === "SLD") return "SELL";
  throw new Error(`Unknown trade side: '${value}' (expected BOT or SLD)`);
}

function normalizeSymbol(value: string): string {
  return value.trim().replace(".", "/");
}

export const ibkrParser: BrokerParser = {
  id: "ibkr",

  // "Buy/Sell" is already collapsed from "Buy/\nSell" by normalizeCsvText
  // before detectBroker ever reads the headers. TradeID and AccountID are
  // unique to IBKR and not present in Zerodha CSVs.
  requiredHeaders: ["TradeID", "AccountID", "Symbol", "DateTime", "Buy/Sell", "Quantity", "TradePrice", "Currency"],

  parse(csvText: string): ParseResult {
    const rows = readCsvRows(csvText);
    const trades: Trade[] = [];
    const errors: RowError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNumber = i + 2;

      try {
        const rawDateTime = row["DateTime"] ?? "";
        const executedAt = parseIsoOrMmDdYyyy(rawDateTime);
        if (executedAt === null) {
          throw new Error(`Invalid date/time: '${rawDateTime}'`);
        }

        const side = parseSide(row["Buy/Sell"] ?? "");

        const quantity = parseRequiredNumber(row["Quantity"] ?? "", "quantity");
        if (quantity === 0) {
          throw new Error(`Quantity must be non-zero, got ${quantity}`);
        }
        if (quantity < 0) {
          throw new Error(`Quantity must be positive, got ${quantity}`);
        }

        const price = parseRequiredNumber(row["TradePrice"] ?? "", "price");

        const symbol = normalizeSymbol(row["Symbol"] ?? "");
        if (symbol.length === 0) {
          throw new Error("symbol is required");
        }

        const currency = (row["Currency"] ?? "").trim();
        if (currency.length !== 3) {
          throw new Error(`Invalid currency: '${currency}'`);
        }

        const totalAmount = side === "SELL" ? -(quantity * price) : quantity * price;

        parseOptionalNumber(row["Commission"], "commission");

        const trade = TradeSchema.parse({
          symbol,
          side,
          quantity,
          price,
          totalAmount,
          currency,
          executedAt,
          broker: "ibkr",
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
      broker: "ibkr",
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
