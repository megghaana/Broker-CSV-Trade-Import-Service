# Broker CSV Import Service

Small TypeScript service that normalizes broker trade-history CSV exports into a shared trade format.

## Install

```bash
npm install
```

Requires Node.js 20 or newer.

## Run The Server

```bash
npm run dev
```

The server starts at `http://localhost:3000`.

Import a CSV with:

```bash
curl -F "file=@zerodha.csv" http://localhost:3000/import
```

## Run Tests

```bash
npm test
```

## API

`POST /import`

- Accepts `multipart/form-data`
- File field name: `file`
- Auto-detects the broker from CSV headers
- Returns valid trades, skipped rows, and summary stats

Example response:

```json
{
  "broker": "zerodha",
  "summary": { "total": 7, "valid": 5, "skipped": 2 },
  "trades": [],
  "errors": [
    { "row": 6, "reason": "Invalid date: 'invalid_date'" },
    { "row": 7, "reason": "quantity: Number must be greater than 0" }
  ]
}
```

## Design Decisions

- Broker-specific parsing lives in `src/brokers`. Each parser declares its required headers and exposes a `parse` function.
- Auto-detection is header-based, so adding Broker C means adding a parser and registering it in `src/brokers/index.ts`.
- Every row is validated through the provided Zod schema. Bad rows are skipped with a row-level reason instead of failing the whole import.
- `rawData` preserves the original CSV row, including extra fields such as IBKR commissions, account IDs, and asset class.
- Zerodha dates are parsed as `DD-MM-YYYY`; IBKR supports ISO timestamps and the sample's `MM/DD/YYYY` fallback.
- Sell totals are returned as negative values because the target schema notes that sell totals can be negative.
- A small CSV text normalization step handles common PDF-copy wrapping from the assignment text, such as `Buy/Sell` and `CASH` being split across lines.

## Project Structure

```text
src/
  app.ts              Express app and /import endpoint
  importService.ts    Broker detection + parser orchestration
  detect.ts           Header-based broker auto-detection
  schema.ts           Zod trade schema
  brokers/            Broker-specific parser modules
tests/                Parser and HTTP endpoint tests
```
