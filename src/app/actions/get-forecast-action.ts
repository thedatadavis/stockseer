"use server";

import { z } from "zod";
import {
  generateStockForecast,
  type GenerateStockForecastInput,
  type GenerateStockForecastOutput,
} from "@/ai/flows/generate-stock-forecast";

const formSchema = z.object({
  ticker: z.string().min(1, 'Ticker is required').max(10, 'Ticker is too long').toUpperCase(),
});

export interface ForecastState {
  forecast: GenerateStockForecastOutput | null;
  message: string | null;
  ticker: string | null;
}

export async function getForecastAction(
  prevState: ForecastState,
  formData: FormData
): Promise<ForecastState> {
  const validatedFields = formSchema.safeParse({
    ticker: formData.get('ticker'),
  });

  if (!validatedFields.success) {
    return {
      forecast: null,
      message: "Invalid ticker provided.",
      ticker: null,
    };
  }

  const { ticker } = validatedFields.data;

  try {
    const result = await generateStockForecast({ ticker });
    return {
      forecast: result,
      message: null,
      ticker: ticker,
    };
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      forecast: null,
      message: `Failed to fetch forecast for ${ticker}. ${errorMessage}`,
      ticker: ticker,
    };
  }
}
