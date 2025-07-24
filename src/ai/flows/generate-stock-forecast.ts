'use server';

/**
 * @fileOverview Generates a 5-day stock forecast for a given ticker symbol.
 *
 * This version refactors date generation into a dedicated utility for reliability.
 *
 * - getNextFiveBusinessDays - A utility to get an array of the next 5 business days.
 * - generateStockForecast - The main function that handles the stock forecast generation.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getLatestQuote } from '@/services/alpaca';

/**
 * Utility function to get an array of the next 5 business days.
 * It correctly handles timezones, weekends, and ensures dates are in the future.
 * @returns {Date[]} An array of 5 Date objects.
 */
function getNextFiveBusinessDays(logs: string[]): Date[] {
  const dates: Date[] = [];
  
  // 1. Get the current date and time in the US Eastern timezone.
  const etTimeZone = 'America/New_York';
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: etTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const partValues: { [key: string]: string } = {};
  for (const part of parts) {
      partValues[part.type] = part.value;
  }
  
  // 2. Create a reliable, timezone-neutral Date object using UTC.
  // Always specify radix 10 to prevent parsing bugs.
  const year = parseInt(partValues.year, 10);
  const month = parseInt(partValues.month, 10) - 1; // Month is 0-indexed
  const day = parseInt(partValues.day, 10);
  const hour = parseInt(partValues.hour, 10);
  
  let currentDate = new Date(Date.UTC(year, month, day));
  logs.push(`[Date Util] Current ET Date determined as: ${currentDate.toUTCString()}, Hour: ${hour}`);
  
  const dayOfWeek = currentDate.getUTCDay();

  // 3. If it's after market close on a weekday, or a weekend, start from the next day.
  if ((dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 16) || dayOfWeek === 6 || dayOfWeek === 0) {
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      logs.push(`[Date Util] Market closed or weekend. Advancing to next day: ${currentDate.toUTCString()}`);
  }

  // 4. Loop until we have found 5 business days.
  while (dates.length < 5) {
    const currentDayOfWeek = currentDate.getUTCDay();
    // Day 6 is Saturday, Day 0 is Sunday.
    if (currentDayOfWeek !== 6 && currentDayOfWeek !== 0) {
      // It's a business day, add a new Date object to the array.
      dates.push(new Date(currentDate));
    }
    // Advance to the next calendar day for the next check.
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }
  
  logs.push(`[Date Util] Found 5 business days: ${dates.map(d => d.toISOString().split('T')[0]).join(', ')}`);
  return dates;
}


const GenerateStockForecastInputSchema = z.object({
  ticker: z.string().describe('The stock ticker symbol (e.g., AAPL, MSFT, GOOGL).'),
  currentPrice: z.number().optional().describe('The current price of the stock.'),
});
export type GenerateStockForecastInput = z.infer<typeof GenerateStockForecastInputSchema>;

const ForecastDaySchema = z.object({
  date: z.string().describe('The date of the forecast (YYYY-MM-DD).'),
  openingPrice: z.number().describe('The projected opening price for the day.'),
  closingPrice: z.number().describe('The projected closing price for the day.'),
  projectedGainLoss: z.number().describe('The projected gain or loss for the day.'),
});

const GenerateStockForecastOutputSchema = z.object({
  forecast: z.array(ForecastDaySchema).describe('An array of 5-day stock forecast data.'),
  logs: z.array(z.string()).optional().describe('An array of debug log messages.'),
});
export type GenerateStockForecastOutput = z.infer<typeof GenerateStockForecastOutputSchema>;

export async function generateStockForecast(input: GenerateStockForecastInput): Promise<GenerateStockForecastOutput> {
  return generateStockForecastFlow(input);
}

const getStockForecastTool = ai.defineTool(
  {
    name: 'getStockForecast',
    description: 'Returns a 5-day stock forecast, including projected daily gains/losses for a given stock ticker.',
    inputSchema: GenerateStockForecastInputSchema,
    outputSchema: GenerateStockForecastOutputSchema,
  },
  async ({ ticker, currentPrice }) => {
    if (currentPrice === undefined) {
      throw new Error('Current price is required to generate a forecast.');
    }

    const logs: string[] = [];

    // Get the next 5 business days from our new utility function.
    const forecastDates = getNextFiveBusinessDays(logs);

    const forecast: z.infer<typeof ForecastDaySchema>[] = [];
    let lastClosingPrice = currentPrice;

    // Iterate over the guaranteed correct dates.
    for (const date of forecastDates) {
        // Simulate a small gap between previous close and new opening price
        const openingPrice = lastClosingPrice * (1 + (Math.random() - 0.49) * 0.01); 
        const closingPrice = openingPrice * (1 + (Math.random() - 0.5) * 0.02);
        const projectedGainLoss = closingPrice - openingPrice;

        // Format the date to YYYY-MM-DD string.
        const formattedDate = date.toISOString().split('T')[0];

        forecast.push({
            date: formattedDate,
            openingPrice: parseFloat(openingPrice.toFixed(2)),
            closingPrice: parseFloat(closingPrice.toFixed(2)),
            projectedGainLoss: parseFloat(projectedGainLoss.toFixed(2)),
        });

        lastClosingPrice = closingPrice;
    }
    
    return { forecast, logs };
  }
);


const generateStockForecastPrompt = ai.definePrompt({
  name: 'generateStockForecastPrompt',
  tools: [getStockForecastTool],
  input: {schema: GenerateStockForecastInputSchema},
  output: {schema: GenerateStockForecastOutputSchema},
  prompt: `You are a financial analyst. The user will provide you with a stock ticker.
  Your task is to provide a 5-day forecast.
  Use the getStockForecast tool to get the forecast.

  The user is asking about: {{{ticker}}}
  The current price is: {{{currentPrice}}}`,
});

const generateStockForecastFlow = ai.defineFlow(
  {
    name: 'generateStockForecastFlow',
    inputSchema: GenerateStockForecastInputSchema,
    outputSchema: GenerateStockForecastOutputSchema,
  },
  async ({ ticker }) => {
    const quote = await getLatestQuote(ticker);
    if (!quote) {
      throw new Error(`Could not retrieve quote for ${ticker}`);
    }

    const {output} = await generateStockForecastPrompt({ ticker, currentPrice: quote.AskPrice });
    
    // The tool call now handles logging, so we can just return the output.
    return output!;
  }
);
