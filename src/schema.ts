import { z } from "zod";

export const TradeSchema = z.object({
  symbol: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive(),
  price: z.number().positive(),
  totalAmount: z.number(),
  currency: z.string().length(3),
  executedAt: z.string().datetime(),
  broker: z.string().min(1),
  rawData: z.record(z.string(), z.unknown())
});

export type Trade = z.infer<typeof TradeSchema>;
export type TradeSide = Trade["side"];
