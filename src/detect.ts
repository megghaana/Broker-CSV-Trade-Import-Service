import { readCsvHeaders } from "./csv.js";
import { brokerParsers } from "./brokers/index.js";
import type { BrokerParser } from "./types.js";

export class UnknownBrokerError extends Error {
  public constructor(headers: readonly string[]) {
    super(
      headers.length === 0
        ? "CSV is empty or missing a header row"
        : `Unrecognized broker CSV format. Headers: ${headers.join(", ")}`
    );
    this.name = "UnknownBrokerError";
  }
}

export function detectBroker(csvText: string): BrokerParser {
  const headers = readCsvHeaders(csvText);

  // normalizeCsvText already runs inside readCsvHeaders, so multi-line
  // headers like "Buy/\nSell" are already collapsed to "Buy/Sell" here.
  // BrokerParser.requiredHeaders must use the post-normalized form.
  const normalizedHeaders = new Set(
    headers.map((header) => normalizeHeader(header))
  );

  const parser = brokerParsers.find((candidate) =>
    candidate.requiredHeaders.every((header) =>
      normalizedHeaders.has(normalizeHeader(header))
    )
  );

  if (!parser) {
    throw new UnknownBrokerError(headers);
  }

  return parser;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}