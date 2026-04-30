import type { BrokerParser } from "../types.js";
import { ibkrParser } from "./ibkr.js";
import { zerodhaParser } from "./zerodha.js";

export const brokerParsers: readonly BrokerParser[] = [zerodhaParser, ibkrParser];
