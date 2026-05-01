import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { zerodhaCsv, ibkrCsv } from "./fixtures.js";

describe("GET /health", () => {
  it("returns ok", async () => {
    const response = await request(createApp()).get("/health").expect(200);
    expect(response.body.ok).toBe(true);
  });
});

describe("GET /", () => {
  it("serves the browser upload UI", async () => {
    const response = await request(createApp()).get("/").expect(200);
    expect(response.type).toBe("text/html");
    expect(response.text).toContain("Broker CSV Import");
    expect(response.text).toContain('type="file"');
  });
});

describe("POST /import", () => {
  it("accepts a Zerodha CSV and returns parsed trades", async () => {
    const response = await request(createApp())
      .post("/import")
      .attach("file", Buffer.from(zerodhaCsv), "zerodha.csv")
      .expect(200);

    expect(response.body.broker).toBe("zerodha");
    expect(response.body.summary).toEqual({ total: 7, valid: 5, skipped: 2 });
    expect(response.body.trades).toHaveLength(5);
    expect(response.body.errors).toHaveLength(2);
  });

  it("accepts an IBKR CSV and returns parsed trades", async () => {
    const response = await request(createApp())
      .post("/import")
      .attach("file", Buffer.from(ibkrCsv), "ibkr.csv")
      .expect(200);

    expect(response.body.broker).toBe("ibkr");
    expect(response.body.summary).toEqual({ total: 6, valid: 5, skipped: 1 });
  });

  it("returns 400 when no file is attached", async () => {
    const response = await request(createApp()).post("/import").expect(400);
    expect(response.body.error).toContain("CSV file is required");
  });

  it("returns 400 for an unrecognized CSV format", async () => {
    const response = await request(createApp())
      .post("/import")
      .attach("file", Buffer.from("foo,bar\n1,2"), "unknown.csv")
      .expect(400);
    expect(response.body.error).toContain("Unrecognized broker");
  });

  it("returns 400 for an empty file", async () => {
    const response = await request(createApp())
      .post("/import")
      .attach("file", Buffer.from(""), "empty.csv")
      .expect(400);
    expect(response.body.error).toBeDefined();
  });

  it("returns valid JSON structure with all required fields", async () => {
    const response = await request(createApp())
      .post("/import")
      .attach("file", Buffer.from(zerodhaCsv), "zerodha.csv")
      .expect(200);

    expect(response.body).toHaveProperty("broker");
    expect(response.body).toHaveProperty("summary");
    expect(response.body).toHaveProperty("trades");
    expect(response.body).toHaveProperty("errors");
    expect(response.body.summary).toHaveProperty("total");
    expect(response.body.summary).toHaveProperty("valid");
    expect(response.body.summary).toHaveProperty("skipped");
  });
});
