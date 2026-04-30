import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { zerodhaCsv } from "./fixtures.js";

describe("POST /import", () => {
  it("accepts a CSV file upload and returns parsed trades", async () => {
    const response = await request(createApp())
      .post("/import")
      .attach("file", Buffer.from(zerodhaCsv), "zerodha.csv")
      .expect(200);

    expect(response.body.broker).toBe("zerodha");
    expect(response.body.summary).toEqual({ total: 7, valid: 5, skipped: 2 });
    expect(response.body.trades).toHaveLength(5);
    expect(response.body.errors).toHaveLength(2);
  });

  it("returns a clear error when the file is missing", async () => {
    const response = await request(createApp()).post("/import").expect(400);

    expect(response.body.error).toContain("CSV file is required");
  });
});
