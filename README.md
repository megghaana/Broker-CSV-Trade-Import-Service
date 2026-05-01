# Broker CSV Import Service

A TypeScript service that normalizes broker trade-history CSV exports into a shared trade format.
Supports Zerodha (Indian equity) and Interactive Brokers (IBKR) out of the box.
Adding a new broker requires one new parser file, one registry entry, and one
`BrokerId` type entry.

## Requirements

- Node.js 20 or newer
- npm 9 or newer

## Install

```bash
git clone <your-repo-url>
cd journalyst-importer
npm install
```

## Run the Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`.

Open the browser UI:

```text
http://localhost:3000/
```

Use the page to upload a Zerodha or IBKR CSV. The UI submits the file to
`POST /import` and displays the normalized JSON response.

Import a CSV:

```bash
# Zerodha
curl -F "file=@samples/zerodha.csv" http://localhost:3000/import

# IBKR
curl -F "file=@samples/ibkr.csv" http://localhost:3000/import
```

Health check:

```bash
curl http://localhost:3000/health
# { "ok": true }
```

## Run Tests

```bash
npm test
```

Expected result:

```text
Test Files  2 passed
Tests       36 passed
```

Manual smoke checks:

```bash
# Start the server first
npm run dev

# In another terminal, check the API is alive
curl http://localhost:3000/health

# Or open the browser upload page
http://localhost:3000/
```

## API

### `GET /`

Serves a small browser UI for uploading CSV files and previewing the import
result.

### `GET /health`

Returns a simple health-check payload.

```json
{ "ok": true }
```

### `POST /import`

Accepts a CSV file upload and returns normalized trades.

| Field       | Value                        |
|-------------|------------------------------|
| Method      | `POST`                       |
| Path        | `/import`                    |
| Body type   | `multipart/form-data`        |
| File field  | `file`                       |

**Success response (`200`):**

```json
{
  "broker": "zerodha",
  "summary": { "total": 7, "valid": 5, "skipped": 2 },
  "trades": [
    {
      "symbol": "RELIANCE",
      "side": "BUY",
      "quantity": 10,
      "price": 2450.50,
      "totalAmount": 24505,
      "currency": "INR",
      "executedAt": "2026-04-01T00:00:00.000Z",
      "broker": "zerodha",
      "rawData": { "symbol": "RELIANCE", "trade_id": "TRD001", "..." : "..." }
    }
  ],
  "errors": [
    { "row": 7, "reason": "Invalid date: 'invalid_date'", "rawData": { "..." : "..." } },
    { "row": 8, "reason": "quantity: Number must be greater than 0" }
  ]
}
```

**Error responses:**

| Status | Reason                                      |
|--------|---------------------------------------------|
| `400`  | No file attached                            |
| `400`  | Unrecognized broker format                  |
| `400`  | Malformed CSV (unparseable)                 |
| `500`  | Unexpected server error                     |

## Project Structure

```
src/
  brokers/
    zerodha.ts        Zerodha-specific parser and row normalizer
    ibkr.ts           IBKR-specific parser and row normalizer
    index.ts          Broker registry — add new brokers here
  app.ts              Express app and /import route
  csv.ts              CSV parsing and text normalization utilities
  date.ts             Date parsers for DD-MM-YYYY and ISO/MM-DD-YYYY formats
  detect.ts           Header-based broker auto-detection
  error.ts            Human-readable error formatting (Zod + plain errors)
  importService.ts    Orchestrates detect → parse → return
  number.ts           Required and optional numeric field parsers
  schema.ts           Zod trade schema (canonical output shape)
  server.ts           Entry point — starts the HTTP server
  types.ts            Shared TypeScript interfaces (BrokerParser, ParseResult, etc.)
tests/
  app.test.ts         HTTP endpoint tests (supertest)
  importService.test.ts  Parser unit tests for all edge cases
  fixtures.ts         Sample CSV strings used across tests
package-lock.json
package.json
tsconfig.json
vitest.config.ts
```

## Design Decisions

**Registry pattern for broker parsers.**
Each parser in `src/brokers/` declares the CSV column headers it requires and exposes a `parse` function. `detect.ts` iterates the registry and picks the first match. To add Broker C: create `src/brokers/brokerC.ts`, register it in `src/brokers/index.ts`, and add its ID to `BrokerId` in `src/types.ts`.

`BrokerId` is intentionally kept as an explicit union type instead of a broad
`string`. This adds one small update when a broker is added, but it lets
TypeScript catch typos such as `zerodah` or `ikbr` at compile time.

**Row-level error isolation.**
A bad row never aborts the import. Each row is wrapped in a try/catch — failures are collected into the `errors` array with the 1-based row number and a human-readable reason. This is intentional: financial data is messy and partial imports are more useful than full rejections.

**Zod validation runs last.**
Each parser normalizes the raw row into a plain object first (date parsing, side mapping, currency inference, symbol normalization) and only then calls `TradeSchema.parse()`. This means Zod error messages describe what the *normalized* value violated, not the raw string — easier to act on.

**`rawData` is captured before any transformation.**
The spread of the original CSV row (`{ ...row }`) happens before normalization so `rawData` always reflects what was in the file, including empty fields like IBKR's optional Commission.

**Sell `totalAmount` is negative.**
The Zod schema comment says `totalAmount` can be negative for sells. Parsers compute `-(quantity * price)` for sell-side trades so callers can sum `totalAmount` across a portfolio without needing to check `side`.

**CSV text normalization handles PDF copy artifacts.**
IBKR's `Buy/Sell` header and `CASH` asset class are sometimes broken across lines when copied from a PDF. `normalizeCsvText()` in `csv.ts` collapses these before parsing so neither the detector nor the parser needs to handle the wrapped form.

**Empty optional fields are not errors.**
IBKR's `Commission` field is empty in one sample row. `parseOptionalNumber()` in `number.ts` returns `null` for blank values and only throws if a non-empty value is unparseable. The row is accepted; the empty field is preserved in `rawData`.

**Row numbers in errors are 1-based and include the header.**
Row 1 is always the header. The first data row is row 2. This matches what you'd see if you opened the file in a spreadsheet — no mental arithmetic needed when cross-referencing an error against the original file.
