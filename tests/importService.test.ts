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
});

describe("importTrades", () => {
  it("parses the Zerodha sample and skips invalid rows", () => {
    const result = importTrades(zerodhaCsv);

    expect(result.broker).toBe("zerodha");
    expect(result.summary).toEqual({ total: 7, valid: 5, skipped: 2 });
    expect(result.trades[0]).toMatchObject({
      symbol: "RELIANCE",
      side: "BUY",
      quantity: 10,
      price: 2450.5,
      totalAmount: 24505,
      currency: "INR",
      broker: "zerodha"
    });
    expect(result.trades[1]?.totalAmount).toBe(-38018.75);
    expect(result.errors.map((error) => error.row)).toEqual([6, 7]);
    expect(result.errors[0]?.reason).toContain("Invalid date");
    expect(result.errors[1]?.reason).toContain("greater than 0");
  });

  it("parses the IBKR sample and skips zero-quantity rows", () => {
    const result = importTrades(ibkrCsv);

    expect(result.broker).toBe("ibkr");
    expect(result.summary).toEqual({ total: 6, valid: 5, skipped: 1 });
    expect(result.trades[1]).toMatchObject({
      symbol: "MSFT",
      side: "SELL",
      totalAmount: -21012.5
    });
    expect(result.trades[2]).toMatchObject({
      symbol: "EUR/USD",
      side: "BUY"
    });
    expect(result.trades[3]?.executedAt).toBe("2026-04-03T00:00:00.000Z");
    expect(result.trades[4]?.rawData.Commission).toBe("");
    expect(result.errors[0]?.row).toBe(5);
  });

  it("handles PDF-wrapped IBKR header and CASH value", () => {
    const result = importTrades(pdfWrappedIbkrCsv);

    expect(result.summary).toEqual({ total: 1, valid: 1, skipped: 0 });
    expect(result.trades[0]?.symbol).toBe("EUR/USD");
    expect(result.trades[0]?.rawData.AssetClass).toBe("CASH");
  });

  it("rejects empty files", () => {
    expect(() => importTrades("")).toThrow(ImportError);
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
BAD,,bad,buy,0,100,TRD1,ORD1,NSE,EQ
WORSE,,02-04-2026,hold,10,100,TRD2,ORD2,NSE,EQ`;

    const result = importTrades(csv);

    expect(result.summary).toEqual({ total: 2, valid: 0, skipped: 2 });
    expect(result.trades).toHaveLength(0);
  });

  it("keeps extra columns in rawData", () => {
    const csv = `TradeID,AccountID,Symbol,DateTime,Buy/Sell,Quantity,TradePrice,Currency,Commission,NetAmount,AssetClass,Note
U1234-007,U1234567,NVDA,2026-04-05T10:15:00Z,BOT,2,900,USD,-1.00,1799.00,STK,earnings`;

    const result = importTrades(csv);

    expect(result.trades[0]?.rawData.Note).toBe("earnings");
  });
});
