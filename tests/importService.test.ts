import { describe, expect, it } from "vitest";
import { detectBroker, UnknownBrokerError } from "../src/detect.js";
import { ImportError, importTrades } from "../src/importService.js";
import { ibkrCsv, pdfWrappedIbkrCsv, zerodhaCsv } from "./fixtures.js";

describe("broker detection", () => {
  it("detects zerodha by headers", () => {
    expect(detectBroker(zerodhaCsv).id).toBe("zerodha");
  });

  it("detects ibkr by headers", () => {
    expect(detectBroker(ibkrCsv).id).toBe("ibkr");
  });

  it("fails clearly for unknown formats", () => {
    expect(() => detectBroker("foo,bar\n1,2")).toThrow(UnknownBrokerError);
  });

  it("fails clearly for empty input", () => {
    expect(() => detectBroker("")).toThrow(UnknownBrokerError);
  });
});

describe("importTrades — Zerodha", () => {
  it("parses the sample CSV with correct summary counts", () => {
    const result = importTrades(zerodhaCsv);
    expect(result.broker).toBe("zerodha");
    expect(result.summary).toEqual({ total: 7, valid: 5, skipped: 2 });
    expect(result.trades).toHaveLength(5);
    expect(result.errors).toHaveLength(2);
  });

  it("correctly maps the first valid trade", () => {
    const result = importTrades(zerodhaCsv);
    expect(result.trades[0]).toMatchObject({
      symbol: "RELIANCE",
      side: "BUY",
      quantity: 10,
      price: 2450.5,
      totalAmount: 24505,
      currency: "INR",
      broker: "zerodha",
    });
  });

  it("returns negative totalAmount for sell trades", () => {
    const result = importTrades(zerodhaCsv);
    // INFY: sell 25 @ 1520.75 = -38018.75
    expect(result.trades[1]?.totalAmount).toBe(-38018.75);
  });

  it("handles case-insensitive trade_type (row 5 uppercase SELL)", () => {
    const result = importTrades(zerodhaCsv);
    // SBIN is row 5 — uppercase SELL should parse as SELL not fail
    const sbin = result.trades.find((t) => t.symbol === "SBIN");
    expect(sbin?.side).toBe("SELL");
  });

  it("skips row with invalid date and reports correct row number", () => {
    const result = importTrades(zerodhaCsv);
    expect(result.errors[0]?.row).toBe(7); // row 7 in 1-based with header = index 5
    expect(result.errors[0]?.reason).toContain("Invalid date");
  });

  it("skips row with negative quantity and reports correct row number", () => {
    const result = importTrades(zerodhaCsv);
    expect(result.errors[1]?.row).toBe(8);
    expect(result.errors[1]?.reason).toMatch(/greater than 0|positive/i);
  });

  it("infers INR currency from NSE exchange", () => {
    const result = importTrades(zerodhaCsv);
    expect(result.trades.every((t) => t.currency === "INR")).toBe(true);
  });

  it("preserves rawData including optional isin field", () => {
    const result = importTrades(zerodhaCsv);
    // HDFCBANK has empty isin — should still parse and preserve rawData
    const hdfc = result.trades.find((t) => t.symbol === "HDFCBANK");
    expect(hdfc).toBeDefined();
    expect(hdfc?.rawData["isin"]).toBe("");
  });

  it("parses a single valid row", () => {
    const csv = `symbol,isin,trade_date,trade_type,quantity,price,trade_id,order_id,exchange,segment
NIFTYBEES,,04-04-2026,buy,1,250.25,TRD008,ORD008,NSE,EQ`;
    const result = importTrades(csv);
    expect(result.summary).toEqual({ total: 1, valid: 1, skipped: 0 });
    expect(result.trades[0]?.symbol).toBe("NIFTYBEES");
  });

  it("returns all rows as errors when every row is invalid", () => {
    const csv = `symbol,isin,trade_date,trade_type,quantity,price,trade_id,order_id,exchange,segment
BAD,,bad_date,buy,0,100,TRD1,ORD1,NSE,EQ
WORSE,,02-04-2026,hold,10,100,TRD2,ORD2,NSE,EQ`;
    const result = importTrades(csv);
    expect(result.summary).toEqual({ total: 2, valid: 0, skipped: 2 });
    expect(result.trades).toHaveLength(0);
  });
});

describe("importTrades — IBKR", () => {
  it("parses the sample CSV skipping only the zero-quantity row", () => {
    const result = importTrades(ibkrCsv);
    expect(result.broker).toBe("ibkr");
    expect(result.summary).toEqual({ total: 6, valid: 5, skipped: 1 });
  });

  it("maps BOT→BUY and SLD→SELL correctly", () => {
    const result = importTrades(ibkrCsv);
    expect(result.trades[0]?.side).toBe("BUY");  // BOT
    expect(result.trades[1]?.side).toBe("SELL"); // SLD
  });

  it("normalizes EUR.USD forex symbol to EUR/USD", () => {
    const result = importTrades(ibkrCsv);
    expect(result.trades[2]?.symbol).toBe("EUR/USD");
  });

  it("parses MM/DD/YYYY fallback date (row 4)", () => {
    const result = importTrades(ibkrCsv);
    expect(result.trades[3]?.executedAt).toBe("2026-04-03T00:00:00.000Z");
  });

  it("accepts empty Commission field (row 6) without skipping the row", () => {
    const result = importTrades(ibkrCsv);
    // GOOGL is row 6 — empty Commission should NOT cause a skip
    const googl = result.trades.find((t) => t.symbol === "GOOGL");
    expect(googl).toBeDefined();
    expect(googl?.rawData["Commission"]).toBe("");
  });

  it("skips zero-quantity row at correct row number", () => {
    const result = importTrades(ibkrCsv);
    expect(result.errors[0]?.row).toBe(6); // AMZN is row 6 (1-based with header)
  });

  it("returns negative totalAmount for SLD trades", () => {
    const result = importTrades(ibkrCsv);
    // MSFT: sell 50 @ 420.25 = -21012.5
    expect(result.trades[1]?.totalAmount).toBe(-21012.5);
  });

  it("preserves all extra columns in rawData", () => {
    const csv = `TradeID,AccountID,Symbol,DateTime,Buy/Sell,Quantity,TradePrice,Currency,Commission,NetAmount,AssetClass,Note
U1234-007,U1234567,NVDA,2026-04-05T10:15:00Z,BOT,2,900,USD,-1.00,1799.00,STK,earnings`;
    const result = importTrades(csv);
    expect(result.trades[0]?.rawData["Note"]).toBe("earnings");
  });
});

describe("importTrades — PDF-wrapped IBKR", () => {
  it("handles Buy/Sell header split across lines", () => {
    const result = importTrades(pdfWrappedIbkrCsv);
    expect(result.summary).toEqual({ total: 1, valid: 1, skipped: 0 });
  });

  it("handles CASH value split across lines", () => {
    const result = importTrades(pdfWrappedIbkrCsv);
    expect(result.trades[0]?.rawData["AssetClass"]).toBe("CASH");
  });

  it("correctly parses the EUR/USD symbol from wrapped CSV", () => {
    const result = importTrades(pdfWrappedIbkrCsv);
    expect(result.trades[0]?.symbol).toBe("EUR/USD");
  });
});

describe("importTrades — edge cases", () => {
  it("rejects empty input", () => {
    expect(() => importTrades("")).toThrow(ImportError);
  });

  it("rejects unrecognized broker format", () => {
    expect(() => importTrades("foo,bar\n1,2")).toThrow(ImportError);
  });

  it("rejects header-only CSV with zero data rows", () => {
    const csv = `symbol,isin,trade_date,trade_type,quantity,price,trade_id,order_id,exchange,segment`;
    const result = importTrades(csv);
    expect(result.summary).toEqual({ total: 0, valid: 0, skipped: 0 });
  });
});