
"use server";

import { z } from "zod";
import {
  traceStockForecast,
  type TraceStockForecastOutput,
} from "@/ai/flows/trace-stock-forecast";

const formSchema = z.object({
  ticker: z.string().min(1, 'Ticker is required').max(10, 'Ticker is too long').toUpperCase(),
});

export interface TraceState {
  trace: TraceStockForecastOutput | null;
  message: string | null;
  ticker: string | null;
}

export async function traceAction(
  prevState: TraceState,
  formData: FormData
): Promise<TraceState> {
  const validatedFields = formSchema.safeParse({
    ticker: formData.get('ticker'),
  });

  if (!validatedFields.success) {
    return {
      trace: null,
      message: "Invalid ticker provided.",
      ticker: null,
    };
  }

  const { ticker } = validatedFields.data;

  try {
    const result = await traceStockForecast({ ticker });
    return {
      trace: result,
      message: null,
      ticker: ticker,
    };
  } catch (error) {
    console.error("Trace action error:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      trace: null,
      message: `Failed to run trace for ${ticker}. ${errorMessage}`,
      ticker: ticker,
    };
  }
}
