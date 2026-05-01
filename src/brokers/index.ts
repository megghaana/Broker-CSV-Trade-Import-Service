import { zerodhaParser } from "./zerodha.js";
import { ibkrParser } from "./ibkr.js";
import type { BrokerParser } from "../types.js";

// Registry order matters: if two parsers could match the same headers,
// the first match wins. Put more specific parsers earlier in the list.
// Adding a new broker = add one file + one entry here. Nothing else changes.
export const brokerParsers: readonly BrokerParser[] = [
  ibkrParser,    // IBKR first — its requiredHeaders are more specific
  zerodhaParser,
];